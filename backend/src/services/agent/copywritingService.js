const { callUnifiedAI } = require('./aiQueueService');
const { selectTemplateByBandit, fillTemplatePlaceholders } = require('./templateService');
const { generateContentFingerprint } = require('./contentFingerprint');

const FACEBOOK_SYSTEM_PROMPT = `Kamu adalah Senior Copywriter & Direct Response Marketer khusus Facebook Page & Reels Affiliate Marketing di Indonesia.
Tugasmu adalah meracik copywriting yang sangat menarik, natural dalam Bahasa Indonesia sehari-hari, tidak terkesan kaku atau robotik, memahami kebiasaan belanja online masyarakat Indonesia (COD, Gratis Ongkir, Flash Sale, Promo Gajian), dan memiliki Call To Action (CTA) klik link yang jelas.

ATURAN WAJIB PENULISAN:
1. JANGAN PERNAH MENGGUNAKAN TANDA BINTANG ** atau * atau format markdown apapun! Tulis langsung teks bersih dan jelas.
2. Gunakan simbol bullet biasa (•) untuk daftar keunggulan tanpa tanda bintang.
3. Pahami konteks waktu Indonesia (WIB):
   - Sesi Pagi (07:00 - 09:00 WIB): Gaya bahasa segar menyambut aktivitas pagi / persiapan kerja / kuliah.
   - Sesi Siang (11:30 - 13:30 WIB): Gaya bahasa santai jam istirahat makan siang / rehat sejenak.
   - Sesi Malam (19:00 - 21:00 WIB): Gaya bahasa santai waktu rebahan malam / santai santai / waktu checkout Shopee.
4. Gaya Facebook: Storytelling mengalir, relatable, emosional, informasi harga & promo jelas.

Keluarkan output HANYA dalam format JSON valid tanpa teks pengantar:
{
  "hook": "Kalimat pembuka hook 1-2 baris yang bikin penasaran / menghentikan scrolling",
  "pain_point_text": "Penjelasan singkat masalah yang dialami audiens",
  "usp_bullets": "• Poin keunggulan 1\\n• Poin keunggulan 2\\n• Poin keunggulan 3",
  "hashtags": "#Tag1 #Tag2 #Tag3 #ShopeeAffiliate"
}`;

const THREADS_CONVERSATIONAL_PROMPT = `Kamu adalah Creator & Copywriter Organik khusus Meta Threads Indonesia.
Tugasmu adalah membuat postingan Threads yang SANGAT NATURAL, santai seperti obrolan teman/sahabat (bestie talk), memicu percakapan (conversation-first), dan TIDAK TERASA SEPERTI BOT IKLAN.

KEBIJAKAN COPYWRITING THREADS (WAJIB DIPATUHI):
1. ZERO HASHTAG CLUTTER: DILARANG membuat tumpukan hashtag tradisional (#Shopee #RacunShopee dll). Kosongkan atau maksimal 1 topic tag tunggal yang sangat relevan.
2. JANGAN PERNAH MENGGUNAKAN TANDA BINTANG ** atau * atau markdown apapun.
3. Target Panjang Teks: Ringkas & padat, target gaya 150 - 350 karakter (maksimal aman < 480 karakter).
4. Gunakan gaya bahasa & slang populer Threads yang terbukti disukai audiens:
   - Hook Emosional / Value Shock: "IN THIS ECONOMY ‼️ 🎀", "MAAF TERIAK 😭", "KAAAK TOLONG GAMAU TAU SENDIRIAN 😭🤌", "JUJUR MAU NANGISSS!!! 😭", "GURLSSS, AKU LAGI KECINTAAN BANGET..."
   - Slang Percakapan: syok banget, looksnya keliatan mahal, kaya orang have, harga anak kos, bikin aman dompet, effortless, put together, cakep parah, auto kalap, gemesh.
5. Variasikan Call To Action (CTA Class):
   Pilih salah satu tipe CTA yang paling pas untuk postingan ini:
   - "conversation_cta": Memantik opini/tanya audiens (contoh: "menurut kalian mending warna matcha apa peach?", "kalian tim mana nih?")
   - "curiosity_cta": Memancing rasa penasaran (contoh: "ternyata yang termurah justru yang ini 😭")
   - "soft_cta": Tawaran halus (contoh: "detailnya aku spill di reply ya", "aku drop di reply ya 👇")
   - "direct_link_cta": Ajakan link langsung (contoh: "yang nanya link, aku drop di bawah 👇")
   - "no_cta": Tanpa ajakan sama sekali (murni humor/relatable sharing).

Keluarkan output HANYA dalam format JSON valid tanpa teks pengantar:
{
  "hook": "Kalimat hook pembuka 1 baris huruf kapital / ekspresi emosi santai",
  "body_insight": "Insight / review singkat 1-2 baris yang relatable & effortless",
  "usp_bullets": "• Poin singkat 1\\n• Poin singkat 2",
  "cta_type": "soft_cta",
  "cta_text": "Kalimat penutup CTA sesuai cta_type terpilih",
  "first_reply_text": "Spill link produk aslinya di sini ya 👇\\n🛒 {SHORTLINK}"
}`;

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
 * Sanitasi teks caption untuk menghapus markdown asterisks (*, **) dan deduplikasi hashtag
 */
function cleanCaptionText(text = '') {
  if (!text) return '';
  const cleaned = String(text)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/^#+\s+/gm, '') // Hapus # heading markdown
    .trim();

  return deduplicateHashtags(cleaned);
}

/**
 * Meracik konten postingan lengkap untuk produk Shopee
 * @param {Object} opts
 * @param {Object} opts.product - Objek data produk
 * @param {Object} opts.profile - Profil hasil Product Intelligence
 * @param {string} opts.platform - 'facebook' | 'instagram' | 'threads'
 * @param {string} [opts.angle] - Sudut pandang copy
 * @param {string} [opts.objective] - 'clicks' | 'engagement'
 * @param {string} opts.shortlinkUrl - URL shortlink afiliasi
 * @param {Object} [opts.sessionInfo] - { session: 'Pagi'|'Siang'|'Malam', hour: number }
 * @param {Array} [opts.excludedTemplateIds] - Template yang dihindari (anti-duplikasi)
 * @returns {Promise<Object>} { caption, first_reply_text, cta_type, template_id, template_name, hook_type, copy_angle, content_fingerprint }
 */
async function generatePostContent({
  product,
  profile,
  platform = 'facebook',
  angle = 'Problem-Agitate-Solution',
  objective = 'clicks',
  shortlinkUrl,
  sessionInfo = { session: 'Siang', hour: 12 },
  excludedTemplateIds = []
}) {
  try {
    const isThreads = platform === 'threads';

    // 1. Pilih Template terbaik via Multi-Armed Bandit
    const template = await selectTemplateByBandit({
      platform,
      niche: profile?.niche || 'Universal',
      objective,
      excludedTemplateIds
    });

    const activeAngle = angle || template.angle || 'Problem-Agitate-Solution';

    // 2. Generate Hook & Copy Components via AI dengan Konteks Waktu Indonesia
    const userPrompt = [
      `Produk: ${product.title}`,
      `Niche: ${profile?.niche || 'Umum'}`,
      `Target Persona: ${profile?.target_audience || 'Pembeli Online Indonesia'}`,
      `Konteks Waktu Tayang: Sesi ${sessionInfo.session || 'Siang'} (${sessionInfo.hour || 12}:00 WIB)`,
      `Pain Points: ${(profile?.pain_points || []).join(', ')}`,
      `Keunggulan (USP): ${(profile?.usp || []).join(', ')}`,
      `Harga Asli: Rp ${Number(product.original_price || product.price || 0).toLocaleString('id-ID')}`,
      `Harga Promo: Rp ${Number(product.price || 0).toLocaleString('id-ID')}`,
      `Diskon: ${product.discount || 'Spesial'}`,
      `Platform: ${platform.toUpperCase()}`,
      `Sudut Pandang (Angle): ${activeAngle}`,
      `Objective: ${objective}`
    ].join('\n');

    let parsedCopy = null;
    const systemPrompt = isThreads ? THREADS_CONVERSATIONAL_PROMPT : FACEBOOK_SYSTEM_PROMPT;

    try {
      const rawAiResponse = await callUnifiedAI({
        systemPrompt,
        userPrompt,
        temperature: 0.8,
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
      console.warn(`[generatePostContent] AI call warning: ${aiErr.message}. Using structured fallback.`);
      if (isThreads) {
        parsedCopy = {
          hook: `IN THIS ECONOMY ‼️ 🎀 nemu barang secakep ini harganya ramah kantong banget`,
          body_insight: (profile?.pain_points && profile.pain_points[0]) || 'Bikin aktivitas harian jadi lebih simpel dan effortless',
          usp_bullets: (profile?.usp || []).slice(0, 2).map(u => `• ${u}`).join('\n') || `• Kualitas terbaik\n• Bikin aman dompet`,
          cta_type: 'soft_cta',
          cta_text: 'detailnya aku spill di reply ya 👇',
          first_reply_text: `Spill link toko aslinya di sini ya 👇\n🛒 {SHORTLINK}`
        };
      } else {
        parsedCopy = {
          hook: `Rekomendasi racun shopee yang wajib kamu punya! ✨`,
          pain_point_text: (profile?.pain_points && profile.pain_points[0]) || 'Bikin aktivitas harian jadi lebih simpel',
          usp_bullets: (profile?.usp || []).map(u => `• ${u}`).join('\n') || `• Kualitas terbaik\n• Harga bersahabat\n• Original`,
          hashtags: `#RacunShopee #${(profile?.niche || 'Belanja').replace(/\s+/g, '')} #ShopeeAffiliate`
        };
      }
    }

    const priceText = `Rp ${Number(product.price || 0).toLocaleString('id-ID')}`;
    const discountText = product.discount ? `(${product.discount})` : '';

    // Untuk Threads, persingkat nama produk agar tidak memakan ruang teks
    const productName = isThreads
      ? cleanCaptionText(product.title).slice(0, 40).trim()
      : cleanCaptionText(product.title);

    const targetLink = shortlinkUrl || product.affiliate_url || product.product_url || '';

    // 3. Rakit Placeholder Template
    const rawFilledCaption = fillTemplatePlaceholders(template.structure, {
      hook: cleanCaptionText(parsedCopy.hook),
      pain_point: cleanCaptionText(parsedCopy.pain_point_text || parsedCopy.body_insight),
      product_name: productName,
      price_discount: `${priceText} ${discountText}`.trim(),
      discount: product.discount || 'Spesial Promo',
      usp_bullets: cleanCaptionText(parsedCopy.usp_bullets),
      cta_link: isThreads ? '' : targetLink, // Threads link ditaruh di first_reply
      hashtags: isThreads ? '' : cleanCaptionText(parsedCopy.hashtags || ''),
    });

    let filledCaption = cleanCaptionText(rawFilledCaption);

    // Tambahkan CTA text jika ada dan platform Threads
    if (isThreads && parsedCopy.cta_text && !filledCaption.includes(parsedCopy.cta_text)) {
      filledCaption = `${filledCaption}\n\n${parsedCopy.cta_text}`.trim();
    }

    // Khusus Threads: Pangkas otomatis jika melebihi 480 karakter agar 100% aman di Meta Threads API
    if (isThreads && filledCaption.length > 480) {
      filledCaption = filledCaption.slice(0, 475) + '...';
    }

    // 4. Susun First Reply untuk Threads
    let firstReplyText = '';
    if (isThreads) {
      const templateReply = parsedCopy.first_reply_text || 'Spill link produk aslinya di sini ya 👇\n🛒 {SHORTLINK}';
      firstReplyText = templateReply.replace('{SHORTLINK}', targetLink).trim();
      if (!firstReplyText.includes(targetLink)) {
        firstReplyText = `${firstReplyText}\n🛒 ${targetLink}`.trim();
      }
    }

    // 5. Hitung Content Fingerprint
    const fingerprint = generateContentFingerprint({
      productId: product.id,
      hookText: cleanCaptionText(parsedCopy.hook),
      captionText: filledCaption,
      mediaUrl: ''
    });

    return {
      caption: filledCaption,
      first_reply_text: firstReplyText,
      cta_type: parsedCopy.cta_type || (isThreads ? 'soft_cta' : 'direct_link_cta'),
      title: `${product.title.slice(0, 45)}...`,
      template_id: template.id,
      template_name: template.name,
      hook_type: activeAngle,
      copy_angle: activeAngle,
      content_fingerprint: fingerprint,
      raw_hook: cleanCaptionText(parsedCopy.hook),
    };
  } catch (err) {
    console.error('[generatePostContent Error]:', err.message);
    throw err;
  }
}

module.exports = {
  generatePostContent,
  cleanCaptionText,
  FACEBOOK_SYSTEM_PROMPT,
  THREADS_CONVERSATIONAL_PROMPT,
};


