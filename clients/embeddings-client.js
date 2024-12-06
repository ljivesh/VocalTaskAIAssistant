import { pipeline, env } from '@xenova/transformers';

class E5EmbeddingClient {
  constructor(config = {}) {
    this.model = config.model || 'Xenova/e5-small';
    this.batchSize = config.batchSize || 32;
    this.embedder = null;
  }

  async initialize() {
    if (!this.embedder) {
      this.embedder = await pipeline('feature-extraction', this.model);
    }
  }

  async embed(texts) {
    await this.initialize();

    // Ensure texts is an array
    const inputTexts = Array.isArray(texts) ? texts : [texts];
    
    // Format texts according to E5 requirements
    const formattedTexts = inputTexts.map(text => 
      text.startsWith('query: ') || text.startsWith('passage: ') 
        ? text 
        : `passage: ${text}`
    );

    try {
      // Generate embeddings
      const embeddings = await Promise.all(
        formattedTexts.map(async (text) => {
          const output = await this.embedder(text, {
            pooling: 'mean',
            normalize: true
          });
          // Convert output.data to Array if it isn't already
          return Array.from(output.data);
        })
      );

      // Handle single input case
      return Array.isArray(texts) ? embeddings : embeddings[0];

    } catch (error) {
      console.error('Embedding error:', error);
      throw error;
    }
  }

  // Helper method for batched processing of large text arrays
  async embedBatch(texts) {
    const batches = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      batches.push(texts.slice(i, i + this.batchSize));
    }

    const embeddings = [];
    for (const batch of batches) {
      const batchEmbeddings = await this.embed(batch);
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  // Utility method to calculate cosine similarity between two embeddings
  cosineSimilarity(embeddingA, embeddingB) {
    const dotProduct = embeddingA.reduce((sum, a, i) => sum + a * embeddingB[i], 0);
    const magnitudeA = Math.sqrt(embeddingA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(embeddingB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Search for most similar texts given a query
  async search(query, textCorpus, topK = 5) {
    const queryEmbedding = await this.embed(`query: ${query}`);
    const corpusEmbeddings = await this.embedBatch(textCorpus);

    const similarities = corpusEmbeddings.map((embedding, index) => ({
      text: textCorpus[index],
      similarity: this.cosineSimilarity(queryEmbedding, embedding),
      index
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}

export default E5EmbeddingClient;