const { callUnifiedAI } = require('./aiQueueService');
const { selectTemplateByBandit, fillTemplatePlaceholders } = require('./templateService');
const { generateContentFingerprint } = require('./contentFingerprint');

const COPYWRITER_SYSTEM_PROMPT = `Kamu adalah Senior Copywriter & Direct Response Marketer khusus Social Media Affiliate Marketing di Indonesia (Facebook, Threads).
Tugasmu adalah meracik copywriting yang sangat menarik, natural dalam Bahasa Indonesia sehari-hari, tidak terkesan kaku atau robotik, memahami kebiasaan belanja online masyarakat Indonesia (COD, Gratis Ongkir, Flash Sale, Promo Gajian), dan memiliki Call To Action (CTA) klik link yang kuat.

ATURAN WAJIB PENULISAN:
1. JANGAN PERNAH MENGGUNAKAN TANDA BINTANG ** atau * atau format markdown apapun! Tulis langsung teks bersih dan jelas.
2. Gunakan simbol bullet biasa (•) untuk daftar keunggulan tanpa tanda bintang.
3. Pahami konteks waktu Indonesia (WIB):
   - Sesi Pagi (07:00 - 09:00 WIB): Gaya bahasa segar menyambut aktivitas pagi / persiapan kerja / kuliah.
   - Sesi Siang (11:30 - 13:30 WIB): Gaya bahasa santai jam istirahat makan siang / rehat sejenak.
   - Sesi Malam (19:00 - 21:00 WIB): Gaya bahasa santai waktu rebahan malam / santai santai / waktu checkout Shopee.
4. Sesuaikan tone berdasarkan platform:
   - Facebook: Storytelling mengalir, relatable, emosional, informasi harga & promo jelas.
   - Threads: WAJIB SANGAT RINGKAS (Maksimal 300-350 karakter total karena batas Threads API 500 karakter)! Punchy, to-the-point, santai seperti obrolan teman, direct hook 1 baris, maksimal 2 bullet point pendek, dan 2-3 hashtag saja.

Keluarkan output HANYA dalam format JSON valid tanpa teks pengantar:
{
  "hook": "Kalimat pembuka hook 1-2 baris yang bikin penasaran / menghentikan scrolling",
  "pain_point_text": "Penjelasan singkat masalah yang dialami audiens",
  "usp_bullets": "• Poin keunggulan 1\\n• Poin keunggulan 2\\n• Poin keunggulan 3",
  "hashtags": "#Tag1 #Tag2 #Tag3 #ShopeeAffiliate"
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
    // Hapus markdown bold/italic: **teks** -> teks, *teks* -> teks
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
 * @returns {Promise<Object>} { caption, template_id, template_name, hook_type, copy_angle, content_fingerprint }
 */
async function generatePostContent({
  product,
  profile,
  platform = 'instagram',
  angle = 'Problem-Agitate-Solution',
  objective = 'clicks',
  shortlinkUrl,
  sessionInfo = { session: 'Siang', hour: 12 },
  excludedTemplateIds = []
}) {
  try {
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
    try {
      const rawAiResponse = await callUnifiedAI({
        systemPrompt: COPYWRITER_SYSTEM_PROMPT,
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
      parsedCopy = {
        hook: `Rekomendasi racun shopee yang wajib kamu punya! ✨`,
        pain_point_text: (profile?.pain_points && profile.pain_points[0]) || 'Bikin aktivitas harian jadi lebih simpel',
        usp_bullets: (profile?.usp || []).map(u => `• ${u}`).join('\n') || `• Kualitas terbaik\n• Harga bersahabat\n• Original`,
        hashtags: `#RacunShopee #${(profile?.niche || 'Belanja').replace(/\s+/g, '')} #ShopeeAffiliate`
      };
    }

    const priceText = `Rp ${Number(product.price || 0).toLocaleString('id-ID')}`;
    const discountText = product.discount ? `(${product.discount})` : '';

    // Untuk Threads, persingkat nama produk agar tidak memakan limit 500 karakter
    const productName = platform === 'threads'
      ? cleanCaptionText(product.title).slice(0, 45).trim()
      : cleanCaptionText(product.title);

    // 3. Rakit Placeholder Template
    const rawFilledCaption = fillTemplatePlaceholders(template.structure, {
      hook: cleanCaptionText(parsedCopy.hook),
      pain_point: cleanCaptionText(parsedCopy.pain_point_text),
      product_name: productName,
      price_discount: `${priceText} ${discountText}`.trim(),
      discount: product.discount || 'Spesial Promo',
      usp_bullets: cleanCaptionText(parsedCopy.usp_bullets),
      cta_link: shortlinkUrl || product.affiliate_url || product.product_url,
      hashtags: parsedCopy.hashtags,
    });

    let filledCaption = cleanCaptionText(rawFilledCaption);

    // Khusus Threads: Pangkas otomatis jika melebihi 480 karakter agar 100% aman di Meta Threads API
    if (platform === 'threads' && filledCaption.length > 480) {
      const cta = shortlinkUrl || product.affiliate_url || product.product_url || '';
      const ctaIndex = filledCaption.indexOf(cta);
      if (ctaIndex !== -1) {
        const beforeCta = filledCaption.slice(0, ctaIndex).trim();
        const afterCta = filledCaption.slice(ctaIndex + cta.length).trim();
        const maxBeforeLen = 480 - cta.length - 20 - (afterCta ? afterCta.length : 0);
        const trimmedBefore = beforeCta.slice(0, Math.max(maxBeforeLen, 100)).trim();
        filledCaption = `${trimmedBefore}\n\n${cta}${afterCta ? `\n\n${afterCta}` : ''}`.slice(0, 480).trim();
      } else {
        filledCaption = filledCaption.slice(0, 475) + '...';
      }
    }

    // 4. Hitung Content Fingerprint
    const fingerprint = generateContentFingerprint({
      productId: product.id,
      hookText: cleanCaptionText(parsedCopy.hook),
      captionText: filledCaption,
      mediaUrl: ''
    });

    return {
      caption: filledCaption,
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
};

