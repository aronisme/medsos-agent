const { callMistralAI } = require('./aiQueueService');
const { selectTemplateByBandit, fillTemplatePlaceholders } = require('./templateService');
const { generateContentFingerprint } = require('./contentFingerprint');

const COPYWRITER_SYSTEM_PROMPT = `Kamu adalah Senior Copywriter & Direct Response Marketer khusus Social Media Affiliate Marketing (Facebook, Instagram, Threads).
Tugasmu adalah meracik copywriting yang sangat menarik, natural, tidak terkesan kaku atau robotik, dan memiliki Call To Action (CTA) klik link yang kuat.

Sesuaikan tone berdasarkan platform:
- Instagram: Visual hook yang estetik, rapi, line breaks bersih, emoji proporsional, hashtag relevan.
- Facebook: Storytelling mengalir, relatable, emosional, informasi promo jelas.
- Threads: Punchy, to-the-point, santai seperti obrolan teman, direct hook.

Keluarkan output HANYA dalam format JSON valid tanpa teks pengantar:
{
  "hook": "Kalimat pembuka hook 1-2 baris yang bikin penasaran / menghentikan scrolling",
  "pain_point_text": "Penjelasan singkat masalah yang dialami audiens",
  "usp_bullets": "• Poin keunggulan 1\\n• Poin keunggulan 2\\n• Poin keunggulan 3",
  "hashtags": "#Tag1 #Tag2 #Tag3 #ShopeeAffiliate"
}`;

/**
 * Meracik konten postingan lengkap untuk produk Shopee
 * @param {Object} opts
 * @param {Object} opts.product - Objek data produk
 * @param {Object} opts.profile - Profil hasil Product Intelligence
 * @param {string} opts.platform - 'facebook' | 'instagram' | 'threads'
 * @param {string} [opts.angle] - Sudut pandang copy
 * @param {string} [opts.objective] - 'clicks' | 'engagement'
 * @param {string} opts.shortlinkUrl - URL shortlink afiliasi
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

    // 2. Generate Hook & Copy Components via AI
    const userPrompt = [
      `Produk: ${product.title}`,
      `Niche: ${profile?.niche || 'Umum'}`,
      `Target Persona: ${profile?.target_audience || 'Pembeli Online'}`,
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
      const rawAiResponse = await callMistralAI({
        systemPrompt: COPYWRITER_SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.8,
        jsonMode: true
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

    // 3. Rakit Placeholder Template
    const filledCaption = fillTemplatePlaceholders(template.structure, {
      hook: parsedCopy.hook,
      pain_point: parsedCopy.pain_point_text,
      product_name: product.title,
      price_discount: `${priceText} ${discountText}`.trim(),
      discount: product.discount || 'Spesial Promo',
      usp_bullets: parsedCopy.usp_bullets,
      cta_link: shortlinkUrl || product.affiliate_url || product.product_url,
      hashtags: parsedCopy.hashtags,
    });

    // 4. Hitung Content Fingerprint
    const fingerprint = generateContentFingerprint({
      productId: product.id,
      hookText: parsedCopy.hook,
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
      raw_hook: parsedCopy.hook,
    };
  } catch (err) {
    console.error('[generatePostContent Error]:', err.message);
    throw err;
  }
}

module.exports = {
  generatePostContent,
};
