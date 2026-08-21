const axios = require('axios');
const env = require('../../../config/env');

const LINK_REQUEST_PATTERNS = [
  /spill\s*(link|toko|produk|min|kak|dong)?/i,
  /minta\s*link/i,
  /bagi\s*link/i,
  /beli\s*di\s*mana/i,
  /dimana\s*beli/i,
  /link\s*(nya|shopee|dong|kak|min|plis|please)/i,
  /tumpah\s*link/i,
  /mau\s*(dong|kak|link|ini)/i,
  /info\s*(toko|produk|olshop|olshopnya|link)/i,
  /harga\s*berapa/i,
  /berapaan/i,
  /ada\s*link/i,
  /pesen\s*dimana/i,
  /order\s*dimana/i,
];

const NEGATIVE_PATTERNS = [
  /penipu/i,
  /scam/i,
  /jelek\s*banget/i,
  /rusak/i,
  /mahal\s*banget/i,
  /sampah/i,
  /hoax/i,
  /bohong/i,
];

/**
 * Mengklasifikasi intensi komentar penonton Threads
 * @param {string} text - Teks komentar
 * @returns {Promise<{ intent: 'LINK_REQUEST'|'PRODUCT_QUESTION'|'GENERAL_APPRECIATION'|'NEGATIVE'|'IRRELEVANT', confidence: number, reasoning: string }>}
 */
async function classifyCommentIntent(text = '') {
  const clean = String(text || '').trim();
  if (!clean) {
    return { intent: 'IRRELEVANT', confidence: 1.0, reasoning: 'Teks kosong.' };
  }

  // 1. Check Negative Sentiment First
  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        intent: 'NEGATIVE',
        confidence: 0.95,
        reasoning: 'Terdeteksi sentimen negatif / keluhan.',
      };
    }
  }

  // 2. Fast-Path Pattern Matcher
  for (const pattern of LINK_REQUEST_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        intent: 'LINK_REQUEST',
        confidence: 0.96,
        reasoning: `Cocok dengan pola kata kunci permintaan link: ${pattern.toString()}`,
      };
    }
  }

  // 3. LLM Fallback (jika apiKey tersedia)
  if (env.mistralApiKey) {
    try {
      const prompt = `Klasifikasikan komentar media sosial berikut ke dalam salah satu kategori:
1. LINK_REQUEST (pengguna ingin link pembelian produk / bertanya tempat beli)
2. PRODUCT_QUESTION (pertanyaan spesifik detail produk seperti ukuran/warna/bahan)
3. GENERAL_APPRECIATION (pujian umum tanpa mencari link seperti "bagus ya", "lucu")
4. NEGATIVE (keluhan, marah, penipuan)
5. IRRELEVANT (tidak nyambung / spam / candaan)

Komentar: "${clean}"

Jawab HANYA dalam format JSON valid:
{"intent": "LINK_REQUEST|PRODUCT_QUESTION|GENERAL_APPRECIATION|NEGATIVE|IRRELEVANT", "confidence": 0.0-1.0, "reasoning": "penjelasan singkat"}`;

      const response = await axios.post(
        'https://api.mistral.ai/v1/chat/completions',
        {
          model: env.mistralModel || 'mistral-small-latest',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 150,
          temperature: 0.1,
        },
        { headers: { Authorization: `Bearer ${env.mistralApiKey}` }, timeout: 8000 }
      );

      const parsed = JSON.parse(response.data?.choices?.[0]?.message?.content || '{}');
      if (parsed.intent) {
        return {
          intent: parsed.intent,
          confidence: Number(parsed.confidence) || 0.85,
          reasoning: parsed.reasoning || 'Evaluasi model AI',
        };
      }
    } catch (_) {
      // Abaikan error LLM dan lanjutkan ke fallback
    }
  }

  // 4. Default Fallback
  return {
    intent: 'GENERAL_APPRECIATION',
    confidence: 0.60,
    reasoning: 'Komentar umum tanpa indikasi langsung permintaan link.',
  };
}

module.exports = {
  classifyCommentIntent,
  LINK_REQUEST_PATTERNS,
};
