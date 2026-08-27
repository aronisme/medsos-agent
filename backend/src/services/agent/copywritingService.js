const { callCopywritingAI } = require('./aiQueueService');
const { PERSONA_DEFINITIONS, ARCHETYPE_DEFINITIONS, selectContentStrategyByBandit } = require('./templateService');
const { generateContentFingerprint, detectRobotClichés } = require('./contentFingerprint');

/**
 * Ekstraksi sebutan produk alami (Natural Product Reference) dari judul e-commerce mentah Shopee
 * Contoh: "[MALL ORI] Ashallina Flatshoes Wanita Casual Slip On Korea" -> "flatshoes ini"
 * @param {string} rawTitle
 * @param {string} category
 * @returns {string} Sebutan natural
 */
function extractNaturalReference(rawTitle = '', category = '') {
  if (!rawTitle) return 'barang ini';

  let clean = String(rawTitle)
    .replace(/\[.*?\]|\(.*?\)|【.*?】/g, '') // Hapus tag seperti [PROMO], [MALL], dll
    .replace(/(promo|diskon|termurah|terlaris|terbaru|terlengkap|original|ori|100%|official|star\+|mall|cod|gratis ongkir|viral|korea|korean|style|kekinian)/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = clean.split(' ').filter(w => w.length > 2);
  
  // Deteksi kata benda umum dalam bahasa Indonesia
  const nounKeywords = [
    'flatshoes', 'sepatu', 'sandal', 'heels', 'sneakers', 'tas', 'handbag', 'tote bag', 'shoulder bag', 'dompet',
    'cardigan', 'blouse', 'kemeja', 'kaos', 'tunik', 'dress', 'rok', 'celana', 'kulot', 'gamis', 'kebaya', 'piyama', 'hoodie',
    'headset', 'earphone', 'tws', 'speaker', 'powerbank', 'charger', 'casing', 'holder',
    'serum', 'sunscreen', 'moisturizer', 'lipcream', 'lipstick', 'cushion', 'parfum', 'facial wash',
    'wadah', 'botol', 'panci', 'wajan', 'rak', 'organizer', 'sprei', 'lampu', 'pompa', 'tempat sabun', 'hanger'
  ];

  for (const noun of nounKeywords) {
    const regex = new RegExp(`\\b${noun}\\b`, 'i');
    if (regex.test(clean)) {
      return `${noun} ini`;
    }
  }

  // Jika tidak ditemukan keyword spesifik, ambil 2 kata pertama yang bersih
  if (words.length >= 2) {
    return `${words[0].toLowerCase()} ${words[1].toLowerCase()} ini`;
  } else if (words.length === 1) {
    return `${words[0].toLowerCase()} ini`;
  }

  return 'produk ini';
}

/**
 * Menghapus duplikasi hashtag yang identik
 */
function deduplicateHashtags(text = '') {
  if (!text) return '';
  const lines = text.split('\n');
  const seenGlobal = new Set();
  const processedLines = lines.map(line => {
    if (line.includes('#')) {
      return line.replace(/#([a-zA-Z0-9_]+)/g, (match, tag) => {
        const lower = tag.toLowerCase();
        if (seenGlobal.has(lower)) {
          return '';
        }
        seenGlobal.add(lower);
        return match;
      }).replace(/[ \t]{2,}/g, ' ').trim();
    }
    return line;
  });
  return processedLines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Sanitasi teks caption: hapus tanda bintang markdown (*, **), header (#), dan duplikasi hashtag
 */
function cleanCaptionText(text = '') {
  if (!text) return '';
  const cleaned = String(text)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/^#+\s+/gm, '')
    .trim();

  return deduplicateHashtags(cleaned);
}

/**
 * Sistem prompt dinamis yang menggabungkan Persona Identitas, Arketipe Penceritaan, dan Pantangan Robotik
 */
function buildSystemPrompt({ platform = 'threads', persona, archetype }) {
  const isThreads = platform === 'threads';

  const personaRules = (persona?.tone_rules || []).map((r, i) => `${i + 1}. ${r}`).join('\n');
  const archetypeName = archetype?.name || 'Emotional Reaction';
  const archetypeRules = archetype?.rules || 'Tulis secara natural dan mengalir.';

  return `Kamu adalah Kreator Konten Media Sosial Organik Indonesia untuk ${isThreads ? 'Meta Threads' : 'Facebook Page'}.
Tugasmu adalah membuat caption yang SANGAT ALAMI, SEPERTI DITULIS MANUSIA ASLI (bukan bot/AI), santai, mengalir, memicu interaksi/klik, dan 100% bebas dari gaya bahasa robotik.

IDENTITAS PERSONA AKUN INI: [${persona?.name || '💕 Bestie Hype'}]
${personaRules}

ARKETIPE PENCERITAAN: [${archetypeName}]
${archetypeRules}

PANTANGAN MUTLAK (ANTI-ROBOT & ANTI-BOT LAWS):
1. DILARANG KERAS menggunakan frasa kaku AI bot:
   - "Solusi terbaiknya..."
   - "Keunggulan produk ini..."
   - "Kenapa harus checkout..."
   - "Spesifikasi produk..."
   - "Harga promo: Rp..."
2. DILARANG MEMBUAT DAFTAR BULLET POINTS KAKU (seperti "• Poin 1", "• Poin 2", "1.", "2."). Jadikan penjelasan keunggulan menyatu ke dalam kalimat percakapan narasi yang natural!
3. DILARANG MENYISIPKAN JUDUL E-COMMERCE PANJANG MENTAH. Gunakan sebutan alami yang ringkas (misal: "flatshoes ini", "cardigan rajut ini", "wadah sabun ini").
4. DILARANG menggunakan tanda bintang ** atau * atau format markdown apapun. Tulis langsung teks polos bersih.
5. Panjang Teks:
   - Threads: Ringkas & padat, target 120 - 350 karakter (maksimal aman API < 450 karakter).
   - Facebook: Storytelling mengalir 200 - 500 karakter.
6. ${isThreads ? 'ZERO HASHTAG CLUTTER: DILARANG membuat tumpukan hashtag di Threads.' : 'Gunakan maksimal 2-3 hashtag relevan di akhir.'}

Keluarkan output HANYA dalam format JSON valid:
{
  "caption": "Teks postingan utama yang mengalir santai tanpa bullet points dan tanpa format bot",
  "raw_hook": "Kalimat pembuka / hook 1 baris",
  "cta_type": "soft_cta",
  "first_reply_intro": "Kalimat santai pengantar spill link di komentar (contoh: 'Spill link tokonya di sini ya 👇' atau 'Ini link produknya buat yang mau checkout 👇')"
}`;
}

/**
 * Meracik konten postingan lengkap menggunakan Direct AI Generation (No Rigid Template Slots)
 * @param {Object} opts
 * @param {Object} opts.product - Objek data produk Shopee
 * @param {Object} opts.profile - Profil hasil Product Intelligence
 * @param {string} opts.platform - 'facebook' | 'threads' | 'instagram'
 * @param {string} [opts.personaId] - ID Persona Akun
 * @param {string} [opts.angle] - Sudut pandang copy
 * @param {string} [opts.objective] - 'clicks' | 'engagement'
 * @param {string} opts.shortlinkUrl - URL shortlink afiliasi
 * @param {Object} [opts.sessionInfo] - { session: 'Pagi'|'Siang'|'Malam', hour: number }
 * @param {string} [opts.threadsMediaMode='auto'] - 'auto' | 'no_media' | 'with_media'
 * @returns {Promise<Object>} Strategy & Post payload
 */
async function generatePostContent({
  product,
  profile,
  platform = 'threads',
  personaId = 'ai_adaptive',
  angle = null,
  objective = 'clicks',
  shortlinkUrl,
  sessionInfo = { session: 'Siang', hour: 12 },
  excludedArchetypeIds = [],
  threadsMediaMode = 'auto'
}) {
  try {
    const isThreads = platform === 'threads';
    const isThreadsNoMedia = isThreads && threadsMediaMode === 'no_media';

    // 1. Pilih Strategi Terpadu (Persona -> Archetype -> Angle -> CTA) via Contextual MAB
    const strategy = await selectContentStrategyByBandit({
      platform,
      personaId,
      niche: profile?.niche || 'Universal',
      objective,
      excludedArchetypeIds
    });

    const activeAngle = angle || strategy.angle || 'Problem-Agitate-Solution';
    const naturalProductRef = extractNaturalReference(product.title, profile?.niche);

    // 2. Susun Prompt Spesifik
    const systemPrompt = buildSystemPrompt({
      platform,
      persona: strategy.persona,
      archetype: strategy.archetype
    });

    const priceFormatted = Number(product.price || 0) > 0 
      ? `Rp ${Number(product.price).toLocaleString('id-ID')}` 
      : 'Promo Terjangkau';

    const userPrompt = [
      `Produk: ${product.title}`,
      `Sebutan Alami Produk: ${naturalProductRef}`,
      `Niche: ${profile?.niche || 'Umum'}`,
      `Harga: ${priceFormatted} ${product.discount ? `(Diskon ${product.discount})` : ''}`,
      `Keunggulan Nyata: ${(profile?.usp || []).slice(0, 3).join(', ')}`,
      `Pain Point yang Diselesaikan: ${(profile?.pain_points || []).slice(0, 2).join(', ')}`,
      `Waktu Tayang: Sesi ${sessionInfo.session || 'Siang'} (${sessionInfo.hour || 12}:00 WIB)`,
      `Platform Target: ${platform.toUpperCase()}`,
      `Mode Threads: ${isThreadsNoMedia ? 'NO_MEDIA_LINK_CARD (Tautan pendek akan disisipkan di caption)' : 'WITH_MEDIA (Tautan disajikan di first-reply)'}`,
      `Arketipe: ${strategy.archetype.name}`,
      `Sudut Pandang: ${activeAngle}`
    ].join('\n');

    let parsedCopy = null;

    try {
      const rawAiResponse = await callCopywritingAI({
        systemPrompt,
        userPrompt,
        temperature: 0.85,
        jsonMode: true,
        maxTokens: 500
      });

      try {
        parsedCopy = JSON.parse(rawAiResponse);
      } catch {
        const match = rawAiResponse.match(/\{[\s\S]*\}/);
        if (match) parsedCopy = JSON.parse(match[0]);
      }
    } catch (aiErr) {
      console.warn(`[generatePostContent] AI call warning: ${aiErr.message}. Menggunakan fallback organik.`);
    }

    // Emergency Fallback Organik jika AI offline
    if (!parsedCopy || !parsedCopy.caption) {
      if (isThreads) {
        parsedCopy = {
          caption: `IN THIS ECONOMY ‼️ 😭 nemu ${naturalProductRef} yang vibesnya keliatan mahal tapi harganya cuma ${priceFormatted} doang, cakep parah 🤌✨`,
          raw_hook: `IN THIS ECONOMY ‼️ 😭`,
          cta_type: isThreadsNoMedia ? 'link_card_cta' : 'soft_cta',
          first_reply_intro: 'Spill link tokonya di sini ya 👇'
        };
      } else {
        parsedCopy = {
          caption: `Rekomendasi ${naturalProductRef} yang beneran bikin aktivitas harian jadi lebih simpel dan hemat. Harganya cuma ${priceFormatted} dengan kualitas yang juara ✨`,
          raw_hook: `Rekomendasi ${naturalProductRef} hemat!`,
          cta_type: 'direct_link_cta',
          first_reply_intro: 'Link produk original ada di kolom komentar 👇'
        };
      }
    }

    // 3. Deteksi & Perbaiki Pola Robotik (Two-Layer Anti-Robot Sanitizer)
    let finalCaption = cleanCaptionText(parsedCopy.caption);
    const robotCheck = detectRobotClichés(finalCaption);

    if (robotCheck.is_robot) {
      console.warn(`[Anti-Robot Alert] Draf mengandung pola robotik (${robotCheck.reasons.join(', ')}). Melakukan sanitasi otomatis...`);
      finalCaption = finalCaption
        .replace(/solusi\s+(terbaiknya|terbaik|tepat|sempurna)\s*:\s*/gi, '')
        .replace(/keunggulan\s+(produk|utama|ini)\s*:\s*/gi, '')
        .replace(/fitur\s+(unggulan|utama)\s*:\s*/gi, '')
        .replace(/^[•\-\*]\s+/gm, '') // Hapus bullet points
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    const targetLink = shortlinkUrl || product.affiliate_url || product.product_url || '';

    // 4. Penataan Link untuk Mode Threads No-Media (Link Card) & Facebook
    if (isThreads) {
      if (isThreadsNoMedia) {
        if (targetLink && !finalCaption.includes(targetLink)) {
          finalCaption = `${finalCaption}\n\n${targetLink}`.trim();
        }
      }
      // Pangkas aman untuk API Threads (<480 karakter)
      if (finalCaption.length > 470) {
        if (isThreadsNoMedia && targetLink && finalCaption.includes(targetLink)) {
          const linkPart = `\n\n${targetLink}`;
          const maxText = 470 - linkPart.length;
          const textBefore = finalCaption.replace(targetLink, '').trim();
          finalCaption = `${textBefore.slice(0, maxText - 3)}...${linkPart}`.trim();
        } else {
          finalCaption = finalCaption.slice(0, 465) + '...';
        }
      }
    } else if (platform === 'facebook') {
      // Facebook: Tautan langsung di caption
      if (targetLink && !finalCaption.includes(targetLink)) {
        finalCaption = `${finalCaption}\n\n🛒 Cek produk original di sini:\n${targetLink}`.trim();
      }
    }

    // 5. Susun First-Reply untuk Threads Visual Mode
    let firstReplyText = '';
    if (isThreads && !isThreadsNoMedia) {
      let replyIntro = cleanCaptionText(parsedCopy.first_reply_intro || 'Spill link produk aslinya di sini ya 👇');
      replyIntro = replyIntro
        .replace(/https?:\/\/[^\s]+/gi, '')
        .replace(/s\.id\/[^\s]+/gi, '')
        .replace(/bit\.ly\/[^\s]+/gi, '')
        .replace(/shope\.ee\/[^\s]+/gi, '')
        .replace(/shopee\.co\.id\/[^\s]+/gi, '')
        .replace(/\{SHORTLINK\}/g, '')
        .replace(/🛒\s*$/g, '')
        .trim();

      if (!replyIntro) replyIntro = 'Spill link produk aslinya di sini ya 👇';
      firstReplyText = `${replyIntro}\n🛒 ${targetLink}`.trim();
    }

    // 6. Hitung Sidik Jari Konten
    const rawHook = cleanCaptionText(parsedCopy.raw_hook || finalCaption.split('\n')[0]);
    const fingerprint = generateContentFingerprint({
      productId: product.id,
      hookText: rawHook,
      captionText: finalCaption,
      mediaUrl: ''
    });

    return {
      caption: finalCaption,
      first_reply_text: firstReplyText,
      cta_type: isThreadsNoMedia ? 'link_card_cta' : (parsedCopy.cta_type || strategy.ctaClass || 'soft_cta'),
      title: `${product.title.slice(0, 45)}...`,
      persona_id: strategy.persona.id,
      persona_name: strategy.persona.name,
      archetype_id: strategy.archetype.id,
      archetype_name: strategy.archetype.name,
      template_id: `archetype_${strategy.archetype.id}`,
      template_name: `${strategy.persona.name} · ${strategy.archetype.name}`,
      hook_type: activeAngle,
      copy_angle: activeAngle,
      natural_product_reference: naturalProductRef,
      content_fingerprint: fingerprint,
      raw_hook: rawHook,
    };
  } catch (err) {
    console.error('[generatePostContent Error]:', err.message);
    throw err;
  }
}

module.exports = {
  generatePostContent,
  extractNaturalReference,
  cleanCaptionText,
  buildSystemPrompt,
};


