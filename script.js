import E5EmbeddingClient from './clients/embeddings-client.js';
import PostgresClient from './clients/postgresql-client.js';
import OpenAIClient from './clients/openai-client.js';
import pgvector from 'pgvector';
import fs from 'fs/promises';
import { performance } from 'perf_hooks';

class MeetingProcessor {
    constructor() {
        this.embeddingClient = new E5EmbeddingClient();
        this.pgClient = new PostgresClient({
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            host: process.env.DB_HOST,
        });
        this.openaiClient = OpenAIClient;
        this.meetingId = Date.now();
        this.transcriptPath = `./transcripts/meeting_${this.meetingId}.txt`;
        this.metrics = {
            processingTimes: [],
            embeddingTimes: [],
            dbInsertTimes: [],
            totalChunks: 0,
            errors: 0
        };
    }

    async initialize() {
        await this.pgClient.connect();
        
        // Ensure pgvector extension is installed
        await this.pgClient.query('CREATE EXTENSION IF NOT EXISTS vector;');
        
        await fs.mkdir('./transcripts', { recursive: true });
        await this.createMeetingRecord();
        await this.createMeetingTable();
    }

    async createMeetingRecord() {
        const query = `
            INSERT INTO meetings (
                meeting_id,
                start_time,
                end_time,
                summary,
                embeddings
            ) VALUES ($1, $2, NULL, '', NULL)
            RETURNING meeting_id`;

        const values = [
            this.meetingId,
            new Date()
        ];

        const result = await this.pgClient.query(query, values);
        console.log(`Created meeting record with ID: ${result.rows[0].meeting_id}`);
    }

    async createMeetingTable() {
        const createTableQuery = `
            CREATE TABLE ST_${this.meetingId} (
                chunk_id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP NOT NULL,
                chunked_data TEXT NOT NULL,
                embeddings vector(384)
            )`;

        await this.pgClient.query(createTableQuery);
        console.log(`Created table ST_${this.meetingId}`);
    }

    async processTextChunk(text) {
        const startTime = performance.now();
        try {
            await fs.appendFile(this.transcriptPath, text + '\n');

            const embedStart = performance.now();
            const embedding = await this.embeddingClient.embed(text);
            this.metrics.embeddingTimes.push(performance.now() - embedStart);

            // Ensure embedding is an array of numbers
            if (!Array.isArray(embedding)) {
                console.log('Raw embedding:', embedding);
                throw new Error('Embedding must be an array');
            }

            // Convert to float array if needed
            const embeddingArray = Array.from(embedding).map(Number);
            
            // Use pgvector's toSql method
            const vector = pgvector.toSql(embeddingArray);
            
            const query = `
                INSERT INTO ST_${this.meetingId} (
                    timestamp,
                    chunked_data,
                    embeddings
                ) VALUES ($1, $2, $3::vector)
                RETURNING chunk_id`;

            const values = [
                new Date(),
                text,
                vector
            ];

            const dbStart = performance.now();
            await this.pgClient.query(query, values);
            this.metrics.dbInsertTimes.push(performance.now() - dbStart);

            this.metrics.totalChunks++;
            this.metrics.processingTimes.push(performance.now() - startTime);
            console.log(`Processed chunk: "${text.substring(0, 50)}..."`);
        } catch (error) {
            this.metrics.errors++;
            console.error('Error processing text chunk:', error);
            // Add more debug information
            if (error.message.includes('expected array')) {
                console.error('Embedding format:', typeof embedding, embedding);
            }
            throw error;
        }
    }

    async generateMeetingSummary() {
        try {
            const fullTranscript = await fs.readFile(this.transcriptPath, 'utf-8');

            const completion = await this.openaiClient.chat.completions.create({
                model: "llama-3.1-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that creates concise meeting summaries."
                    },
                    {
                        role: "user",
                        content: `Please summarize this meeting transcript:\n${fullTranscript}`
                    }
                ]
            });

            const summary = completion.choices[0].message.content;
            const summaryEmbedding = await this.embeddingClient.embed(summary);
            const summaryVector = pgvector.toSql(summaryEmbedding);

            const updateQuery = `
                UPDATE meetings 
                SET 
                    end_time = $1,
                    summary = $2,
                    embeddings = $3::vector
                WHERE meeting_id = $4`;

            const values = [
                new Date(),
                summary,
                summaryVector,
                this.meetingId
            ];

            await this.pgClient.query(updateQuery, values);
            console.log('Meeting summary generated and stored');
            return summary;
        } catch (error) {
            console.error('Error generating meeting summary:', error);
            throw error;
        }
    }

    // Add a method to demonstrate similarity search
    async findSimilarChunks(searchText, limit = 5) {
        const searchEmbedding = await this.embeddingClient.embed(searchText);
        
        const query = `
            SELECT 
                chunked_data,
                1 - (embeddings <=> $1::vector) as similarity
            FROM ST_${this.meetingId}
            ORDER BY embeddings <=> $1::vector
            LIMIT $2`;

        const vector = pgvector.toSql(searchEmbedding);

        const result = await this.pgClient.query(query, [vector, limit]);
        return result.rows;
    }

    async cleanup() {
        await this.pgClient.close();
    }

    // Add new method for metrics reporting
    getMetrics() {
        const avgProcessingTime = this.metrics.processingTimes.reduce((a, b) => a + b, 0) / this.metrics.processingTimes.length;
        const avgEmbeddingTime = this.metrics.embeddingTimes.reduce((a, b) => a + b, 0) / this.metrics.embeddingTimes.length;
        const avgDbInsertTime = this.metrics.dbInsertTimes.reduce((a, b) => a + b, 0) / this.metrics.dbInsertTimes.length;

        return {
            totalChunks: this.metrics.totalChunks,
            errorCount: this.metrics.errors,
            averageProcessingTimeMs: avgProcessingTime.toFixed(2),
            averageEmbeddingTimeMs: avgEmbeddingTime.toFixed(2),
            averageDbInsertTimeMs: avgDbInsertTime.toFixed(2)
        };
    }
}

// Example usage
const main = async () => {
    const processor = new MeetingProcessor();
    
    try {
        await processor.initialize();

        // Extended test data
        const simulatedMeetingText = [
            "Today we discussed the Q4 sales projections for our new product line.",
            "The marketing team presented their campaign strategy for social media.",
            "We agreed to increase the advertising budget by 25% for the next quarter.",
            "Team leads expressed concerns about supply chain delays affecting delivery timelines.",
            "Action items were assigned to each department head for follow-up next week.",
            "The engineering team reported successful completion of the new feature rollout.",
            "Customer satisfaction metrics showed a 15% improvement over last quarter.",
            "We discussed potential expansion into international markets next year.",
            "HR presented updates on the new hiring initiative for Q1.",
            "The meeting concluded with a Q&A session addressing employee concerns."
        ];

        // Process chunks with error handling
        for (const chunk of simulatedMeetingText) {
            try {
                await processor.processTextChunk(chunk);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Failed to process chunk: "${chunk}"`, error);
            }
        }

        // Generate and test summary
        const summary = await processor.generateMeetingSummary();
        console.log('\nMeeting Summary:', summary);

        // Test similarity search with various queries
        const searchQueries = [
            "marketing budget",
            "engineering updates",
            "customer satisfaction",
            "hiring plans"
        ];

        for (const query of searchQueries) {
            console.log(`\nFinding chunks related to "${query}":`);
            const similarChunks = await processor.findSimilarChunks(query);
            similarChunks.forEach(chunk => {
                console.log(`Similarity: ${chunk.similarity.toFixed(4)} - "${chunk.chunked_data}"`);
            });
        }

        // Display metrics
        console.log('\nProcessing Metrics:', processor.getMetrics());

    } catch (error) {
        console.error('Error in main process:', error);
    } finally {
        await processor.cleanup();
    }
};

main();