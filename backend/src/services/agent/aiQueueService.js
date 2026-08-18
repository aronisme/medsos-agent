const axios = require('axios');
const env = require('../../config/env');

/**
 * Queue & Rate-Limiting Engine untuk Single AI API Key
 * Menjalankan request AI secara sequential dengan Automatic Retry & Exponential Backoff
 */

class AIQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  /**
   * Menambahkan tugas ke dalam antrean
   * @param {Function} taskFn - async function yang memanggil AI
   * @returns {Promise<any>}
   */
  enqueue(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject });
      this.processNext();
    });
  }

  async processNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { taskFn, resolve, reject } = this.queue.shift();

    try {
      const result = await this.executeWithRetry(taskFn, 3);
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.running--;
      this.processNext();
    }
  }

  /**
   * Eksekusi dengan retry exponential backoff (1s, 2s, 4s)
   */
  async executeWithRetry(fn, maxRetries = 3) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const isRateLimitOrTimeout = err.code === 'ECONNABORTED' || err.response?.status === 429 || err.response?.status >= 500;
        
        console.warn(`[AIQueue Warning] Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
        
        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }
    throw lastError;
  }
}

const globalAIQueue = new AIQueue(1);

/**
 * Memanggil Mistral Chat Completion via AI Queue yang terlindungi
 * @param {Object} opts
 * @param {string} opts.systemPrompt
 * @param {string} opts.userPrompt
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @param {boolean} [opts.jsonMode]
 * @returns {Promise<string>}
 */
async function callMistralAI({
  systemPrompt,
  userPrompt,
  temperature = 0.7,
  maxTokens = 600,
  jsonMode = false
}) {
  return globalAIQueue.enqueue(async () => {
    if (!env.mistralApiKey) {
      throw new Error('MISTRAL_API_KEY belum dikonfigurasi di file .env');
    }

    const payload = {
      model: env.mistralModel || 'mistral-small-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      max_tokens: maxTokens,
    };

    if (jsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    const response = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${env.mistralApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 25000 // 25s timeout
      }
    );

    const content = response.data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Mistral AI tidak mengembalikan konten respons.');
    }

    return content;
  });
}

module.exports = {
  globalAIQueue,
  callMistralAI,
};
