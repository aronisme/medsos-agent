const axios = require('axios');
const env = require('../../config/env');

/**
 * Groq Multi-Key Rotator with Thread-Safe Round-Robin & Failover
 */
class GroqKeyRotator {
  constructor(keys = []) {
    this.keys = Array.isArray(keys) && keys.length > 0 ? keys : [];
    this.currentIndex = 0;
  }

  getNextKey() {
    if (this.keys.length === 0) return null;
    const key = this.keys[this.currentIndex % this.keys.length];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }

  getAllKeys() {
    return [...this.keys];
  }
}

const groqRotator = new GroqKeyRotator(env.groqApiKeys);

/**
 * Queue & Rate-Limiting Engine untuk Eksekusi AI
 */
class AIQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

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
      const result = await taskFn();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.running--;
      this.processNext();
    }
  }
}

const globalAIQueue = new AIQueue(2);

/**
 * Panggilan ke Groq API dengan rotasi multi-key
 */
async function callGroqAPI({ systemPrompt, userPrompt, temperature = 0.7, maxTokens = 600, jsonMode = false, fastMode = false }) {
  const keys = groqRotator.getAllKeys();
  if (keys.length === 0) {
    throw new Error('Tidak ada GROQ_API_KEYS yang dikonfigurasi.');
  }

  const model = fastMode ? (env.groqModelFast || 'openai/gpt-oss-20b') : (env.groqModelPrimary || 'openai/gpt-oss-120b');
  let lastError = null;

  // Coba semua key yang tersedia secara bergantian jika salah satu terkena limit
  for (let i = 0; i < keys.length; i++) {
    const activeKey = groqRotator.getNextKey();
    try {
      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: userPrompt });

      const payload = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      };

      if (jsonMode) {
        payload.response_format = { type: 'json_object' };
      }

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        payload,
        {
          headers: {
            'Authorization': `Bearer ${activeKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 12000 // 12s timeout for ultra-fast Groq LPU
        }
      );

      const content = response.data?.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error(`Groq model ${model} mengembalikan respons kosong.`);
      }

      return content;
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      const errMsg = err.response?.data?.error?.message || err.message;
      console.warn(`[Groq Key Warning] Key ${activeKey?.slice(0, 10)}... gagal (${status}): ${errMsg}. Mencoba key berikutnya...`);
    }
  }

  throw new Error(`Semua ${keys.length} Groq API keys gagal: ${lastError?.message}`);
}

/**
 * Panggilan ke xKiro AI API (Ox Alpha) - Mendukung Text, Image/Vision & Multimodal Video
 */
async function callXKiroAPI({
  systemPrompt,
  userPrompt,
  imageUrl,
  videoUrl,
  temperature = 0.7,
  maxTokens = 600,
  jsonMode = false
}) {
  if (!env.xkiroApiKey) {
    throw new Error('XKIRO_API_KEY belum dikonfigurasi.');
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  // Bangun konten multimodal (Text + Video / Image)
  if (videoUrl || imageUrl) {
    const userContent = [];
    if (userPrompt) {
      userContent.push({ type: 'text', text: userPrompt });
    }
    if (videoUrl) {
      userContent.push({ type: 'video_url', video_url: { url: videoUrl } });
    }
    if (imageUrl) {
      userContent.push({ type: 'image_url', image_url: { url: imageUrl } });
    }
    messages.push({ role: 'user', content: userContent });
  } else {
    messages.push({ role: 'user', content: userPrompt });
  }

  const payload = {
    model: env.xkiroModel || 'ox-alpha',
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await axios.post(
    `${env.xkiroBaseUrl || 'https://api.xkiro.com/v1'}/chat/completions`,
    payload,
    {
      headers: {
        'Authorization': `Bearer ${env.xkiroApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 35000 // 35s timeout untuk proses multimodal video
    }
  );

  const content = response.data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('xKiro AI mengembalikan respons kosong.');
  }

  return content;
}

/**
 * Fungsi Analisis Video Produk Shopee / Video Promosi menggunakan Ox Alpha
 * @param {Object} opts
 * @param {string} opts.videoUrl - URL publik video (Shopee Video, MP4, dsb)
 * @param {string} [opts.prompt] - Instruksi analisis video
 * @param {string} [opts.systemPrompt] - System prompt
 * @param {number} [opts.maxTokens]
 * @returns {Promise<string>}
 */
async function analyzeVideoWithAI({ videoUrl, prompt, systemPrompt = '', maxTokens = 600 }) {
  if (!videoUrl) {
    throw new Error('URL video wajib disertakan.');
  }

  const defaultPrompt = prompt || 'Analisis video produk ini: jelaskan fitur unggulan produk, apa yang sedang didemonstrasikan, dan buatkan ringkasan menarik untuk caption affiliate marketing.';
  
  return globalAIQueue.enqueue(async () => {
    // 1. Coba menggunakan Ox Alpha (xKiro)
    if (env.xkiroApiKey) {
      try {
        return await callXKiroAPI({
          systemPrompt: systemPrompt || 'Kamu adalah Social Media Video Content Specialist. Analisis video produk Shopee ini dan buatkan copywriting yang sangat menjual.',
          userPrompt: defaultPrompt,
          videoUrl,
          maxTokens
        });
      } catch (err) {
        console.warn(`[analyzeVideoWithAI] Ox Alpha video processing error: ${err.message}`);
      }
    }

    throw new Error('Analisis video memerlukan XKIRO_API_KEY aktif dengan model Ox Alpha.');
  });
}

/**
 * Panggilan ke Mistral AI API (Fallback Cadangan)
 */
async function callMistralDirect({ systemPrompt, userPrompt, temperature = 0.7, maxTokens = 600, jsonMode = false }) {
  if (!env.mistralApiKey) {
    throw new Error('MISTRAL_API_KEY tidak dikonfigurasi.');
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });

  const payload = {
    model: env.mistralModel || 'mistral-small-latest',
    messages,
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
      timeout: 20000 // 20s timeout
    }
  );

  const content = response.data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Mistral AI mengembalikan respons kosong.');
  }

  return content;
}

/**
 * Panggilan ke Mistral AI Vision (Multimodal Image Understanding)
 */
async function analyzeImageWithMistral({ imageUrl, prompt, systemPrompt = '', maxTokens = 400, temperature = 0.5 }) {
  if (!env.mistralApiKey) {
    throw new Error('MISTRAL_API_KEY tidak dikonfigurasi untuk fungsi Vision.');
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: prompt || 'Analisis gambar produk ini secara detail untuk keperluan affiliate marketing.' },
      { type: 'image_url', image_url: { url: imageUrl } }
    ]
  });

  const payload = {
    model: env.mistralModel || 'mistral-small-latest',
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  const response = await axios.post(
    'https://api.mistral.ai/v1/chat/completions',
    payload,
    {
      headers: {
        'Authorization': `Bearer ${env.mistralApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 25000
    }
  );

  const content = response.data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Mistral Vision mengembalikan respons kosong.');
  }

  return content;
}

/**
 * Unified AI Caller dengan Hierarki Failover Bertingkat:
 * 1. Tier 1 (Utama): xKiro AI (Ox Alpha - jika XKIRO_API_KEY diisi)
 * 2. Tier 2 (Cadangan Utama / Vision): Mistral AI (mistral-small-latest)
 * 3. Tier 3 (Cadangan Cepat): Groq AI Multi-Key (openai/gpt-oss-120b / 20b)
 * 4. Tier 4 (Emergency): Structured Local Fallback
 */
async function callUnifiedAI(options = {}) {
  const {
    systemPrompt = '',
    userPrompt = '',
    temperature = 0.7,
    maxTokens = 600,
    jsonMode = false,
    fastMode = false
  } = options;

  return globalAIQueue.enqueue(async () => {
    // 1. Tier 1 (Utama): xKiro AI (Ox Alpha) jika API key dikonfigurasi
    if (env.xkiroApiKey) {
      try {
        const xkiroRes = await callXKiroAPI({ systemPrompt, userPrompt, temperature, maxTokens, jsonMode });
        return xkiroRes;
      } catch (xkiroErr) {
        console.warn(`[callUnifiedAI] Tier 1 (xKiro Ox Alpha) gagal: ${xkiroErr.message}. Mengalihkan ke Tier 2 (Mistral)...`);
      }
    }

    // 2. Tier 2 (Vision & Multimodal Text Fallback): Mistral AI
    try {
      const mistralRes = await callMistralDirect({ systemPrompt, userPrompt, temperature, maxTokens, jsonMode });
      return mistralRes;
    } catch (mistralErr) {
      console.warn(`[callUnifiedAI] Tier 2 (Mistral) gagal: ${mistralErr.message}. Mengalihkan ke Tier 3 (Groq)...`);
    }

    // 3. Tier 3 (Ultra-Fast Fallback): Groq AI Multi-Key Rotator
    try {
      const groqRes = await callGroqAPI({ systemPrompt, userPrompt, temperature, maxTokens, jsonMode, fastMode });
      return groqRes;
    } catch (groqErr) {
      console.warn(`[callUnifiedAI] Tier 3 (Groq Multi-Key) gagal: ${groqErr.message}. Menggunakan Tier 4 Emergency.`);
    }

    // 4. Tier 4: Emergency Fallback
    if (jsonMode) {
      return JSON.stringify({
        hook: 'Rekomendasi racun shopee yang wajib kamu punya! ✨',
        pain_point_text: 'Bikin aktivitas harian jadi lebih simpel dan praktis',
        usp_bullets: '• Kualitas original terbaik\n• Promo terbatas\n• Terbukti bermanfaat',
        hashtags: '#RacunShopee #ShopeeAffiliate #PromoSpesial'
      });
    }

    return 'Rekomendasi produk pilihan terbaik di Shopee dengan harga promo spesial! Jangan lewatkan kesempatan ini.';
  });
}

/**
 * Backwards-compatibility wrapper
 */
async function callMistralAI(options) {
  return callUnifiedAI(options);
}

module.exports = {
  globalAIQueue,
  callUnifiedAI,
  callMistralAI,
  callXKiroAPI,
  callMistralDirect,
  analyzeImageWithMistral,
  analyzeVideoWithAI,
  callGroqAPI,
  groqRotator
};
