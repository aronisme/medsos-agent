/**
 * Injeksi Akun Pemilik, Akun Sosial Media, Config Agent, dan Sample Produk ke MongoDB Atlas
 */
require('dotenv').config({ path: './.env' });
const bcrypt = require('bcryptjs');
const { getDb } = require('./config/mongo');

async function seedInitialData() {
  console.log('=== 🚀 MENGINJEKSI DATA AWAL & KREDENSIAL KE MONGODB ATLAS ===\n');

  try {
    const db = await getDb();

    // 1. Injeksi User Owner
    const userEmail = 'sr7aron@gmail.com';
    const existingUser = await db.collection('users').findOne({ email: userEmail });
    
    let userId = existingUser ? String(existingUser._id) : 'user_owner_aron';
    const now = new Date().toISOString();

    const userData = {
      _id: userId,
      name: 'Aron',
      email: userEmail,
      password_hash: bcrypt.hashSync('koderahasiaaron7799', 10),
      created_at: existingUser?.created_at || now,
      updated_at: now
    };

    await db.collection('users').replaceOne({ _id: userId }, userData, { upsert: true });
    console.log(`1. ✅ User Owner terdaftar: ${userEmail} (ID: ${userId})`);

    // 2. Injeksi Akun Media Sosial (Threads & Facebook)
    const threadsToken = process.env.THREADS_TEST_TOKEN || '';
    const threadsAccount = {
      _id: 'acc_threads_default',
      user_id: userId,
      platform: 'threads',
      page_name: 'Threads Affiliate Store',
      page_id: 'threads_user_main',
      access_token: threadsToken,
      is_active: 1,
      created_at: now,
      updated_at: now
    };
    await db.collection('social_accounts').replaceOne({ _id: 'acc_threads_default' }, threadsAccount, { upsert: true });
    console.log('2. ✅ Akun Threads terhubung ke MongoDB Atlas [OK]');

    const fbAccount = {
      _id: 'acc_fb_default',
      user_id: userId,
      platform: 'facebook',
      page_name: 'Shopee Racun & Promo',
      page_id: 'fb_page_main',
      access_token: process.env.FB_APP_SECRET ? 'fb_managed_token' : '',
      is_active: 1,
      created_at: now,
      updated_at: now
    };
    await db.collection('social_accounts').replaceOne({ _id: 'acc_fb_default' }, fbAccount, { upsert: true });
    console.log('3. ✅ Akun Facebook Page terdaftar di MongoDB Atlas [OK]');

    // 3. Injeksi Agent Config
    const currentQ = `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`;
    const agentConfig = {
      _id: `cfg_${userId}`,
      user_id: userId,
      autopilot_enabled: true,
      min_queue_threshold: 4,
      batch_generation_size: 4,
      proven_ratio: 0.7,
      testing_ratio: 0.3,
      current_quarter: currentQ,
      created_at: now,
      updated_at: now
    };
    await db.collection('agent_config').replaceOne({ _id: `cfg_${userId}` }, agentConfig, { upsert: true });
    console.log('4. ✅ Konfigurasi Autopilot Agent diaktifkan [OK]');

    // 4. Injeksi Sample Produk Shopee Unggulan
    const sampleProducts = [
      {
        _id: 'prod_tws_f9_gaming',
        user_id: userId,
        title: 'TWS Gaming F9 Bluetooth 5.3 Low Latency Earphone Stereo LED Display',
        price: 49000,
        original_price: 150000,
        discount: '67% OFF',
        currency: 'Rp',
        rating: 4.9,
        sold_count: '10RB+ Terjual',
        shop_name: 'Official Audio Store',
        shop_location: 'Jakarta Barat',
        category: 'Elektronik & Gadget',
        product_url: 'https://shopee.co.id/product/123456/7891011',
        affiliate_url: 'https://shope.ee/tws-f9-gaming-promo',
        description: 'TWS F9 Gaming Headset Bluetooth 5.3 dengan layar LED display powerbank, suara bass nendang dan no delay.',
        images: ['https://down-id.img.susercontent.com/file/id-11134207-7r98r-lsv9s8i5n32t7b'],
        videos: [],
        media: [{ type: 'image', url: 'https://down-id.img.susercontent.com/file/id-11134207-7r98r-lsv9s8i5n32t7b' }],
        lifecycle_status: 'PROVEN',
        quarterly_summary: {
          current_quarter: currentQ,
          total_attempts: 12,
          total_views: 4500,
          total_clicks: 135,
          avg_ctr_percent: 3.0,
          avg_score: 8.5
        },
        created_at: now,
        updated_at: now
      },
      {
        _id: 'prod_stand_holder_hp',
        user_id: userId,
        title: 'Stand Holder HP Meja Lipat Foldable Aluminium Universal Handphone Tablet',
        price: 23500,
        original_price: 50000,
        discount: '53% OFF',
        currency: 'Rp',
        rating: 4.8,
        sold_count: '5RB+ Terjual',
        shop_name: 'Gadget Center Indo',
        shop_location: 'Jakarta Utara',
        category: 'Aksesoris Handphone',
        product_url: 'https://shopee.co.id/product/654321/1098765',
        affiliate_url: 'https://shope.ee/stand-holder-lipat-murah',
        description: 'Stand holder meja berbahan kokoh aluminium, bisa diputar dan dilipat mudah dibawa kemana saja.',
        images: ['https://down-id.img.susercontent.com/file/id-11134207-7r98o-lsv9s8i5n32t8c'],
        videos: [],
        media: [{ type: 'image', url: 'https://down-id.img.susercontent.com/file/id-11134207-7r98o-lsv9s8i5n32t8c' }],
        lifecycle_status: 'TESTING',
        quarterly_summary: {
          current_quarter: currentQ,
          total_attempts: 4,
          total_views: 1200,
          total_clicks: 28,
          avg_ctr_percent: 2.33,
          avg_score: 6.8
        },
        created_at: now,
        updated_at: now
      },
      {
        _id: 'prod_mini_sealer_plastik',
        user_id: userId,
        title: 'Mini Hand Sealer Perekat Plastik Makanan Portabel Mesin Segel Camilan',
        price: 15900,
        original_price: 35000,
        discount: '55% OFF',
        currency: 'Rp',
        rating: 4.7,
        sold_count: '8RB+ Terjual',
        shop_name: 'Perlengkapan Rumah Unik',
        shop_location: 'Surabaya',
        category: 'Peralatan Dapur',
        product_url: 'https://shopee.co.id/product/998877/5544332',
        affiliate_url: 'https://shope.ee/mini-sealer-plastik-murah',
        description: 'Alat press plastik praktis menjaga camilan tetap renyah dan tidak melempem.',
        images: ['https://down-id.img.susercontent.com/file/id-11134207-7r98p-lsv9s8i5n32t9d'],
        videos: [],
        media: [{ type: 'image', url: 'https://down-id.img.susercontent.com/file/id-11134207-7r98p-lsv9s8i5n32t9d' }],
        lifecycle_status: 'NEW',
        quarterly_summary: {
          current_quarter: currentQ,
          total_attempts: 0,
          total_views: 0,
          total_clicks: 0,
          avg_ctr_percent: 0,
          avg_score: 0
        },
        created_at: now,
        updated_at: now
      }
    ];

    for (const prod of sampleProducts) {
      await db.collection('affiliate_products').replaceOne({ _id: prod._id }, prod, { upsert: true });
    }
    console.log(`5. ✅ Berhasil memasukkan ${sampleProducts.length} produk Shopee ke MongoDB Atlas [OK]`);

    console.log('\n=== 🎉 INJEKSI KREDENSIAL & DATA KE MONGODB ATLAS SELESAI 100%! ===\n');

  } catch (err) {
    console.error('Error saat injeksi data:', err.message);
  }
}

if (require.main === module) {
  seedInitialData().then(() => process.exit(0));
}

module.exports = { seedInitialData };
