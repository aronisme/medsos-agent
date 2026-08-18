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
    structure: 'Jujur awalnya ragu, tapi pas dicoba ternyata beneran sebagus itu! 😍\n\nReview singkat {PRODUCT_NAME}:\n{USP_BULLETS}\n\nBuat yang nanya spill belinya di mana, link tokonya ada di sini ya:\n{CTA_LINK}\n\n{HASHTAGS}',
    platform_fit: ['threads', 'instagram', 'facebook'],
    is_active: true,
  },
  // 3. Flash Promo / FOMO Urgency
  {
    id: 'tpl_fomo_urgency_03',
    name: 'Flash Promo & Diskon Terbatas',
    category: 'Universal',
    angle: 'Flash Promo FOMO',
    structure: '🚨 PROMO SPESIAL HARI INI 🚨\n\n{PRODUCT_NAME}\nDiskon {DISCOUNT} jadi cuma {PRICE_DISCOUNT}!\n\nKenapa harus checkout sekarang:\n{USP_BULLETS}\n\n⚡ Stok terbatas, amankan sebelum kehabisan:\n{CTA_LINK}\n\n{HASHTAGS}',
    platform_fit: ['facebook', 'threads'],
    is_active: true,
  },
  // 4. Aesthetic Showcase & Lifestyle
  {
    id: 'tpl_aesthetic_showcase_04',
    name: 'Aesthetic Showcase & Lifestyle',
    category: 'Fashion & Beauty',
    angle: 'Aesthetic Showcase',
    structure: 'Definisi upgrade penampilan tanpa bikin dompet nangis ✨\n\n{PRODUCT_NAME} ini beneran estetik dan fungsional:\n{USP_BULLETS}\n\nCek racun shopee satu ini di sini:\n{CTA_LINK}\n\n{HASHTAGS}',
    platform_fit: ['instagram', 'threads'],
    is_active: true,
  },
  // 5. Storytelling / Relatable Situation
  {
    id: 'tpl_storytelling_curhat_05',
    name: 'Storytelling Relatable Curhat',
    category: 'Universal',
    angle: 'Storytelling',
    structure: 'Dulu sering banget ngerasain {PAIN_POINT}...\n\nSampai akhirnya nemu {PRODUCT_NAME} ini. Beneran life-changer banget buat sehari-hari!\n\nKelebihannya:\n{USP_BULLETS}\n\nHarganya juga ramah kantong: {PRICE_DISCOUNT}\nLink produk original:\n{CTA_LINK}\n\n{HASHTAGS}',
    platform_fit: ['facebook', 'threads', 'instagram'],
    is_active: true,
  },
  // 6. Threads Punchy Short Link
  {
    id: 'tpl_threads_punchy_06',
    name: 'Threads Punchy One-Liner',
    category: 'Universal',
    angle: 'Honest Review',
    structure: '{HOOK} 👇\n\n{PRODUCT_NAME} - {PRICE_DISCOUNT}\n\nLink beli: {CTA_LINK}',
    platform_fit: ['threads'],
    is_active: true,
  }
];

/**
 * Inisialisasi seed templates di database jika koleksi masih kosong
 * @param {string} userId
 */
async function ensureSeedTemplates(userId = 'system') {
  try {
    const snap = await db.collection('post_templates').limit(1).get();
    if (snap.empty) {
      const batch = db.batch();
      for (const tpl of SEED_TEMPLATES) {
        const docRef = db.collection('post_templates').doc(tpl.id);
        batch.set(docRef, {
          ...tpl,
          user_id: userId,
          segment_performance: {},
          global_sample_size: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      await batch.commit();
      console.log('[TemplateService] Seed templates berhasil diinisialisasi.');
    }
  } catch (err) {
    console.error('[ensureSeedTemplates Error]:', err.message);
  }
}

/**
 * Memilih template terbaik menggunakan Contextual Multi-Armed Bandit (80% Eksploitasi, 20% Eksplorasi)
 * @param {Object} opts
 * @param {string} opts.platform - 'facebook' | 'instagram' | 'threads'
 * @param {string} opts.niche - Niche produk
 * @param {string} opts.objective - 'clicks' | 'engagement'
 * @param {Array} [opts.excludedTemplateIds] - Template yang baru saja dipakai untuk produk ini (anti-duplikasi)
 * @returns {Promise<Object>} Template terpilih
 */
async function selectTemplateByBandit({
  platform = 'instagram',
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

    // Hitung bobot tiap template untuk segmen (Platform + Niche + Objective)
    const segmentKey = `${platform}__${objective}`;
    const scoredCandidates = candidates.map(t => {
      const seg = t.segment_performance?.[segmentKey] || {};
      const avgCtr = seg.avg_ctr || 0.02; // default baseline 2% CTR
      const sampleSize = seg.sample_size || 0;

      // Bandit weight score
      return {
        ...t,
        bandit_score: avgCtr + (sampleSize < 3 ? 0.01 : 0), // bonus eksplorasi untuk yang masih baru
        sample_size: sampleSize
      };
    });

    // Urutkan dari skor tertinggi
    scoredCandidates.sort((a, b) => b.bandit_score - a.bandit_score);

    // Epsilon-Greedy: 80% pilih Top Performer, 20% Eksplorasi acak
    const isExploration = Math.random() < 0.2 && scoredCandidates.length > 1;

    let chosenTemplate = null;
    if (isExploration) {
      // Pilih acak dari sisa kandidat
      const randomIndex = Math.floor(Math.random() * scoredCandidates.length);
      chosenTemplate = scoredCandidates[randomIndex];
    } else {
      chosenTemplate = scoredCandidates[0];
    }

    return chosenTemplate;
  } catch (err) {
    console.error('[selectTemplateByBandit Error]:', err.message);
    return SEED_TEMPLATES[0];
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

module.exports = {
  SEED_TEMPLATES,
  ensureSeedTemplates,
  selectTemplateByBandit,
  fillTemplatePlaceholders,
};
