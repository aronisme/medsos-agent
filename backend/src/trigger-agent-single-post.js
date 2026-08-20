const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { db } = require('./config/firebase');
const { profileShopeeProduct } = require('./services/agent/productIntelligenceService');
const { curateProductMedia } = require('./services/agent/mediaEvaluatorService');
const { generatePostContent } = require('./services/agent/copywritingService');
const { createPostShortlink } = require('./services/agent/orchestratorService');
const { publishPostNow } = require('./services/postService');

async function triggerSinglePost() {
  const userId = 'uJhx9rqu8QXrhBELW56nclJNRyk2';
  console.log('=== 🤖 MEMICU AGEN OTONOM UNTUK MEMBUAT 1 POSTINGAN REAL-TIME ===\n');

  // 1. Ambil 1 produk affiliate dari katalog
  const prodSnap = await db.collection('affiliate_products')
    .where('user_id', '==', userId)
    .get();

  if (prodSnap.empty) {
    console.error('❌ Tidak ada produk di katalog affiliate.');
    process.exit(1);
  }

  const allProducts = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Pilih produk acak yang memiliki judul dan gambar
  const validProducts = allProducts.filter(p => p.title && (p.images?.length > 0 || p.image || p.thumbnail_url));
  const selectedProduct = validProducts[Math.floor(Math.random() * validProducts.length)];

  console.log(`1. 📦 Produk Terpilih: "${selectedProduct.title}"`);
  console.log(`   - Kategori: ${selectedProduct.category || 'General'}`);
  console.log(`   - Harga Promo: Rp ${Number(selectedProduct.price_discount || selectedProduct.price || 0).toLocaleString('id-ID')}`);
  console.log(`   - Diskon: ${selectedProduct.discount_percentage || 0}%\n`);

  // 2. Intelligence Profiling & Copy Angle Selection
  console.log('2. 🧠 Menjalankan AI Product Intelligence & Copywriting Engine...');
  const profile = await profileShopeeProduct(selectedProduct, userId);
  const copyAngle = profile.recommended_angles?.[0] || 'Problem-Agitate-Solution';
  console.log(`   - Sudut Pandang (Angle): ${copyAngle}`);
  console.log(`   - Target Audiens: ${profile.target_audience || 'Shopee Shoppers'}`);

  // 3. Media Curation (Gambar / Video)
  console.log('3. 🖼️ Kurasi Media Produk...');
  const mediaCuration = await curateProductMedia(selectedProduct, 'auto', userId);
  const formattedMedia = (mediaCuration.selected_media || []).map(item => {
    const url = typeof item === 'string' ? item : item?.url || item?.media_url || '';
    const type = (typeof item === 'object' && item?.type) ? item.type : (mediaCuration.media_type || 'image');
    return { media_url: url, media_type: type };
  }).filter(m => m.media_url && typeof m.media_url === 'string' && m.media_url.startsWith('http'));

  console.log(`   - Jumlah Media Terpilih: ${formattedMedia.length} (${formattedMedia.map(m => m.media_type).join(', ')})`);

  // 4. Generate Internal Affiliate Shortlink
  console.log('4. 🔗 Membuat Link Afiliasi Terlacak...');
  const shortlinkUrl = await createPostShortlink(selectedProduct, 'facebook', userId);
  console.log(`   - Link Afiliasi: ${shortlinkUrl}\n`);

  // 5. Generate High-Converting AI Copywriting
  console.log('5. ✍️ Menghasilkan Teks Copywriting...');
  const generatedCopy = await generatePostContent({
    product: selectedProduct,
    profile,
    shortlinkUrl,
    copyAngle,
    platform: 'facebook',
    userId
  });

  console.log('----------------------------------------------------');
  console.log('📄 HASIL COPYWRITING POSTINGAN:');
  console.log('----------------------------------------------------');
  console.log(generatedCopy.caption);
  console.log('----------------------------------------------------\n');

  // 6. Ambil Akun Media Sosial Aktif
  const accSnap = await db.collection('social_accounts')
    .where('user_id', '==', userId)
    .where('is_active', 'in', [1, true, '1'])
    .get();

  const accounts = accSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (accounts.length === 0) {
    console.error('❌ Tidak ada akun media sosial aktif terhubung.');
    process.exit(1);
  }

  // Siapkan Target Pengiriman (Facebook & Threads)
  const targets = accounts
    .filter(a => a.platform === 'facebook' || a.platform === 'threads')
    .map(a => ({
      id: Math.random().toString(36).substring(2, 9),
      account_id: a.id,
      platform: a.platform,
      page_name: a.page_name || a.username,
      status: 'pending',
      error_message: null,
      attempt_count: 0
    }));

  console.log(`6. 🎯 Menyiapkan Target Penerbitan (${targets.length} Akun):`);
  targets.forEach(t => console.log(`   - [${t.platform.toUpperCase()}]: ${t.page_name} (ID: ${t.account_id})`));

  // 7. Simpan Postingan ke Database
  const newPostDoc = {
    user_id: userId,
    product_id: selectedProduct.id,
    title: selectedProduct.title?.slice(0, 50) + '...',
    content: generatedCopy.caption,
    media: formattedMedia,
    targets: targets,
    status: 'draft',
    post_type: 'feed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const docRef = await db.collection('posts').add(newPostDoc);
  console.log(`\n7. 💾 Postingan berhasil dibuat di Database (Post ID: ${docRef.id})`);

  // 8. Langsung Publikasikan Sekarang
  console.log('\n8. 🚀 Menerbitkan Postingan Secara Langsung...');
  const publishResult = await publishPostNow(docRef.id);
  console.log('\n=== 🎉 HASIL EKSEKUSI PENERBITAN: ===');
  console.log(JSON.stringify(publishResult, null, 2));

  process.exit(0);
}

triggerSinglePost().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
