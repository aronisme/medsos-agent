/**
 * Kumpulan template variasi kalimat balasan untuk menjaga naturalitas
 */
const REPLY_TEMPLATES = {
  helpful: [
    (author, link, title) => `Halo kak, kalau cari ${title ? `"${title}"` : 'yang model ini'}, bisa langsung cek detail dan diskonnya di sini ya: ${link}`,
    (author, link, title) => `Boleh kak, ini rekomendasi ${title || 'produknya'} yang bahannya bagus & terpercaya: ${link}`,
    (author, link) => `Halo! Ini link produk resmi Shopee-nya ya kak, selamat belanja: ${link}`,
  ],
  casual: [
    (author, link, title) => `Yang ini cakep banget kak, lagi ada promo juga: ${link} 🥰`,
    (author, link) => `Spill linknya ada di sini ya kak: ${link} ✨`,
    (author, link) => `Ini kak linknya, buruan checkout mumpung ready: ${link} 🛒`,
  ],
  direct: [
    (author, link) => `Ini link produknya ya kak: ${link}`,
    (author, link, title) => `Link untuk ${title || 'produk'}: ${link}`,
  ],
};

/**
 * Menyusun kalimat balasan akhir dengan menyuntikkan link afiliasi resmi
 * @param {Object} params 
 * @param {'helpful'|'casual'|'direct'} [params.style='helpful'] 
 * @param {string} params.affiliateUrl 
 * @param {string} [params.productTitle] 
 * @param {string} [params.authorUsername] 
 */
function composeReply({ style = 'helpful', affiliateUrl, productTitle = '', authorUsername = '' }) {
  if (!affiliateUrl) throw new Error('affiliateUrl wajib diisi untuk menyusun balasan.');

  const pool = REPLY_TEMPLATES[style] || REPLY_TEMPLATES.helpful;
  const randomIndex = Math.floor(Math.random() * pool.length);
  const generator = pool[randomIndex];

  const cleanTitle = productTitle ? productTitle.slice(0, 30).trim() : '';
  const finalReply = generator(authorUsername, affiliateUrl, cleanTitle);

  return finalReply.slice(0, 495);
}

module.exports = {
  composeReply,
  REPLY_TEMPLATES,
};
