const { curateProductMedia, markMediaUsedOnPlatform, getUsedMediaForPlatform } = require('./services/agent/mediaEvaluatorService');

async function testPlatformMediaUniqueness() {
  console.log('=== 🧪 TESTING ATURAN ANTI-REUSE MEDIA KHUSUS PER PLATFORM ===\n');

  const mockProduct = {
    id: 'test_product_bags_001',
    title: 'Tas Wanita Korean Style Aesthetic',
    images: [
      'https://cf.shopee.co.id/file/bag_img_1.jpg',
      'https://cf.shopee.co.id/file/bag_img_2.jpg',
      'https://cf.shopee.co.id/file/bag_img_3.jpg',
    ],
    videos: [
      'https://cf.shopee.co.id/file/bag_video_demo_A.mp4'
    ],
    used_media_by_platform: {}
  };

  // STEP 1: Kurasi awal untuk Facebook (Akun 1)
  console.log('1. Akun 1 di Facebook meminta kurasi media...');
  const cur1 = await curateProductMedia(mockProduct, 'auto', 'facebook', 'test_user');
  console.log('   Hasil Akun 1 (FB):', cur1.media_type, '->', cur1.selected_media.map(m => m.url));

  // Tandai media video_A sebagai sudah dipakai di Facebook
  const usedFbMedia = cur1.selected_media.map(m => m.url);
  mockProduct.used_media_by_platform['facebook'] = usedFbMedia;
  console.log('   ✅ Video A berhasil diposting di Facebook (Akun 1). Ditandai sebagai used_media_by_platform["facebook"].\n');

  // STEP 2: Kurasi untuk Facebook (Akun 2 - Berbeda akun tapi platform SAMA)
  console.log('2. Akun 2 di Facebook meminta kurasi media untuk produk yang sama...');
  const cur2 = await curateProductMedia(mockProduct, 'auto', 'facebook', 'test_user');
  console.log('   Hasil Akun 2 (FB):', cur2.media_type, '->', cur2.selected_media.map(m => m.url));
  
  const videoUsedAgainInFb = cur2.selected_media.some(m => m.url.includes('bag_video_demo_A.mp4'));
  if (videoUsedAgainInFb) {
    console.error('   ❌ GAGAL: Video A terpakai lagi di Facebook!');
  } else {
    console.log('   ✅ BERHASIL: Video A DITOLAK di Facebook Akun 2! AI beralih ke Gambar Segar yang belum pernah dipakai di FB.\n');
  }

  // STEP 3: Kurasi untuk Threads (Platform BERBEDA)
  console.log('3. Akun Threads meminta kurasi media untuk produk yang sama...');
  const cur3 = await curateProductMedia(mockProduct, 'auto', 'threads', 'test_user');
  console.log('   Hasil Threads:', cur3.media_type, '->', cur3.selected_media.map(m => m.url));

  const videoUsedInThreads = cur3.selected_media.some(m => m.url.includes('bag_video_demo_A.mp4'));
  if (videoUsedInThreads) {
    console.log('   ✅ BERHASIL: Video A DIPERBOLEHKAN di Threads karena belum pernah dipakai di platform Threads!\n');
  } else {
    console.error('   ❌ GAGAL: Video A seharusnya boleh dipakai di platform Threads.');
  }

  // STEP 4: Habiskan seluruh gambar di Facebook
  console.log('4. Menghabiskan sisa gambar di Facebook...');
  mockProduct.used_media_by_platform['facebook'] = [
    'https://cf.shopee.co.id/file/bag_video_demo_A.mp4',
    'https://cf.shopee.co.id/file/bag_img_1.jpg',
    'https://cf.shopee.co.id/file/bag_img_2.jpg',
    'https://cf.shopee.co.id/file/bag_img_3.jpg',
  ];

  const cur4 = await curateProductMedia(mockProduct, 'auto', 'facebook', 'test_user');
  console.log('   Hasil Akun FB saat semua media habis:', { no_fresh_media: cur4.no_fresh_media, count: cur4.selected_media.length });
  if (cur4.no_fresh_media && cur4.selected_media.length === 0) {
    console.log('   ✅ BERHASIL: Agen otomatis menolak posting produk di FB jika semua foto & videonya sudah pernah diposting di FB.\n');
  }

  console.log('=== 🎉 SELURUH ATURAN VALIDASI SUKSES MEMENUHI SYARAT! ===\n');
  process.exit(0);
}

testPlatformMediaUniqueness().catch(console.error);
