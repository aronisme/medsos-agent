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
      let finalUserPrompt = userPrompt;
      if (jsonMode && !finalUserPrompt.toLowerCase().includes('json')) {
        finalUserPrompt += '\n\nPlease return a valid JSON object.';
      }
      messages.push({ role: 'user', content: finalUserPrompt });

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
 * Panggilan ke xKiro AI API (Qwen Flagship) - Mendukung Text, Image/Vision & Multimodal Video
 */
async function callXKiroAPI({
  systemPrompt,
  userPrompt,
  imageUrl,
  videoUrl,
  model,
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
    model: model || env.xkiroModel || 'qwen/qwen3.8-max',
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
 * Fungsi Analisis Video Produk Shopee / Video Promosi menggunakan Qwen AI
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
    // 1. Coba menggunakan Qwen (xKiro)
    if (env.xkiroApiKey) {
      try {
        return await callXKiroAPI({
          systemPrompt: systemPrompt || 'Kamu adalah Social Media Video Content Specialist. Analisis video produk Shopee ini dan buatkan copywriting yang sangat menjual.',
          userPrompt: defaultPrompt,
          videoUrl,
          maxTokens
        });
      } catch (err) {
        console.warn(`[analyzeVideoWithAI] Qwen video processing error: ${err.message}`);
      }
    }

    throw new Error('Analisis video memerlukan XKIRO_API_KEY aktif dengan model Qwen.');
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
 * Dedicated Copywriting AI Caller dengan Failover Chain Bertingkat:
 * 1. Tier 1 (PAYG Flagship): x-ai/grok-4.6 (Karakter paling organik & punchy)
 * 2. Tier 2 (Free Top 1): qwen/qwen3.8-max:free (Arena #11, Creative & Unit-Price Reasoning)
 * 3. Tier 3 (Free Top 2): deepseek/deepseek-v4-pro (Arena Creative #6, Storytelling Persona)
 * 4. Tier 4 (Free Top 3): qwen/qwen3-max:free (Qwen3 Max Backup)
 * 5. Tier 5 (Free Alternatives): mistralai/mistral-medium-3.5 -> minimax/minimax-m2.7-highspeed -> deepseek/deepseek-v4-flash
 * 6. Tier 6 (Safety Net): Groq AI Multi-Key (gpt-oss-120b) -> Mistral Direct (mistral-small-latest)
 */
async function callCopywritingAI(options = {}) {
  const {
    systemPrompt = '',
    userPrompt = '',
    temperature = 0.8,
    maxTokens = 600,
    jsonMode = false,
  } = options;

  return globalAIQueue.enqueue(async () => {
    // 1. Coba model-model unggulan dari xKiro API
    if (env.xkiroApiKey) {
      const copywritingModels = [
        'x-ai/grok-4.6',                   // Tier 1: PAYG Flagship
        'qwen/qwen3.8-max:free',           // Tier 2: FREE Top 1 (Creative & Value Shock)
        'deepseek/deepseek-v4-pro',        // Tier 3: FREE Top 2 (Deep Reasoning & Relatable Story)
        'qwen/qwen3-max:free',             // Tier 4: FREE Top 3 (Stable Baseline)
        'mistralai/mistral-medium-3.5',    // Tier 5a: Mistral Medium 3.5
        'minimax/minimax-m2.7-highspeed',  // Tier 5b: MiniMax M2.7 Highspeed
        'deepseek/deepseek-v4-flash',      // Tier 5c: DeepSeek V4 Flash
      ];

      for (const model of copywritingModels) {
        try {
          const res = await callXKiroAPI({
            systemPrompt,
            userPrompt,
            model,
            temperature,
            maxTokens,
            jsonMode
          });
          if (res) return res;
        } catch (modelErr) {
          const errMsg = modelErr.response?.data?.error?.message || modelErr.message;
          console.warn(`[callCopywritingAI] Model ${model} dilewati (${errMsg}). Mengalihkan ke tier berikutnya...`);
        }
      }
    }

    // 2. Fallback ke Groq AI Multi-Key (3 API Keys LPU Rotator)
    try {
      return await callGroqAPI({ systemPrompt, userPrompt, temperature, maxTokens, jsonMode });
    } catch (groqErr) {
      console.warn(`[callCopywritingAI] Groq Multi-Key gagal: ${groqErr.message}. Mengalihkan ke Mistral Direct...`);
    }

    // 3. Fallback ke Mistral Direct (mistral-small-latest)
    try {
      return await callMistralDirect({ systemPrompt, userPrompt, temperature, maxTokens, jsonMode });
    } catch (mistralErr) {
      console.warn(`[callCopywritingAI] Mistral Direct gagal: ${mistralErr.message}`);
    }

    // 4. Emergency Fallback
    if (jsonMode) {
      return JSON.stringify({
        hook: 'JAMAN SERBA MAHAL GINI 😭 nemu barang sebagus ini harganya aman di dompet',
        body_insight: 'Bikin aktivitas harian jadi lebih simpel dan effortless',
        usp_bullets: '• Kualitas original terbaik\n• Bikin aman dompet\n• Terbukti bermanfaat',
        cta_type: 'soft_cta',
        cta_text: 'detailnya aku spill di reply ya 👇',
        first_reply_intro: 'Spill link produk aslinya di sini ya 👇'
      });
    }

    return 'Rekomendasi produk pilihan terbaik di Shopee dengan harga promo spesial!';
  });
}

/**
 * Unified AI Caller untuk Profiling, Diagnosa, dan Metadata (Groq / Mistral / Qwen Flagship)
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
    // 1. Tier 1 (Utama): xKiro AI (Qwen Flagship) jika API key dikonfigurasi
    if (env.xkiroApiKey) {
      try {
        const xkiroRes = await callXKiroAPI({ systemPrompt, userPrompt, temperature, maxTokens, jsonMode });
        return xkiroRes;
      } catch (xkiroErr) {
        console.warn(`[callUnifiedAI] Tier 1 (xKiro Qwen) gagal: ${xkiroErr.message}. Mengalihkan ke Tier 2 (Mistral)...`);
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
        niche: 'Universal',
        target_audience: 'Pembeli Online Indonesia',
        pain_points: ['Mencari produk berkualitas harga terjangkau'],
        usp: ['Original', 'Harga Terjangkau', 'Pengiriman Cepat'],
        price_tier: 'Mid-Range',
        recommended_angles: ['Problem-Agitate-Solution', 'Honest Review'],
        key_features_summary: 'Produk rekomendasi pilihan terbaik di Shopee'
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
  callCopywritingAI,
  callMistralAI,
  callXKiroAPI,
  callMistralDirect,
  analyzeImageWithMistral,
  analyzeVideoWithAI,
  callGroqAPI,
  groqRotator
};
