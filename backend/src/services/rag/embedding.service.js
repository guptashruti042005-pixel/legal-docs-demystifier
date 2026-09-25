const { GoogleGenerativeAI } = require('@google/generative-ai');

class EmbeddingService {
  constructor() {
    this.genAI = null;
    this.model = null;
  }

  /**
   * Initializes generative AI model for embeddings.
   */
  init() {
    if (!this.genAI && process.env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    }
  }

  /**
   * Generates embedding vector for a given text.
   * Google's gemini-embedding-001 model generates embedding vectors.
   * @param {string} text - Text to embed
   * @returns {Promise<Array<number>>} Embedding float array
   */
  async generateEmbedding(text) {
    this.init();

    if (!this.model) {
      console.warn('GEMINI_API_KEY not configured. Generating dummy mock embedding vector for development.');
      // Return a dummy 768-dimension vector
      return Array.from({ length: 768 }, () => Math.random() - 0.5);
    }

    try {
      const response = await this.model.embedContent({
        content: { parts: [{ text }] }
      });
      if (response && response.embedding && response.embedding.values) {
        return response.embedding.values;
      }
      throw new Error('Invalid embedding response format from Google AI');
    } catch (err) {
      console.error('Google Embedding API error:', err.message);
      // Fallback to random dummy vector in case of rate limits / network failure
      return Array.from({ length: 768 }, () => Math.random() - 0.5);
    }
  }
}

module.exports = new EmbeddingService();
