const { db } = require('../../config/firebase');
const { callUnifiedAI } = require('./aiQueueService');
const { logAgentDecision } = require('./decisionLogger');

const PROFILING_SYSTEM_PROMPT = `Kamu adalah Senior Product Intelligence Analyst untuk Social Media Affiliate Marketing.
Tugasmu adalah menganalisis data produk dari marketplace (Shopee) dan menghasilkan profil persona, masalah utama (pain points), keunggulan unik (USP), dan rekomendasi sudut pandang pemasaran.

Keluarkan output HANYA dalam format JSON valid tanpa teks pembuka/penutup dengan struktur:
{
  "niche": "Kategori spesifik (misal: Gadget & Audio, Fashion Wanita, Skincare & Beauty, Perlengkapan Rumah, dll)",
  "target_audience": "Persona target konsumen (misal: Mahasiswa & Gamers, Ibu Rumah Tangga, Wanita Karir Muda)",
  "pain_points": ["Masalah 1 yang dialami konsumen", "Masalah 2 yang dialami konsumen", "Masalah 3"],
  "usp": ["Keunggulan utama 1", "Keunggulan utama 2", "Keunggulan utama 3"],
  "price_tier": "Budget | Mid-Range | Premium",
  "recommended_angles": ["Problem-Agitate-Solution", "Honest Review", "Flash Promo FOMO", "Aesthetic Showcase", "Storytelling"],
  "key_features_summary": "Ringkasan 1-2 kalimat keunggulan produk yang menjual"
}`;

/**
 * Menganalisis dan mengekstrak intelligence dari produk Shopee
 * @param {Object} product - Objek data produk dari affiliate_products
 * @param {string} userId - ID Pengguna
 * @returns {Promise<Object>}
 */
async function profileShopeeProduct(product, userId = 'system') {
  try {
    if (!product || !product.title) {
      throw new Error('Data produk tidak valid atau judul kosong.');
    }

    // Jika sudah pernah diprofilkan dan ada datanya, kembalikan profil yang ada
    if (product.agent_profile && product.agent_profile.niche && product.agent_profile.pain_points?.length > 0) {
      return product.agent_profile;
    }

    const userPrompt = [
      `Judul Produk: ${product.title}`,
      `Harga: Rp ${Number(product.price || 0).toLocaleString('id-ID')}`,
      `Diskon: ${product.discount || '-'}`,
      `Rating: ${product.rating || '5.0'} (${product.sold_count || '0 terjual'})`,
      `Toko: ${product.shop_name || '-'} (${product.shop_location || 'Indonesia'})`,
      `Deskripsi Produk: ${(product.description || '').slice(0, 800)}`,
      `Varian: ${(product.variants || []).map(v => v.name).join(', ') || 'Standard'}`
    ].join('\n');

    const rawResponse = await callUnifiedAI({
      systemPrompt: PROFILING_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.3,
      jsonMode: true,
      maxTokens: 500
    });

    let parsed = null;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      // Fallback regex jika JSON terbungkus backtick markdown
      const match = rawResponse.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    if (!parsed || !parsed.niche) {
      throw new Error('Gagal mem-parsing hasil analisis AI.');
    }

    const agentProfile = {
      niche: parsed.niche,
      target_audience: parsed.target_audience || 'Umum',
      pain_points: Array.isArray(parsed.pain_points) ? parsed.pain_points : [],
      usp: Array.isArray(parsed.usp) ? parsed.usp : [],
      price_tier: parsed.price_tier || 'Mid-Range',
      recommended_angles: Array.isArray(parsed.recommended_angles) ? parsed.recommended_angles : ['Problem-Agitate-Solution', 'Honest Review'],
      key_features_summary: parsed.key_features_summary || product.title,
      profiled_at: new Date().toISOString()
    };

    // Update di database produk
    if (product.id) {
      await db.collection('affiliate_products').doc(product.id).update({
        agent_profile: agentProfile,
        category: agentProfile.niche, // sinkronkan kategori
        updated_at: new Date().toISOString()
      });

      await logAgentDecision({
        userId,
        decisionType: 'PRODUCT_PROFILING',
        productId: product.id,
        summary: `Profiling Selesai: Niche ${agentProfile.niche} (${agentProfile.target_audience})`,
        reasoning: `Ekstraksi ${agentProfile.pain_points.length} pain points dan ${agentProfile.usp.length} USP utama dari deskripsi Shopee.`,
        metadata: agentProfile
      });
    }

    return agentProfile;
  } catch (err) {
    console.error(`[profileShopeeProduct Error] ID ${product?.id}:`, err.message);
    // Fallback profile jika AI gagal
    const fallbackProfile = {
      niche: product.category || 'Shopee Affiliate',
      target_audience: 'Pencinta Belanja Online',
      pain_points: ['Mencari produk berkualitas harga terjangkau'],
      usp: ['Harga promo & gratis ongkir'],
      price_tier: 'Mid-Range',
      recommended_angles: ['Honest Review', 'Flash Promo FOMO'],
      key_features_summary: product.title,
      profiled_at: new Date().toISOString(),
      is_fallback: true
    };
    return fallbackProfile;
  }
}

module.exports = {
  profileShopeeProduct,
};
