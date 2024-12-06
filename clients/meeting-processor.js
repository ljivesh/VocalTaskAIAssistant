import PostgresClient from './postgresql-client.js';
import E5EmbeddingClient from './embeddings-client.js';
import OpenAIClient from './openai-client.js';
import pgvector from 'pgvector';

const dbConfig = {
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

class MeetingProcessor {
  constructor() {
    this.db = new PostgresClient(dbConfig);
    this.embedder = new E5EmbeddingClient();
    this.llm = OpenAIClient;
    this.meetingId = null;
    this.textBuffer = [];
  }

  async initialize() {
    await this.db.connect();
    await this.embedder.initialize();
    this.meetingId = Date.now().toString();
    
    // Create pgvector extension if not exists
    await this.db.query('CREATE EXTENSION IF NOT EXISTS vector;');

    // Create meeting-specific table for speech-to-text chunks
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS ST_${this.meetingId} (
        chunk_id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        chunked_data TEXT,
        embeddings vector(384)
      )
    `);

    // Create meetings table if not exists
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        meeting_id TEXT PRIMARY KEY,
        start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP,
        summary TEXT,
        embeddings vector(384)
      )
    `);

    // Insert meeting start record with explicit timestamp
    await this.db.query(
      'INSERT INTO meetings (meeting_id, start_time) VALUES ($1, CURRENT_TIMESTAMP)',
      [this.meetingId]
    );
  }

  async processTextChunk(text) {
    this.textBuffer.push(text);
    
    if (this.textBuffer.join(' ').length > 500) {
      const chunk = this.textBuffer.join(' ');
      const embedding = await this.embedder.embed(chunk);
      
      await this.db.query(
        `INSERT INTO ST_${this.meetingId} (chunked_data, embeddings) 
         VALUES ($1, $2)`,
        [chunk, pgvector.toSql(embedding)]
      );
      
      this.textBuffer = [];
    }
  }

  async generateMeetingSummary() {
    // Get all text chunks
    const result = await this.db.query(
      `SELECT chunked_data FROM ST_${this.meetingId} ORDER BY timestamp`
    );
    
    const fullText = result.rows.map(row => row.chunked_data).join('\n');

    console.log("FULL TEXT: ", fullText);
    
    // Generate summary using LLM
    const completion = await this.llm.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a meeting summarizer. Create a concise summary of the following meeting transcript. If the transcript is empty, return 'No transcript available'."
        },
        {
          role: "user",
          content: fullText
        }
      ],
      model: "mixtral-8x7b-32768",
      temperature: 0.7,
    });

    const summary = completion.choices[0].message.content;
    const summaryEmbedding = await this.embedder.embed(summary);

    // Update meetings table
    await this.db.query(
      `UPDATE meetings 
       SET summary = $1, embeddings = $2, end_time = CURRENT_TIMESTAMP
       WHERE meeting_id = $3`,
      [summary, pgvector.toSql(summaryEmbedding), this.meetingId]
    );

    return summary;
  }

  async cleanup() {
    await this.db.close();
  }
}

export default MeetingProcessor;