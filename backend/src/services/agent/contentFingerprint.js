const crypto = require('crypto');

/**
 * Stopwords dasar bahasa Indonesia & simbol untuk ekstraksi token murni
 */
const STOPWORDS = new Set([
  'yang', 'untuk', 'pada', 'ke', 'para', 'namun', 'menurut', 'antara', 'dia', 'dua',
  'ia', 'seperti', 'jika', 'sehingga', 'kembali', 'dan', 'ini', 'karena', 'oleh',
  'saat', 'harus', 'sementara', 'setelah', 'belum', 'kami', 'sekitar', 'bagi',
  'serta', 'di', 'dari', 'dengan', 'ada', 'bisa', 'akan', 'sudah', 'atau', 'kamu',
  'aku', 'kalian', 'mereka', 'kita', 'buat', 'dalam', 'jadi', 'aja', 'ya', 'banget',
  'deh', 'nih', 'dong', 'yuk', 'cek', 'link', 'bio', 'klik', 'promo', 'shopee'
]);

/**
 * Frasa Klise Robotik / AI Bot (Layer 1 Blacklist)
 */
const ROBOT_CLICHE_PATTERNS = [
  /solusi\s+(terbaiknya|terbaik|tepat|sempurna)/i,
  /keunggulan\s+(produk|utama|ini)/i,
  /fitur\s+(unggulan|utama)/i,
  /spesifikasi\s+(produk|lengkap)?/i,
  /kelebihan\s+(produk|ini)/i,
  /kenapa\s+(harus|wajib)\s+(checkout|beli|punya)/i,
  /alasan\s+(harus|wajib)\s+punya/i,
  /mengapa\s+(harus|memilih)/i,
  /harga\s*(promo|diskon)?\s*:\s*rp/i,
  /harganya\s+(cuma\s+)?rp\s*\d+/i,
  /\brp\s*\d{1,3}(\.\d{3})+/i, // contoh: Rp 84.498, Rp11.980, Rp63.000
  /\bpas\s+diskon\s+\d+%/i,     // contoh: pas diskon 31%
  /dapatkan\s+sekarang\s+juga\s+di/i,
  /segera\s+amankan\s+slot/i,
  /rekomendasi\s+racun\s+shopee\s+yang\s+wajib\s+kamu\s+punya/i,
];

/**
 * Deteksi pola robotik 2 lapis (Layer 1: Blacklisted Cliché, Layer 2: Structural AI Outline)
 * @param {string} text
 * @returns {Object} { is_robot: boolean, reasons: string[] }
 */
function detectRobotClichés(text = '') {
  if (!text) return { is_robot: false, reasons: [] };
  const clean = String(text).trim();
  const reasons = [];

  // Layer 1: Deterministic Cliché Frasa
  for (const pattern of ROBOT_CLICHE_PATTERNS) {
    if (pattern.test(clean)) {
      reasons.push(`Terdeteksi frasa klise robotik: "${pattern.source}"`);
    }
  }

  // Layer 2: Structural Outline (Bullet Points Robotik)
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  let bulletLineCount = 0;
  for (const line of lines) {
    if (/^[•\-\*]\s+/i.test(line) || /^\d+[\.\)]\s+/i.test(line)) {
      bulletLineCount++;
    }
    // Deteksi label kaku seperti "Hook:", "Pain Point:", "Benefits:", "CTA:"
    if (/^(hook|pain point|keunggulan|fitur|benefits|cta|solusi)\s*:/i.test(line)) {
      reasons.push(`Terdeteksi format outline kaku: "${line}"`);
    }
  }

  if (bulletLineCount >= 3) {
    reasons.push(`Terdeteksi struktur bullet point robotik (${bulletLineCount} baris bullet).`);
  }

  return {
    is_robot: reasons.length > 0,
    reasons
  };
}

/**
 * Ekstraksi token kata kunci penting dari teks
 * @param {string} text
 * @returns {Set<string>}
 */
function extractCoreTokens(text = '') {
  if (!text) return new Set();
  const cleaned = String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ');
  const tokenSet = new Set();

  words.forEach(w => {
    if (w.length >= 3 && !STOPWORDS.has(w)) {
      tokenSet.add(w);
    }
  });

  return tokenSet;
}

/**
 * Menghitung Content Fingerprint Hash
 */
function generateContentFingerprint({ productId, hookText, captionText = '', mediaUrl = '' }) {
  const combined = `${productId}__${hookText}__${captionText.slice(0, 100)}__${mediaUrl}`;
  return 'fp_' + crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
}

/**
 * Menghitung character 3-gram set dari teks
 */
function extractNGrams(text = '', n = 3) {
  const cleaned = String(text).toLowerCase().replace(/\s+/g, ' ').trim();
  const ngrams = new Set();
  if (cleaned.length < n) {
    if (cleaned.length > 0) ngrams.add(cleaned);
    return ngrams;
  }
  for (let i = 0; i <= cleaned.length - n; i++) {
    ngrams.add(cleaned.substring(i, i + n));
  }
  return ngrams;
}

/**
 * Menghitung derajat kemiripan token Jaccard & N-gram Similarity (0.0 - 1.0)
 */
function calculateTokenSimilarity(textA, textB) {
  const tokensA = extractCoreTokens(textA);
  const tokensB = extractCoreTokens(textB);

  // 1. Word Token Jaccard
  let tokenSim = 0;
  if (tokensA.size > 0 && tokensB.size > 0) {
    let intersectionCount = 0;
    tokensA.forEach(t => {
      if (tokensB.has(t)) intersectionCount++;
    });
    const unionCount = new Set([...tokensA, ...tokensB]).size;
    tokenSim = unionCount > 0 ? intersectionCount / unionCount : 0;
  }

  // 2. Character N-Gram Jaccard
  const ngramsA = extractNGrams(textA, 3);
  const ngramsB = extractNGrams(textB, 3);
  let ngramSim = 0;
  if (ngramsA.size > 0 && ngramsB.size > 0) {
    let nIntersection = 0;
    ngramsA.forEach(g => {
      if (ngramsB.has(g)) nIntersection++;
    });
    const nUnion = new Set([...ngramsA, ...ngramsB]).size;
    ngramSim = nUnion > 0 ? nIntersection / nUnion : 0;
  }

  // Kombinasi berbobot: 60% Word Token + 40% N-Gram
  return (tokenSim * 0.6) + (ngramSim * 0.4);
}

/**
 * Menghitung Composite Similarity Score (Semantic, Lexical, Structural, Hook, CTA)
 */
function calculateCompositeSimilarity(textA = '', textB = '', metaA = {}, metaB = {}) {
  if (!textA || !textB) return 0;

  // 1. Semantic Core Token Similarity (35%)
  const tokensA = extractCoreTokens(textA);
  const tokensB = extractCoreTokens(textB);
  let semanticSim = 0;
  if (tokensA.size > 0 && tokensB.size > 0) {
    let inter = 0;
    tokensA.forEach(t => { if (tokensB.has(t)) inter++; });
    const un = new Set([...tokensA, ...tokensB]).size;
    semanticSim = un > 0 ? inter / un : 0;
  }

  // 2. Lexical N-Gram Similarity (25%)
  const ngA = extractNGrams(textA, 3);
  const ngB = extractNGrams(textB, 3);
  let lexicalSim = 0;
  if (ngA.size > 0 && ngB.size > 0) {
    let inter = 0;
    ngA.forEach(g => { if (ngB.has(g)) inter++; });
    const un = new Set([...ngA, ...ngB]).size;
    lexicalSim = un > 0 ? inter / un : 0;
  }

  // 3. Structural Similarity (20%) - Length ratio & line structure
  const lenRatio = Math.min(textA.length, textB.length) / Math.max(textA.length, textB.length || 1);
  const linesA = textA.split('\n').filter(Boolean).length;
  const linesB = textB.split('\n').filter(Boolean).length;
  const lineRatio = Math.min(linesA, linesB) / Math.max(linesA, linesB || 1);
  const structuralSim = (lenRatio * 0.5) + (lineRatio * 0.5);

  // 4. Hook Similarity (10%)
  const hookA = metaA.hook || textA.split('\n')[0] || '';
  const hookB = metaB.hook || textB.split('\n')[0] || '';
  const hookSim = calculateTokenSimilarity(hookA, hookB);

  // 5. CTA Similarity (10%)
  const ctaA = metaA.cta || (textA.split('\n').slice(-2).join(' ')) || '';
  const ctaB = metaB.cta || (textB.split('\n').slice(-2).join(' ')) || '';
  const ctaSim = calculateTokenSimilarity(ctaA, ctaB);

  const composite = (semanticSim * 0.35) + (lexicalSim * 0.25) + (structuralSim * 0.20) + (hookSim * 0.10) + (ctaSim * 0.10);
  return Math.min(1.0, Math.max(0.0, composite));
}

/**
 * Validasi Diversitas Konten Lintas 3 Ruang:
 * 1. Current Batch Drafts (draf dalam siklus eksekusi yang sama)
 * 2. Scheduled Posts (postingan yang sedang terjadwal di DB)
 * 3. Recent Published Posts (product_post_memory 7 hari terakhir)
 */
function validateCrossAccountContentDiversity({
  newDraft,
  currentBatchDrafts = [],
  userScheduledPosts = [],
  userRecentMemories = [],
  threshold = 0.65
}) {
  const newCaption = newDraft.caption || newDraft.content || '';
  const newHook = newDraft.hook_text || newDraft.raw_hook || '';
  const newCta = newDraft.cta_text || '';

  let highestSim = 0;
  let conflictSpace = null;
  let conflictingItem = null;

  // 1. Cek terhadap Current Batch Drafts
  for (const draft of currentBatchDrafts) {
    const dCaption = draft.caption || draft.content || '';
    const dHook = draft.hook_text || draft.raw_hook || '';
    const dCta = draft.cta_text || '';
    const sim = calculateCompositeSimilarity(newCaption, dCaption, { hook: newHook, cta: newCta }, { hook: dHook, cta: dCta });
    if (sim > highestSim) {
      highestSim = sim;
      conflictSpace = 'CURRENT_BATCH';
      conflictingItem = draft;
    }
  }

  // 2. Cek terhadap Scheduled Posts di Database
  for (const post of userScheduledPosts) {
    const pCaption = post.content || '';
    const sim = calculateCompositeSimilarity(newCaption, pCaption, { hook: newHook, cta: newCta }, {});
    if (sim > highestSim) {
      highestSim = sim;
      conflictSpace = 'SCHEDULED_POSTS';
      conflictingItem = post;
    }
  }

  // 3. Cek terhadap Recent Published Memories di Database
  for (const mem of userRecentMemories) {
    const mCaption = mem.context_at_post?.caption_preview || mem.raw_metrics?.caption || '';
    const mHook = mem.context_at_post?.hook_type || '';
    const sim = calculateCompositeSimilarity(newCaption, mCaption, { hook: newHook, cta: newCta }, { hook: mHook });
    if (sim > highestSim) {
      highestSim = sim;
      conflictSpace = 'PUBLISHED_MEMORY';
      conflictingItem = mem;
    }
  }

  const passed = highestSim < threshold;

  return {
    passed,
    is_duplicate: !passed,
    highest_similarity: Number((highestSim * 100).toFixed(1)),
    similarity_score: Number(highestSim.toFixed(3)),
    conflict_space: passed ? null : conflictSpace,
    conflicting_item: passed ? null : conflictingItem
  };
}

/**
 * Backward-compatible helper checkContentSimilarity
 */
function checkContentSimilarity(newDraft, recentPosts = [], threshold = 0.65) {
  const result = validateCrossAccountContentDiversity({
    newDraft,
    userRecentMemories: recentPosts,
    threshold
  });
  return {
    is_duplicate: result.is_duplicate,
    highest_similarity: result.highest_similarity,
    conflicting_post: result.conflicting_item,
    similarity_score: result.similarity_score
  };
}

module.exports = {
  generateContentFingerprint,
  extractCoreTokens,
  calculateTokenSimilarity,
  calculateCompositeSimilarity,
  detectRobotClichés,
  validateCrossAccountContentDiversity,
  checkContentSimilarity,
};
