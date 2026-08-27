const { db } = require('../../config/firebase');

/**
 * 9 Canonical Personas (Identitas Akun yang Dipilih User)
 */
const PERSONA_DEFINITIONS = {
  bestie_hype: {
    id: 'bestie_hype',
    name: '💕 Bestie Hype',
    description: 'Casual, Playful, Gen Z slang & ekspresif',
    tone_rules: [
      'Gunakan gaya bicara akrab layaknya sahabat dekat / bestie tongkrongan.',
      'Sering gunakan ekspresi emosional: "MAAF TERIAK 😭", "KAAAK TOLONG GAMAU TAU SENDIRIAN 😭🤌", "cakep parah", "auto kalap".',
      'Hindari bahasa formal atau kaku sama sekali.',
      'Sajikan review spontan dan antusias.'
    ],
    preferred_archetypes: ['emotional_reaction', 'value_shock', 'witty_question', 'honest_spill']
  },
  aesthetic_minimalist: {
    id: 'aesthetic_minimalist',
    name: '🌿 Aesthetic Minimalist',
    description: 'Kalem, elegan, fokus visual & rapi',
    tone_rules: [
      'Gunakan gaya penulisan tenang, bersih, rapi, dan berkelas.',
      'Gunakan kata-kata: "effortless", "look-nya manis", "timeless", "aesthetic", "clean look", "flowy".',
      'Hindari caps lock berlebihan atau slang kasar.',
      'Fokus pada detail bahan, warna kalem, dan perpaduan outfit/dekorasi.'
    ],
    preferred_archetypes: ['aesthetic_wishlist', 'honest_spill', 'pov_lifehack']
  },
  witty_curhat: {
    id: 'witty_curhat',
    name: '😂 Witty Curhat',
    description: 'Humor relatable, cerita santai sehari-hari',
    tone_rules: [
      'Awali dengan uneg-uneg / curhat lucu situasi sehari-hari yang sangat relatable.',
      'Gunakan humor santai, pertanyaan usil, atau self-deprecating yang memancing senyum audiens.',
      'Teks ringkas 1-3 kalimat yang mengalir lancar tanpa terasa seperti iklan.'
    ],
    preferred_archetypes: ['witty_question', 'emotional_reaction', 'honest_spill']
  },
  bargain_hunter: {
    id: 'bargain_hunter',
    name: '🛍️ Smart Bargain Hunter',
    description: 'In This Economy, cari promo & value shock',
    tone_rules: [
      'Fokus pada kontras harga murah vs kualitas mewah / mall ori.',
      'Gunakan ungkapan: "IN THIS ECONOMY ‼️", "HARGA segini dapet kualitas begini", "amanin dompet", "vibesnya mahal".',
      'Tekankan penghematan belanja tanpa mengorbankan gengsi/kualitas.'
    ],
    preferred_archetypes: ['value_shock', 'witty_question', 'honest_spill']
  },
  pov_reviewer: {
    id: 'pov_reviewer',
    name: '🔍 POV Reviewer',
    description: 'Format POV jujur, demonstrasi praktis',
    tone_rules: [
      'Gunakan sudut pandang POV (Point of View) praktis saat menggunakan produk.',
      'Jelaskan solusi nyata: "POV: pas lagi...", "Definisi satisfying pas dipakai", "praktis pol tanpa drama".',
      'Fokus pada fungsi nyata dan kenyamanan saat dipakai/digunakan.'
    ],
    preferred_archetypes: ['pov_lifehack', 'honest_spill', 'witty_question']
  },
  soft_lifestyle: {
    id: 'soft_lifestyle',
    name: '✨ Soft Lifestyle',
    description: 'Rekomendasi wishlist, outfit & dekor manis',
    tone_rules: [
      'Gunakan gaya lembut, hangat, manis, dan menyemangati.',
      'Sertakan emoji manis secukupnya (🌸, 🎀, ✨, 🤍, 🌷).',
      'Cocok untuk outfit kondangan, baju ngantor, kuliah, atau dekorasi kamar.'
    ],
    preferred_archetypes: ['aesthetic_wishlist', 'emotional_reaction', 'honest_spill']
  },
  relatable_everyday: {
    id: 'relatable_everyday',
    name: '🤏 Relatable Everyday',
    description: 'Sederhana, membumi, obrolan akrab',
    tone_rules: [
      'Gunakan bahasa percakapan sehari-hari yang sangat membumi.',
      'Sapa audiens secara santai: "Kalian ngerasa ga sih...", "Siapa yang lemarinya...", "Nemu ini pas lagi...".',
      'Hindari kata-kata muluk atau hiperbola marketing.'
    ],
    preferred_archetypes: ['witty_question', 'honest_spill', 'pov_lifehack']
  },
  practical_expert: {
    id: 'practical_expert',
    name: '🧠 Practical Life-Hack',
    description: 'Solusi cerdas, tips bermanfaat & efisien',
    tone_rules: [
      'Fokus pada life-hack efisiensi waktu, kerapihan rumah, atau solusi hemat.',
      'Gunakan frasa: "Ini kenapa gak viral dari dulu sih", "Ternyata segampang ini", "Wajib save buat yang sering...".',
      'Berikan insight fungsional yang langsung bisa dipraktikkan.'
    ],
    preferred_archetypes: ['pov_lifehack', 'honest_spill', 'value_shock']
  },
  ai_adaptive: {
    id: 'ai_adaptive',
    name: '🤖 AI Adaptive',
    description: 'Kombinasi cerdas dinamis yang dipelajari AI',
    tone_rules: [
      'Seimbangkan antara ekspresi emosional yang hangat, humor relatable, dan rekomendasi fungsional.',
      'Pilih gaya yang paling cocok dengan jenis produk dan waktu tayang.'
    ],
    preferred_archetypes: ['emotional_reaction', 'witty_question', 'pov_lifehack', 'value_shock', 'aesthetic_wishlist', 'honest_spill']
  }
};

/**
 * 6 Human Creator Archetypes (Bagaimana AI Bercerita di Postingan Ini)
 */
const ARCHETYPE_DEFINITIONS = {
  witty_question: {
    id: 'witty_question',
    name: 'Witty Curhat & Casual Question',
    objective_fit: ['engagement', 'clicks'],
    rules: 'Tulis 1-2 kalimat santai yang memantik opini/pertanyaan audiens. Contoh: "Korang rasa handbag macam ni harga bawah RM30 berbaloi tak?" atau "Spill baju kondangan butter yellow yang ga bikin kamu keliatan kayak tumpeng 🫣". JANGAN buat bullet points!',
    default_cta: 'conversation_cta'
  },
  emotional_reaction: {
    id: 'emotional_reaction',
    name: 'Emotional Reaction & Bestie Hype',
    objective_fit: ['clicks', 'engagement'],
    rules: 'Ungkapan syok/kegembiraan spontan menemukan barang bagus. Contoh: "DEFINISI OUTFIT HEMAT 🤌 Modal satu cardigan bisa mix and match banyak gaya loh. Tapi kalau cardigannya secakep ini, mana cukup beli satu. Auto borong gak si 😭".',
    default_cta: 'soft_cta'
  },
  pov_lifehack: {
    id: 'pov_lifehack',
    name: 'POV Life-Hack & Satisfying Solution',
    objective_fit: ['clicks', 'engagement'],
    rules: 'Format POV atau tips menyelesaikan masalah sehari-hari secara satisfying. Contoh: "POV: Pemandangan pas lagi refill sabun tanpa ada drama tumpah-tumpah berantakan. Wadah pump yang satu ini juara banget, tinggal cemplungin pouch isi ulang langsung dari kemasannya. Praktis pol! 🧴✨".',
    default_cta: 'direct_link_cta'
  },
  value_shock: {
    id: 'value_shock',
    name: 'Value Shock & In This Economy',
    objective_fit: ['clicks'],
    rules: 'Soroti kejutan harga murah di tengah kondisi inflasi/serba mahal. Contoh: "HEH MAAF NORAK ‼️ 😭 IN THIS ECONOMY akhirnya nemu toko yang jual FLATSHOES yang udah MALL ORI vibesnya kelihatan mahal, tapi gak ekspek harganya MURAH KEBANGETAN NIH 🙈🫶".',
    default_cta: 'soft_cta'
  },
  aesthetic_wishlist: {
    id: 'aesthetic_wishlist',
    name: 'Aesthetic Wishlist & Mix and Match',
    objective_fit: ['clicks'],
    rules: 'Rekomendasi busana / barang estetik yang rapi dan elegan. Contoh: "Kalau kamu suka outfit yang feminin, elegan, tapi tetap terlihat effortless... ini wajib banget masuk wishlist! 🤍 Satu set blouse lengan balon manis dipaduin rok floral flowy.".',
    default_cta: 'soft_cta'
  },
  honest_spill: {
    id: 'honest_spill',
    name: 'Spontaneous Honest Spill',
    objective_fit: ['clicks'],
    rules: 'Rekomendasi jujur saat menemukan barang lucu/unik tanpa terkesan jualan. Contoh: "GAMAU GEMES SENDIRIAN SAMA DOMPET SENDIRI. 🤗🎀 Beberapa dompet pink yang aku punya, modelnya lucu banget, ga pasaran dan banyak slot penyimpanannya ya. Wajib punya sihh. 👇💖".',
    default_cta: 'soft_cta'
  }
};

/**
 * Memilih strategi copywriting (Persona -> Archetype -> Angle -> CTA) via Contextual Multi-Armed Bandit
 * @param {Object} opts
 * @param {string} opts.platform - 'facebook' | 'threads' | 'instagram'
 * @param {string} [opts.personaId='ai_adaptive'] - ID Persona Akun
 * @param {string} [opts.niche='Universal']
 * @param {string} [opts.objective='clicks']
 * @param {Array} [opts.excludedArchetypeIds=[]]
 * @returns {Object} Strategy payload { persona, archetype, angle, ctaClass }
 */
async function selectContentStrategyByBandit({
  platform = 'threads',
  personaId = 'ai_adaptive',
  niche = 'Universal',
  objective = 'clicks',
  excludedArchetypeIds = []
}) {
  const persona = PERSONA_DEFINITIONS[personaId] || PERSONA_DEFINITIONS.ai_adaptive;
  const availableArchetypes = Object.keys(ARCHETYPE_DEFINITIONS);

  // Ambil arketipe yang sesuai dengan preferensi persona
  let candidateArchetypeKeys = persona.preferred_archetypes.filter(k => ARCHETYPE_DEFINITIONS[k]);
  if (candidateArchetypeKeys.length === 0) {
    candidateArchetypeKeys = availableArchetypes;
  }

  // Filter arketipe yang baru dipakai (anti-duplikasi) jika masih ada alternatif
  const nonExcluded = candidateArchetypeKeys.filter(k => !excludedArchetypeIds.includes(k));
  if (nonExcluded.length > 0) {
    candidateArchetypeKeys = nonExcluded;
  }

  // Multi-Armed Bandit Scoring untuk Arketipe
  let strategyRecords = {};
  try {
    const snap = await db.collection('agent_strategy_bandit').where('persona_id', '==', persona.id).get();
    snap.docs.forEach(d => {
      strategyRecords[d.data().archetype_id] = d.data();
    });
  } catch (err) {
    // fallback gracefully
  }

  const scoredArchetypes = candidateArchetypeKeys.map(k => {
    const rec = strategyRecords[k] || {};
    const avgCtr = rec.avg_ctr || 0.02;
    const sampleSize = rec.sample_size || 0;
    const ucbBonus = sampleSize < 3 ? 0.02 : Math.sqrt((2 * Math.log(Math.max(2, candidateArchetypeKeys.length))) / (sampleSize + 1)) * 0.01;
    const jitter = Math.random() * 0.01;
    return {
      archetypeKey: k,
      score: avgCtr + ucbBonus + jitter
    };
  });

  scoredArchetypes.sort((a, b) => b.score - a.score);

  // 80% Exploit / 20% Explore
  const isExplore = Math.random() < 0.2 && scoredArchetypes.length > 1;
  const selectedKey = isExplore 
    ? scoredArchetypes[Math.floor(Math.random() * scoredArchetypes.length)].archetypeKey
    : scoredArchetypes[0].archetypeKey;

  const chosenArchetype = ARCHETYPE_DEFINITIONS[selectedKey] || ARCHETYPE_DEFINITIONS.emotional_reaction;

  // Tentukan sudut pandang (Angle)
  const candidateAngles = ['Problem-Agitate-Solution', 'Honest Review', 'Flash Promo FOMO', 'Aesthetic Showcase', 'Storytelling', 'Practical Life-Hack'];
  const chosenAngle = candidateAngles[Math.floor(Math.random() * candidateAngles.length)];

  return {
    persona,
    archetype: chosenArchetype,
    angle: chosenAngle,
    ctaClass: chosenArchetype.default_cta || 'soft_cta'
  };
}

/**
 * Legacy Seed Template Pustaka Dasar (untuk backward-compatibility)
 */
const SEED_TEMPLATES = [
  // 1. PAS (Problem - Agitate - Solution)
  {
    id: 'tpl_pas_modern_01',
    name: 'Problem-Agitate-Solution Direct Hook',
    category: 'Universal',
    angle: 'Problem-Agitate-Solution',
    structure: '{HOOK}\n\n{PAIN_POINT}\n\nNemu {PRODUCT_NAME} ini beneran jadi penolong banget ✨\n{USP_BULLETS}\n\n👉 Detail & link checkout di sini ya:\n{CTA_LINK}\n\n{HASHTAGS}',
    platform_fit: ['instagram', 'facebook'],
    is_active: true,
  },
  // 2. Honest Review / Spill Link
  {
    id: 'tpl_review_spill_02',
    name: 'Honest Review Spill Link',
    category: 'Universal',
    angle: 'Honest Review',
    structure: '{HOOK}\n\nReview jujur {PRODUCT_NAME}:\n{USP_BULLETS}\n\nBuat yang mau spill toko resminya:\n{CTA_LINK}\n\n{HASHTAGS}',
    platform_fit: ['instagram', 'facebook'],
    is_active: true,
  },
  // 3. Flash Promo / FOMO Urgency
  {
    id: 'tpl_fomo_urgency_03',
    name: 'Flash Promo & Diskon Terbatas',
    category: 'Universal',
    angle: 'Flash Promo FOMO',
    structure: '🚨 LAGI ADA PROMO HEMAT 🚨\n\n{PRODUCT_NAME}\n{USP_BULLETS}\n\n⚡ Stok terbatas, amankan sebelum kehabisan:\n{CTA_LINK}\n\n{HASHTAGS}',
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
    structure: 'Dulu sering banget ngerasain {PAIN_POINT}...\n\nSampai akhirnya nemu {PRODUCT_NAME} ini. Beneran life-changer banget buat sehari-hari!\n\nKelebihannya:\n{USP_BULLETS}\n\nLink produk original:\n{CTA_LINK}\n\n{HASHTAGS}',
    platform_fit: ['facebook', 'instagram'],
    is_active: true,
  },
  // 6. Threads Punchy Direct
  {
    id: 'tpl_threads_punchy_06',
    name: 'Threads Punchy One-Liner',
    category: 'Universal',
    angle: 'Honest Review',
    structure: '{HOOK}\n\n{PRODUCT_NAME}\n{USP_BULLETS}',
    platform_fit: ['threads'],
    is_active: true,
  },
  // 7. Threads IN THIS ECONOMY (Value Shock)
  {
    id: 'tpl_threads_in_this_economy_07',
    name: 'Threads IN THIS ECONOMY Value Shock',
    category: 'Universal',
    angle: 'Flash Promo FOMO',
    structure: '{HOOK}\n\n{PRODUCT_NAME} ini looksnya beneran kayak brand mahal tapi ramah di kantong 🤌🏻✨\n{USP_BULLETS}',
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
    structure: '{HOOK}\n\n{USP_BULLETS}\n\nKualitasnya beneran juara dan ramah di kantong.',
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
    structure: '{HOOK}\n\n{PRODUCT_NAME}\n{USP_BULLETS}\n\n{CTA_LINK}',
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

/**
 * Memperbarui performa strategi (Persona + Archetype) di MAB
 */
async function recordStrategyPerformance({ personaId = 'ai_adaptive', archetypeId = 'emotional_reaction', platform = 'threads', views = 0, clicks = 0 }) {
  try {
    const docId = `strat_${personaId}_${platform}_${archetypeId}`;
    const docRef = db.collection('agent_strategy_bandit').doc(docId);
    const doc = await docRef.get();

    const existing = doc.exists ? doc.data() : { total_views: 0, total_clicks: 0, sample_size: 0, avg_ctr: 0.02 };
    const newViews = (existing.total_views || 0) + views;
    const newClicks = (existing.total_clicks || 0) + clicks;
    const newSampleSize = (existing.sample_size || 0) + 1;
    const newCtr = newViews > 0 ? Number((newClicks / newViews).toFixed(4)) : (existing.avg_ctr || 0.02);

    await docRef.set({
      persona_id: personaId,
      archetype_id: archetypeId,
      platform,
      total_views: newViews,
      total_clicks: newClicks,
      sample_size: newSampleSize,
      avg_ctr: newCtr,
      updated_at: new Date().toISOString()
    }, { merge: true });

    return { success: true, docId, newCtr };
  } catch (err) {
    console.error('[recordStrategyPerformance Error]:', err.message);
    return null;
  }
}

module.exports = {
  PERSONA_DEFINITIONS,
  ARCHETYPE_DEFINITIONS,
  selectContentStrategyByBandit,
  recordStrategyPerformance,
  SEED_TEMPLATES,
  ensureSeedTemplates,
  selectTemplateByBandit,
  fillTemplatePlaceholders,
  recordTemplatePerformance,
};
