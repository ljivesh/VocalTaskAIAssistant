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
import E5EmbeddingClient from './clients/embeddings-client.js';
import PostgresClient from './clients/postgresql-client.js';
import pgvector from 'pgvector';
import OpenAIClient from './clients/openai-client.js';

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

function splitIntoChunks(text, maxChunkLength = 1000) {
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim() + '.';
    
    if (currentChunk.length + trimmedSentence.length <= maxChunkLength) {
      currentChunk += ' ' + trimmedSentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

async function createMeetingsTableIfNotExists(pgClient) {
  const query = `
    CREATE TABLE IF NOT EXISTS meetings (
      meeting_id BIGINT PRIMARY KEY,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP,
      summary TEXT,
      embeddings vector(384)
    )`;
  await pgClient.query(query);
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
      const transcription = response.data.DisplayText;
      
      // Initialize clients
      const embeddingClient = new E5EmbeddingClient();
      const pgClient = new PostgresClient({
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
      });

      await pgClient.connect();

      // Ensure pgvector extension exists
      await pgClient.query('CREATE EXTENSION IF NOT EXISTS vector;');
      
      // Ensure meetings table exists
      await createMeetingsTableIfNotExists(pgClient);

      // Create meeting record
      const meetingId = Date.now();
      const createMeetingQuery = `
        INSERT INTO meetings (
          meeting_id,
          start_time,
          end_time,
          summary,
          embeddings
        ) VALUES ($1, $2, NULL, '', NULL)
        RETURNING meeting_id`;

      await pgClient.query(createMeetingQuery, [meetingId, new Date()]);

      // Create table for this transcription
      const createTableQuery = `
        CREATE TABLE transcription_${meetingId} (
          chunk_id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL,
          chunk_text TEXT NOT NULL,
          embeddings vector(384)
        )`;
      await pgClient.query(createTableQuery);

      // Split transcription into chunks
      const chunks = splitIntoChunks(transcription);
      
      // Process each chunk
      for (const chunk of chunks) {
        try {
          const embedding = await embeddingClient.embed(chunk);
          const vector = pgvector.toSql(embedding);

          const insertQuery = `
            INSERT INTO transcription_${meetingId} (
              timestamp,
              chunk_text,
              embeddings
            ) VALUES ($1, $2, $3::vector)`;

          await pgClient.query(insertQuery, [
            new Date(),
            chunk,
            vector
          ]);

          console.log(`Processed chunk: "${chunk.substring(0, 50)}..."`);
        } catch (error) {
          console.error('Error processing chunk:', error);
        }
      }

      // Generate and store meeting summary
      const summaryEmbedding = await embeddingClient.embed(transcription);
      const summaryVector = pgvector.toSql(summaryEmbedding);

      const updateMeetingQuery = `
        UPDATE meetings 
        SET 
          end_time = $1,
          summary = $2,
          embeddings = $3::vector
        WHERE meeting_id = $4`;

      await pgClient.query(updateMeetingQuery, [
        new Date(),
        transcription,
        summaryVector,
        meetingId
      ]);

      await pgClient.close();
      return {
        transcription,
        meetingId,
        tableId: meetingId,
        chunkCount: chunks.length
      };
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

const queryMeetingsFunctionDefinition = {
    type: "function",
    function: {
        name: "query_meetings",
        description: "Search through meeting transcripts and return relevant information",
        parameters: {
            type: "object",
            properties: {
                searchQuery: {
                    type: "string",
                    description: "The search query to find relevant meeting information"
                }
            },
            required: ["searchQuery"]
        }
    }
};

export async function queryMeetingsWithRAG(query, model = "llama-3.1-70b-versatile") {
    const pgClient = new PostgresClient({
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
    });
    const embeddingClient = new E5EmbeddingClient();
    
    try {
        await pgClient.connect();

        // First, let the LLM process the user's query
        const completion = await OpenAIClient.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant skilled in searching through meeting transcripts. Convert user questions into clear search queries. If the user's input isn't meeting-related, respond naturally."
                },
                {
                    role: "user",
                    content: query
                }
            ],
            tools: [queryMeetingsFunctionDefinition],
            tool_choice: { type: "function", function: { name: "query_meetings" } }
        });

        const lastMessage = completion.choices[0].message;

        // If no tool calls, treat it as a normal conversation
        if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
            return {
                success: true,
                isDirectResponse: true,
                aiResponse: lastMessage.content
            };
        }

        // Handle search queries
        const toolCall = lastMessage.tool_calls[0];
        const functionArgs = JSON.parse(toolCall.function.arguments);
        const refinedQuery = functionArgs.searchQuery;
        
        // Get query embedding
        const queryEmbedding = await embeddingClient.embed(refinedQuery);
        const queryVector = pgvector.toSql(queryEmbedding);

        // First, search in meetings table for relevant meetings
        const relevantMeetingsQuery = `
            SELECT 
                meeting_id,
                start_time,
                summary,
                1 - (embeddings <=> $1::vector) as similarity
            FROM meetings
            WHERE 1 - (embeddings <=> $1::vector) > 0.7
            ORDER BY similarity DESC
            LIMIT 3;
        `;

        const relevantMeetings = await pgClient.query(relevantMeetingsQuery, [queryVector]);

        if (relevantMeetings.rows.length === 0) {
            return {
                success: true,
                isDirectResponse: false,
                aiResponse: "I couldn't find any relevant meetings in our records.",
                searchQuery: refinedQuery
            };
        }

        // For each relevant meeting, get relevant chunks from its transcription table
        let allRelevantChunks = [];
        for (const meeting of relevantMeetings.rows) {
            const transcriptionTableQuery = `
                SELECT 
                    to_char($1::timestamp, 'YYYY-MM-DD HH24:MI') as meeting_date,
                    chunk_text,
                    1 - (embeddings <=> $2::vector) as similarity
                FROM transcription_${meeting.meeting_id}
                WHERE 1 - (embeddings <=> $2::vector) > 0.7
                ORDER BY similarity DESC
                LIMIT 3;
            `;

            try {
                const chunks = await pgClient.query(transcriptionTableQuery, [
                    meeting.start_time,
                    queryVector
                ]);
                allRelevantChunks = allRelevantChunks.concat(chunks.rows);
            } catch (error) {
                console.error(`Error querying transcription_${meeting.meeting_id}:`, error);
            }
        }

        // Sort chunks by similarity and take top 5
        allRelevantChunks.sort((a, b) => b.similarity - a.similarity);
        allRelevantChunks = allRelevantChunks.slice(0, 5);

        if (allRelevantChunks.length === 0) {
            return {
                success: true,
                isDirectResponse: false,
                aiResponse: "While I found relevant meetings, I couldn't find specific discussion points about your query.",
                searchQuery: refinedQuery,
                meetings: relevantMeetings.rows.map(m => ({
                    date: new Date(m.start_time).toLocaleString(),
                    similarity: m.similarity
                }))
            };
        }

        // Prepare context for final LLM response
        const context = allRelevantChunks.map(row => 
            `[Meeting ${row.meeting_date}]: ${row.chunk_text}`
        ).join('\n\n');

        // Get final response from LLM
        const finalResponse = await OpenAIClient.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that answers questions about meetings using the provided meeting transcripts. Base your answers solely on the provided context and acknowledge when information might be missing or unclear."
                },
                {
                    role: "user",
                    content: `Context from meeting transcripts:\n\n${context}\n\nQuestion: ${query}`
                }
            ]
        });

        return {
            success: true,
            isDirectResponse: false,
            searchQuery: refinedQuery,
            relevantChunks: allRelevantChunks,
            aiResponse: finalResponse.choices[0].message.content
        };

    } catch (error) {
        console.error('RAG query error:', error);
        return {
            success: false,
            error: error.message || 'An unknown error occurred',
            details: error.response?.data || error
        };
    } finally {
        await pgClient.close();
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
          await unlinkAsync(recording.rawFilename);
          message.reply(`Recording saved to: ${recording.wavFilename}`);
          
          message.reply('Transcribing and processing audio...');
          const result = await transcribeAudio(recording.wavFilename);
          message.reply(
            `Transcription complete!\n` +
            `Meeting ID: ${result.meetingId}\n` +
            `Processed ${result.chunkCount} chunks.\n` +
            `Table ID: ${result.tableId}\n` +
            `Transcription:\n${result.transcription}`
          );
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

  if (message.content.startsWith('!ask ')) {
    const query = message.content.slice(5).trim();
    if (!query) {
      message.reply('Please provide a question or message.');
      return;
    }

    message.reply('Processing your question...');
    try {
      const response = await queryMeetingsWithRAG(query);
      
      if (response.success) {
        if (response.isDirectResponse) {
          // Handle normal conversation
          message.reply(response.aiResponse);
        } else {
          // Handle search results
          const reply = [
            `📝 Answer: ${response.aiResponse}`,
            '',
            '🔍 Search Details:',
            `Refined Query: "${response.searchQuery}"`,
            '',
            '📊 Relevant Meetings:',
            response.relevantChunks.map(chunk => 
              `[${chunk.meeting_date}] (Similarity: ${chunk.similarity.toFixed(2)})`
            ).join('\n')
          ].join('\n');
          
          message.reply(reply);
        }
      } else {
        message.reply(`❌ Error: ${response.error}`);
      }
    } catch (error) {
      console.error('Error processing query:', error);
      message.reply('Sorry, there was an error processing your query.');
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