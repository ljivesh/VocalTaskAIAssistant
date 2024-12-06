import { Client, GatewayIntentBits, Events } from 'discord.js';
import { joinVoiceChannel, VoiceConnectionStatus, getVoiceConnection, entersState } from '@discordjs/voice';
import { Readable } from 'stream';
import { MeetingRecorder } from './clients/meeting-recorder.js';
import AzureSpeechClient from './clients/speech-client.js';
import prism from 'prism-media';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

const recorders = new Map();
const speechClient = new AzureSpeechClient();

async function handleAudioStream(audioStream, recorder, username) {
    try {
        const opusDecoder = new prism.opus.Decoder({
            frameSize: 960,
            channels: 2,
            rate: 48000
        });

        const pcmStream = new Readable({
            read() {},
            highWaterMark: 4096
        });

        // Process the audio in smaller chunks
        const processChunk = (chunk) => {
            // Convert stereo to mono and ensure correct format
            const monoChunk = Buffer.alloc(chunk.length / 2);
            for (let i = 0; i < chunk.length; i += 4) {
                const left = chunk.readInt16LE(i);
                const right = chunk.readInt16LE(i + 2);
                const mono = Math.floor((left + right) / 2);
                monoChunk.writeInt16LE(mono, i / 2);
            }
            return monoChunk;
        };

        audioStream
            .pipe(opusDecoder)
            .on('data', (chunk) => {
                try {
                    const processedChunk = processChunk(chunk);
                    pcmStream.push(processedChunk);
                } catch (err) {
                    console.error('Error processing chunk:', err);
                }
            })
            .on('end', () => {
                pcmStream.push(null);
            })
            .on('error', (error) => {
                console.error('Opus decoder error:', error);
                pcmStream.push(null);
            });

        await speechClient.streamToText(pcmStream, async (text) => {
            if (text && text.trim()) {
                console.log(`${username}: ${text}`);
                await recorder.processAudioChunk(text, username);
            }
        });
    } catch (error) {
        console.error(`Error handling audio stream for ${username}:`, error);
    }
}

// Command handlers
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    if (message.content === '!record') {
        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) {
            return message.reply('You need to be in a voice channel first!');
        }

        if (recorders.has(voiceChannel.id)) {
            return message.reply('Already recording in this channel!');
        }

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false,
            });

            const recorder = new MeetingRecorder();
            await recorder.startRecording();
            recorders.set(voiceChannel.id, recorder);

            connection.on(VoiceConnectionStatus.Ready, () => {
                message.reply('Started recording the meeting!');
                
                connection.receiver.speaking.on('start', (userId) => {
                    const user = client.users.cache.get(userId);
                    const audioStream = connection.receiver.subscribe(userId);
                    
                    if (audioStream) {
                        handleAudioStream(audioStream, recorder, user?.username || 'Unknown User');
                    }
                });
            });

            // Handle disconnections
            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
                    ]);
                } catch (error) {
                    connection.destroy();
                    recorders.delete(voiceChannel.id);
                }
            });

        } catch (error) {
            console.error('Error starting recording:', error);
            message.reply('Failed to start recording.');
        }
    }

    if (message.content === '!stop') {
        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel || !recorders.has(voiceChannel.id)) {
            return message.reply('No active recording in this channel!');
        }

        try {
            const recorder = recorders.get(voiceChannel.id);
            const summary = await recorder.stopRecording();
            recorders.delete(voiceChannel.id);
            
            const connection = getVoiceConnection(voiceChannel.guild.id);
            if (connection) {
                connection.destroy();
            }

            message.reply(`Recording stopped! Summary:\n${summary}`);
        } catch (error) {
            console.error('Error stopping recording:', error);
            message.reply('Failed to stop recording.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);