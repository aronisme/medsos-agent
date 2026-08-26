const { db } = require('../../config/firebase');

/**
 * Seed Template Pustaka Dasar (15 Template Konversi Terbukti)
 */
const SEED_TEMPLATES = [
  // 1. PAS (Problem - Agitate - Solution)
  {
    id: 'tpl_pas_modern_01',
    name: 'Problem-Agitate-Solution Direct Hook',
    category: 'Universal',
    angle: 'Problem-Agitate-Solution',
    structure: '{HOOK}\n\n{PAIN_POINT}\n\nSolusi terbaiknya: {PRODUCT_NAME} ✨\n{USP_BULLETS}\n\n🔥 Harga Promo: {PRICE_DISCOUNT}\n👉 Langsung cek link di bio / kolom komentar:\n{CTA_LINK}\n\n{HASHTAGS}',
    platform_fit: ['instagram', 'facebook'],
    is_active: true,
  },
  // 2. Honest Review / Spill Link
  {
    id: 'tpl_review_spill_02',
    name: 'Honest Review Spill Link',
    category: 'Universal',
    angle: 'Honest Review',
    structure: '{HOOK}\n\nReview singkat {PRODUCT_NAME}:\n{USP_BULLETS}\n\nBuat yang mau cek link toko resminya:\n{CTA_LINK}\n\n{HASHTAGS}',
    platform_fit: ['instagram', 'facebook'],
    is_active: true,
  },
  // 3. Flash Promo / FOMO Urgency
  {
    id: 'tpl_fomo_urgency_03',
    name: 'Flash Promo & Diskon Terbatas',
    category: 'Universal',
    angle: 'Flash Promo FOMO',
    structure: '🚨 PROMO SPESIAL HARI INI 🚨\n\n{PRODUCT_NAME}\nDiskon {DISCOUNT} jadi cuma {PRICE_DISCOUNT}!\n\nKenapa harus checkout sekarang:\n{USP_BULLETS}\n\n⚡ Stok terbatas, amankan sebelum kehabisan:\n{CTA_LINK}\n\n{HASHTAGS}',
    platform_fit: ['facebook'],
    is_active: true,
  },
  // 4. Aesthetic Showcase & Lifestyle
  {
    id: 'tpl_aesthetic_showcase_04',
    name: 'Aesthetic Showcase & Lifestyle',
    category: 'Fashion & Beauty',
    angle: 'Aesthetic Showcase',
    structure: 'Definisi upgrade penampilan tanpa bikin dompet nangis ✨\n\n{PRODUCT_NAME} ini beneran estetik dan fungsional:\n{USP_BULLETS}\n\nCek racun shopee satu ini di sini:\n{CTA_LINK}\n\n{HASHTAGS}',
    platform_fit: ['instagram', 'facebook'],
    is_active: true,
  },
  // 5. Storytelling / Relatable Situation
  {
    id: 'tpl_storytelling_curhat_05',
    name: 'Storytelling Relatable Curhat',
    category: 'Universal',
    angle: 'Storytelling',
    structure: 'Dulu sering banget ngerasain {PAIN_POINT}...\n\nSampai akhirnya nemu {PRODUCT_NAME} ini. Beneran life-changer banget buat sehari-hari!\n\nKelebihannya:\n{USP_BULLETS}\n\nHarganya juga ramah kantong: {PRICE_DISCOUNT}\nLink produk original:\n{CTA_LINK}\n\n{HASHTAGS}',
    platform_fit: ['facebook', 'instagram'],
    is_active: true,
  },
  // 6. Threads Punchy Direct
  {
    id: 'tpl_threads_punchy_06',
    name: 'Threads Punchy One-Liner',
    category: 'Universal',
    angle: 'Honest Review',
    structure: '{HOOK}\n\n{PRODUCT_NAME} ({PRICE_DISCOUNT})\n{USP_BULLETS}',
    platform_fit: ['threads'],
    is_active: true,
  },
  // 7. Threads IN THIS ECONOMY (Value Shock)
  {
    id: 'tpl_threads_in_this_economy_07',
    name: 'Threads IN THIS ECONOMY Value Shock',
    category: 'Universal',
    angle: 'Flash Promo FOMO',
    structure: '{HOOK}\n\n{PRODUCT_NAME} harganya cuma {PRICE_DISCOUNT} tapi looksnya beneran kayak brand mahal 🤌🏻✨\n{USP_BULLETS}',
    platform_fit: ['threads'],
    is_active: true,
  },
  // 8. Threads Maaf Teriak (Bestie Emotional Cry)
  {
    id: 'tpl_threads_maaf_teriak_08',
    name: 'Threads Maaf Teriak Bestie Hype',
    category: 'Fashion & Beauty',
    angle: 'Aesthetic Showcase',
    structure: '{HOOK}\n\n{PAIN_POINT}\n{USP_BULLETS}',
    platform_fit: ['threads'],
    is_active: true,
  },
  // 9. Threads POV Satisfying (Life-Hack Solution)
  {
    id: 'tpl_threads_pov_satisfying_09',
    name: 'Threads POV Satisfying Life-Hack',
    category: 'Home & Living',
    angle: 'Problem-Agitate-Solution',
    structure: '{HOOK}\n\n{PAIN_POINT}\n{USP_BULLETS}',
    platform_fit: ['threads'],
    is_active: true,
  },
  // 10. Threads Effortless Simple Curhat
  {
    id: 'tpl_threads_effortless_curhat_10',
    name: 'Threads Effortless Simple Curhat',
    category: 'Universal',
    angle: 'Storytelling',
    structure: '{HOOK}\n\n{PRODUCT_NAME} ini materialnya nyaman banget:\n{USP_BULLETS}',
    platform_fit: ['threads'],
    is_active: true,
  },
  // 11. Threads Listicle Alternatif Hemat
  {
    id: 'tpl_threads_listicle_alternatif_11',
    name: 'Threads Listicle Alternatif Hemat',
    category: 'Universal',
    angle: 'Problem-Agitate-Solution',
    structure: '{HOOK}\n\n{USP_BULLETS}\n\nModal {PRICE_DISCOUNT} udah dapet kualitas juara.',
    platform_fit: ['threads'],
    is_active: true,
  },
  // 12. Threads Direct Link Card (Native Preview)
  {
    id: 'tpl_threads_link_preview_12',
    name: 'Threads Direct Link Card Preview',
    category: 'Universal',
    angle: 'Honest Review',
    structure: '{HOOK}\n\nReview singkat {PRODUCT_NAME}:\n{USP_BULLETS}\n\n{CTA_LINK}',
    platform_fit: ['threads'],
    is_active: true,
  },
  // 13. Threads Value Shock Card Preview
  {
    id: 'tpl_threads_value_card_13',
    name: 'Threads Value Shock Card Preview',
    category: 'Universal',
    angle: 'Flash Promo FOMO',
    structure: '{HOOK}\n\n{PRODUCT_NAME} ({PRICE_DISCOUNT})\n{USP_BULLETS}\n\n{CTA_LINK}',
    platform_fit: ['threads'],
    is_active: true,
  }
];

let seedTemplatesInitialized = false;

/**
 * Inisialisasi & sinkronisasi seed templates di database
 * @param {string} userId
 */
async function ensureSeedTemplates(userId = 'system') {
  if (seedTemplatesInitialized) return;
  try {
    const snap = await db.collection('post_templates').limit(1).get();
    if (snap.empty) {
      for (const tpl of SEED_TEMPLATES) {
        await db.collection('post_templates').doc(tpl.id).set({
          ...tpl,
          user_id: userId,
          segment_performance: {},
          global_sample_size: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
    seedTemplatesInitialized = true;
  } catch (err) {
    console.warn('[ensureSeedTemplates Warning]:', err.message);
  }
}

/**
 * Memilih template terbaik menggunakan Contextual Multi-Armed Bandit (80% Eksploitasi, 20% Eksplorasi)
 * dengan Upper Confidence Bound (UCB) dan Random Jitter untuk rotasi yang adil saat cold-start.
 * @param {Object} opts
 * @param {string} opts.platform - 'facebook' | 'instagram' | 'threads'
 * @param {string} opts.niche - Niche produk
 * @param {string} opts.objective - 'clicks' | 'engagement'
 * @param {Array} [opts.excludedTemplateIds] - Template yang baru saja dipakai untuk produk ini (anti-duplikasi)
 * @returns {Promise<Object>} Template terpilih
 */
async function selectTemplateByBandit({
  platform = 'facebook',
  niche = 'Universal',
  objective = 'clicks',
  excludedTemplateIds = []
}) {
  try {
    await ensureSeedTemplates();

    const snap = await db.collection('post_templates')
      .where('is_active', '==', true)
      .get();

    let allTemplates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (allTemplates.length === 0) {
      allTemplates = [...SEED_TEMPLATES];
    }

    // Filter yang cocok dengan platform
    let candidates = allTemplates.filter(t => {
      if (Array.isArray(t.platform_fit) && t.platform_fit.length > 0) {
        return t.platform_fit.includes(platform);
      }
      return true;
    });

    if (candidates.length === 0) candidates = allTemplates;

    // Saring template yang baru saja dipakai jika masih ada alternatif
    const nonExcluded = candidates.filter(t => !excludedTemplateIds.includes(t.id));
    if (nonExcluded.length > 0) {
      candidates = nonExcluded;
    }

    // Hitung bobot tiap template untuk segmen (Platform + Objective) dengan UCB exploration & tie-breaking jitter
    const segmentKey = `${platform}__${objective}`;
    const scoredCandidates = candidates.map(t => {
      const seg = t.segment_performance?.[segmentKey] || {};
      const avgCtr = seg.avg_ctr || 0.02; // default baseline 2% CTR
      const sampleSize = seg.sample_size || 0;

      // UCB1 Exploration Term + Random Jitter agar template dengan performa seri terdistribusi secara acak merata
      const explorationBonus = sampleSize < 3 ? 0.015 : Math.sqrt((2 * Math.log(Math.max(2, candidates.length))) / (sampleSize + 1)) * 0.01;
      const tieBreakerJitter = Math.random() * 0.008; // acak 0.0% - 0.8% untuk rotasi cold-start

      return {
        ...t,
        bandit_score: avgCtr + explorationBonus + tieBreakerJitter,
        sample_size: sampleSize
      };
    });

    // Urutkan dari skor tertinggi
    scoredCandidates.sort((a, b) => b.bandit_score - a.bandit_score);

    // Epsilon-Greedy: 80% pilih Top Performer, 20% Eksplorasi acak
    const isExploration = Math.random() < 0.2 && scoredCandidates.length > 1;

    let chosenTemplate = null;
    if (isExploration) {
      const randomIndex = Math.floor(Math.random() * scoredCandidates.length);
      chosenTemplate = scoredCandidates[randomIndex];
    } else {
      chosenTemplate = scoredCandidates[0];
    }

    return chosenTemplate;
  } catch (err) {
    console.error('[selectTemplateByBandit Error]:', err.message);
    const fallbacks = SEED_TEMPLATES.filter(t => Array.isArray(t.platform_fit) && t.platform_fit.includes(platform));
    if (fallbacks.length > 0) {
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
    return SEED_TEMPLATES[Math.floor(Math.random() * SEED_TEMPLATES.length)];
  }
}

/**
 * Mengisi placeholder template dengan data produk yang sebenarnya
 * @param {string} structure - Format struktur template
 * @param {Object} data - { hook, pain_point, product_name, price_discount, discount, usp_bullets, cta_link, hashtags }
 * @returns {string} Konten yang siap dipublish
 */
function fillTemplatePlaceholders(structure, data = {}) {
  let filled = String(structure || '');

  filled = filled.replace(/\{HOOK\}/g, data.hook || data.title || '');
  filled = filled.replace(/\{PAIN_POINT\}/g, data.pain_point || '');
  filled = filled.replace(/\{PRODUCT_NAME\}/g, data.product_name || data.title || '');
  filled = filled.replace(/\{PRICE_DISCOUNT\}/g, data.price_discount || '');
  filled = filled.replace(/\{DISCOUNT\}/g, data.discount || '');
  filled = filled.replace(/\{USP_BULLETS\}/g, data.usp_bullets || '');
  filled = filled.replace(/\{CTA_LINK\}/g, data.cta_link || '');
  filled = filled.replace(/\{HASHTAGS\}/g, data.hashtags || '');

  // Bersihkan baris kosong berlebih
  return filled.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Memperbarui performa template untuk Multi-Armed Bandit berdasarkan metrik tayangan dan klik riil
 * @param {string} templateId 
 * @param {string} platform 
 * @param {string} objective 
 * @param {number} views 
 * @param {number} clicks 
 */
async function recordTemplatePerformance(templateId, platform = 'facebook', objective = 'clicks', views = 0, clicks = 0) {
  try {
    if (!templateId) return null;
    const docRef = db.collection('post_templates').doc(templateId);
    const doc = await docRef.get();
    if (!doc.exists) return null;

    const data = doc.data();
    const segmentKey = `${platform}__${objective}`;
    const seg = data.segment_performance?.[segmentKey] || { total_views: 0, total_clicks: 0, sample_size: 0, avg_ctr: 0.02 };

    const newViews = (seg.total_views || 0) + views;
    const newClicks = (seg.total_clicks || 0) + clicks;
    const newSampleSize = (seg.sample_size || 0) + 1;
    const newCtr = newViews > 0 ? Number((newClicks / newViews).toFixed(4)) : (seg.avg_ctr || 0.02);

    const updatedSegmentPerformance = {
      ...(data.segment_performance || {}),
      [segmentKey]: {
        total_views: newViews,
        total_clicks: newClicks,
        sample_size: newSampleSize,
        avg_ctr: newCtr,
        last_updated_at: new Date().toISOString()
      }
    };

    const globalSampleSize = (data.global_sample_size || 0) + 1;

    await docRef.update({
      segment_performance: updatedSegmentPerformance,
      global_sample_size: globalSampleSize,
      updated_at: new Date().toISOString()
    });

    return { success: true, templateId, segmentKey, newCtr };
  } catch (err) {
    console.error('[recordTemplatePerformance Error]:', err.message);
    return null;
  }
}

module.exports = {
  SEED_TEMPLATES,
  ensureSeedTemplates,
  selectTemplateByBandit,
  fillTemplatePlaceholders,
  recordTemplatePerformance,
};
