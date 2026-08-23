const axios = require('axios');
const env = require('../../../config/env');

const LINK_REQUEST_PATTERNS = [
  /spill/i,
  /link\s*(?:dong|kak|min|plis|pls|nya|shopee|mana|beli|order)?/i,
  /(?:minta|bagi|kasih|share|dm|pm|inbox)\s*(?:link|toko|olshop|info|shopee|produk)/i,
  /(?:beli|order|pesan|checkout|dapet|dpt|co|belinya)\s*(?:di\s*mana|dimana|dmana|lewat\s*mana|dmn)/i,
  /(?:ada\s+)?link(?:nya)?/i,
  /mau\s+(?:dong|kak|min|link|ini|beli|order|co)/i,
  /info\s*(?:toko|produk|olshop|olshopnya|link|penjual|shopee)/i,
  /nama\s*(?:toko|olshop|produk|barangnya|store|brand|shopee)/i,
  /(?:harga|harganya|hrg)\s*(?:berapa|brp|berapaan)/i,
  /berapaan/i,
  /belinya\s+dimana/i,
  /belinya\s+dmn/i,
  /beli\s+dimana/i,
  /beli\s+dmn/i,
  /cek\s+link/i,
  /linknya\s+mana/i,
  /shopee\s+link/i,
  /tumpah\s*link/i,
  /racun\s*(?:shopee|link|dong)/i,
];

const PRODUCT_QUESTION_PATTERNS = [
  /(?:bahan|bahannya|material)\s*(?:apa|gimana|adem)/i,
  /(?:ukuran|size|ld|panjang)\s*(?:berapa|apa|ada)/i,
  /(?:warna|color|varian)\s*(?:apa\s*aja|ada\s*apa)/i,
  /(?:muat|cukup)\s*(?:bb|berat\s*badan|tb)/i,
  /(?:bisa|support)\s*cod/i,
  /(?:ready|ada)\s*(?:stok|stock|ga|nggak|gak)/i,
  /ori\s*(?:ga|nggak|gak|bukan)/i,
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
  /kecewa/i,
  /palsu/i,
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

  // 2. Fast-Path Pattern Matcher: Link Request
  for (const pattern of LINK_REQUEST_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        intent: 'LINK_REQUEST',
        confidence: 0.96,
        reasoning: `Cocok dengan pola kata kunci permintaan link: ${pattern.toString()}`,
      };
    }
  }

  // 3. Fast-Path Pattern Matcher: Product Detail Question
  for (const pattern of PRODUCT_QUESTION_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        intent: 'PRODUCT_QUESTION',
        confidence: 0.92,
        reasoning: `Cocok dengan pertanyaan spesifikasi produk: ${pattern.toString()}`,
      };
    }
  }

  // 4. LLM Fallback (jika apiKey tersedia)
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
      // Ignore LLM error and fallback
    }
  }

  return {
    intent: 'IRRELEVANT',
    confidence: 0.70,
    reasoning: 'Komentar tidak mengandung kata kunci permintaan link atau pertanyaan produk.',
  };
}

module.exports = {
  classifyCommentIntent,
  LINK_REQUEST_PATTERNS,
  PRODUCT_QUESTION_PATTERNS,
  NEGATIVE_PATTERNS,
};
