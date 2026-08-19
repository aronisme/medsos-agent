/**
 * Inisialisasi Database & Indexes MongoDB Atlas untuk Medsos Agent
 */
require('dotenv').config({ path: './.env' });
const { getDb } = require('./config/mongo');
const { ensureSeedTemplates } = require('./services/agent/templateService');

async function initMongoDB() {
  console.log('=== 🍃 MENGINISIALISASI MONGODB ATLAS UNTUK MEDSOS AGENT ===\n');

  try {
    const db = await getDb();
    console.log('1. ✅ Terhubung ke database MongoDB:', db.databaseName);

    // 2. Buat Indexes Penting untuk Performa Maksimal
    console.log('2. Membuat Index Collections...');
    
    // Posts
    await db.collection('posts').createIndex({ user_id: 1, status: 1 });
    await db.collection('posts').createIndex({ status: 1, scheduled_at: 1 });
    console.log('   - Index posts [OK]');

    // Social Accounts
    await db.collection('social_accounts').createIndex({ user_id: 1, is_active: 1 });
    await db.collection('social_accounts').createIndex({ user_id: 1, platform: 1, page_id: 1 });
    console.log('   - Index social_accounts [OK]');

    // Affiliate Products
    await db.collection('affiliate_products').createIndex({ user_id: 1, lifecycle_status: 1 });
    await db.collection('affiliate_products').createIndex({ product_url: 1 });
    console.log('   - Index affiliate_products [OK]');

    // Short Links
    await db.collection('short_links').createIndex({ user_id: 1, created_at: -1 });
    await db.collection('short_links').createIndex({ destination_url: 1 });
    console.log('   - Index short_links [OK]');

    // Link Clicks
    await db.collection('link_clicks').createIndex({ code: 1, timestamp: -1 });
    await db.collection('link_clicks').createIndex({ user_id: 1, timestamp: -1 });
    console.log('   - Index link_clicks [OK]');

    // Product Post Memory
    await db.collection('product_post_memory').createIndex({ product_id: 1, quarter: 1 });
    await db.collection('product_post_memory').createIndex({ post_id: 1 });
    await db.collection('product_post_memory').createIndex({ 'context_at_post.shortlink_code': 1 });
    console.log('   - Index product_post_memory [OK]');

    // Post Analytics
    await db.collection('post_analytics').createIndex({ user_id: 1, 'content.published_at': -1 });
    console.log('   - Index post_analytics [OK]');

    // Experiments
    await db.collection('experiments').createIndex({ user_id: 1, status: 1 });
    await db.collection('experiments').createIndex({ product_id: 1 });
    console.log('   - Index experiments [OK]');

    // Knowledge Insights
    await db.collection('knowledge_insights').createIndex({ user_id: 1, platform: 1 });
    console.log('   - Index knowledge_insights [OK]');

    // 3. Pastikan Seed Templates Copywriting Terdaftar
    console.log('3. Mendaftarkan Seed Templates Copywriting...');
    await ensureSeedTemplates();
    console.log('   - Seed templates [OK]');

    console.log('\n=== 🎉 INISIALISASI MONGODB ATLAS SELESAI & SIAP DIGUNAKAN! ===\n');

  } catch (err) {
    console.error('Error saat inisialisasi MongoDB:', err.message);
  }
}

if (require.main === module) {
  initMongoDB().then(() => process.exit(0));
}

module.exports = { initMongoDB };
