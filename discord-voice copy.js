import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType, getVoiceConnection, EndBehaviorType } from '@discordjs/voice';
import { createWriteStream, unlink } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import prism from 'prism-media';
import { Transform } from 'stream';
import { spawn } from 'child_process';
import { promisify } from 'util';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import * as fs from 'fs';
import { Buffer } from 'buffer';
import axios from 'axios';
import FormData from 'form-data';

const unlinkAsync = promisify(unlink);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const activeRecordings = new Map();

class TimedStream extends Transform {
  constructor(options = {}) {
    super(options);
    this.lastTime = Date.now();
    this.interval = 20;
  }

  _transform(chunk, encoding, callback) {
    const now = Date.now();
    const delta = now - this.lastTime;
    
    if (delta < this.interval) {
      setTimeout(() => {
        this.push(chunk);
        this.lastTime = Date.now();
        callback();
      }, this.interval - delta);
    } else {
      this.push(chunk);
      this.lastTime = now;
      callback();
    }
  }
}

function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-f', 's16le',          // Input format
      '-ar', '48000',         // Sample rate
      '-ac', '2',             // Number of channels
      '-i', inputPath,        // Input file
      '-acodec', 'pcm_s16le', // Output codec
      outputPath              // Output file
    ]);

    ffmpeg.stderr.on('data', (data) => {
      console.log(`ffmpeg: ${data}`);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

async function transcribeAudio(wavFilePath) {
  try {
    const endpoint = `https://${process.env.AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
    
    const headers = {
      'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
      'Content-Type': 'audio/wav'
    };

    const audioData = fs.readFileSync(wavFilePath);
    
    const response = await axios.post(endpoint, audioData, {
      headers: headers,
      params: {
        'language': 'en-US'
      }
    });

    if (response.data && response.data.DisplayText) {
      return response.data.DisplayText;
    } else {
      throw new Error('No transcription result');
    }
  } catch (error) {
    console.error('Transcription error:', error.response?.data || error.message);
    throw error;
  }
}

async function testTranscription() {
  try {
    const result = await transcribeAudio('session_1731855944103.wav');
    console.log('Transcription result:', result);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.content === '!record') {
    if (!message.member.voice.channel) {
      message.reply('You need to be in a voice channel to use this command!');
      return;
    }

    const existingRecording = activeRecordings.get(message.guild.id);
    if (existingRecording) {
      await stopRecording(message.guild.id);
    }

    const connection = joinVoiceChannel({
      channelId: message.member.voice.channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    const receiver = connection.receiver;
    const timestamp = Date.now();
    const rawFilename = join(__dirname, `session_${timestamp}.raw`);
    const wavFilename = join(__dirname, `session_${timestamp}.wav`);
    
    const outputStream = createWriteStream(rawFilename, {
      flags: 'a'
    });

    activeRecordings.set(message.guild.id, {
      connection,
      rawFilename,
      wavFilename,
      outputStream,
      speakingTime: new Map(),
      audioStreams: new Map()
    });

    connection.receiver.speaking.on('start', (userId) => {
      const recording = activeRecordings.get(message.guild.id);
      if (!recording) return;

      const user = client.users.cache.get(userId);
      console.log(`${user.tag} started speaking`);

      try {
        const decoder = new prism.opus.Decoder({
          rate: 48000,
          channels: 2,
          frameSize: 960
        });

        const timedStream = new TimedStream({
          highWaterMark: 4096
        });

        const audioStream = receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.Manual
          }
        });

        recording.speakingTime.set(userId, Date.now());

        audioStream
          .pipe(decoder)
          .pipe(timedStream)
          .pipe(recording.outputStream, { end: false });

        recording.audioStreams.set(userId, {
          audio: audioStream,
          decoder,
          timed: timedStream
        });

        audioStream.on('error', error => {
          console.error(`Audio stream error for ${user.tag}:`, error);
        });

        decoder.on('error', error => {
          console.error(`Decoder error for ${user.tag}:`, error);
        });

        timedStream.on('error', error => {
          console.error(`Timed stream error for ${user.tag}:`, error);
        });

      } catch (err) {
        console.error(`Error setting up stream for ${user.tag}:`, err);
      }
    });

    connection.receiver.speaking.on('end', (userId) => {
      const recording = activeRecordings.get(message.guild.id);
      if (recording) {
        const user = client.users.cache.get(userId);
        console.log(`${user.tag} stopped speaking`);

        const streams = recording.audioStreams.get(userId);
        if (streams) {
          const { audio, decoder, timed } = streams;
          audio.unpipe(decoder);
          decoder.unpipe(timed);
          timed.unpipe(recording.outputStream);
          recording.audioStreams.delete(userId);
          recording.speakingTime.delete(userId);
        }
      }
    });

    message.reply('Started recording session...');
  }

  if (message.content === '!stop') {
    try {
      const recording = activeRecordings.get(message.guild.id);
      if (recording) {
        await stopRecording(message.guild.id);
        message.reply(`Converting to WAV format...`);
        
        try {
          await convertToWav(recording.rawFilename, recording.wavFilename);
          await unlinkAsync(recording.rawFilename); // Delete raw file after conversion
          message.reply(`Recording saved to: ${recording.wavFilename}`);
          
          message.reply('Transcribing audio...');
          const transcription = await transcribeAudio(recording.wavFilename);
          message.reply(`Transcription:\n${transcription}`);
        } catch (err) {
          console.error('Conversion/Transcription error:', err);
          message.reply('Error processing the recording.');
        }
      } else {
        message.reply('No active recording to stop!');
      }
    } catch (err) {
      console.error('Error stopping recording:', err);
      message.reply('An error occurred while stopping the recording.');
    }
  }
});

async function stopRecording(guildId) {
  const recording = activeRecordings.get(guildId);
  if (recording) {
    try {
      for (const [userId, streams] of recording.audioStreams.entries()) {
        const { audio, decoder, timed } = streams;
        audio.unpipe(decoder);
        decoder.unpipe(timed);
        timed.unpipe(recording.outputStream);
        
        audio.destroy();
        decoder.destroy();
        timed.destroy();
      }

      recording.outputStream.end();
      recording.connection.destroy();
      recording.audioStreams.clear();
      recording.speakingTime.clear();
      activeRecordings.delete(guildId);
      
      console.log(`Recording stopped for guild ${guildId}`);
    } catch (err) {
      console.error('Error stopping recording:', err);
      throw err;
    }
  }
}

// Error handling
client.on('error', console.error);
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  for (const guildId of activeRecordings.keys()) {
    await stopRecording(guildId);
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);