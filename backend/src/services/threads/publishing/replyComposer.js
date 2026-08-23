/**
 * Kumpulan template variasi kalimat balasan untuk menjaga naturalitas
 */
const REPLY_TEMPLATES = {
  price_inquiry: [
    (author, link, title, priceText) => priceText
      ? `Halo kak, harganya sekitar ${priceText} yaa (lagi ada diskon & promo gratis ongkir). Link toko resminya di sini: ${link} ✨`
      : `Halo kak, harganya terjangkau banget mumpung lagi promo. Bisa langsung cek detail harganya di sini ya: ${link} ✨`,
    (author, link, title, priceText) => priceText
      ? `Harganya ramah kantong kak cuma ${priceText}, kualitasnya bagus bgt. Cek promo dan tokonya di sini: ${link} 🛒`
      : `Spill harganya murah bgt kak, lagi promo diskon. Link produk resminya ada di sini ya: ${link} 🛒`,
    (author, link, title, priceText) => priceText
      ? `Bisa langsung di-checkout di harga ${priceText} mumpung ready ya kak: ${link} 🥰`
      : `Bisa langsung cek info harga promo & voucher diskonnya di sini ya kak: ${link} 🥰`,
  ],
  product_question: [
    (author, link, title) => `Halo kak, untuk detail spesifikasi & varian ${title ? `"${title}"` : 'produk ini'} bisa dicek langsung di etalase tokonya ya: ${link} ✨`,
    (author, link, title) => `Bisa banget kak! Buat info bahan, ukuran & detail lengkapnya langsung lihat di link resmi ini ya: ${link} 🛒`,
  ],
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
 * @param {number|string} [params.price]
 * @param {string} [params.authorUsername] 
 * @param {string} [params.intent='LINK_REQUEST']
 */
function composeReply({ style = 'helpful', affiliateUrl, productTitle = '', price = 0, authorUsername = '', intent = 'LINK_REQUEST' }) {
  if (!affiliateUrl) throw new Error('affiliateUrl wajib diisi untuk menyusun balasan.');

  let pool;
  if (intent === 'PRICE_INQUIRY') {
    pool = REPLY_TEMPLATES.price_inquiry;
  } else if (intent === 'PRODUCT_QUESTION') {
    pool = REPLY_TEMPLATES.product_question;
  } else {
    pool = REPLY_TEMPLATES[style] || REPLY_TEMPLATES.helpful;
  }

  const randomIndex = Math.floor(Math.random() * pool.length);
  const generator = pool[randomIndex];

  const cleanTitle = productTitle ? productTitle.slice(0, 30).trim() : '';
  const numPrice = Number(price) || 0;
  const priceText = numPrice > 0 ? `Rp ${numPrice.toLocaleString('id-ID')}` : '';

  const finalReply = generator(authorUsername, affiliateUrl, cleanTitle, priceText);

  return finalReply.slice(0, 495);
}

module.exports = {
  composeReply,
  REPLY_TEMPLATES,
};
