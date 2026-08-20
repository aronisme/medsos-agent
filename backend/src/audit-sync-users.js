const { getDb } = require('./config/mongo');

async function auditAndFix() {
  const db = await getDb();
  const realUid = 'uJhx9rqu8QXrhBELW56nclJNRyk2';

  console.log('=== 🔍 AUDIT DATA MONGODB ATLAS ===\n');

  // 1. Cek User
  const users = await db.collection('users').find({}).toArray();
  console.log(`Ditemukan ${users.length} user di collection 'users':`);
  users.forEach(u => {
    if (u.email === 'sr7aron@gmail.com' || u._id === realUid || u._id === 'user_owner_aron') {
      console.log(` - ID: ${u._id}, Email: ${u.email}, Name: ${u.name || u.displayName}`);
    }
  });

  // Hapus duplicate user_owner_aron jika ada, pastikan realUid yang aktif
  const deleteResult = await db.collection('users').deleteOne({ _id: 'user_owner_aron' });
  if (deleteResult.deletedCount > 0) {
    console.log(`\n🧹 Dihapus dummy user 'user_owner_aron' agar login sr7aron@gmail.com langsung mengarah ke ${realUid}`);
  }

  // Update real user password hash dan email agar terjamin valid
  const realUser = await db.collection('users').findOne({ _id: realUid });
  if (realUser) {
    console.log(`✅ User utama aktif: ${realUser.email} (UID: ${realUid})`);
  }

  // Collections to harmonize
  const collections = [
    'affiliate_products',
    'posts',
    'social_accounts',
    'short_links',
    'product_post_memory',
    'post_analytics',
    'post_analytics_snapshots',
    'experiments',
    'knowledge_insights',
    'agent_config'
  ];

  console.log('\n=== 🔄 HARMONISASI USER_ID KE REAL UID ===\n');
  for (const col of collections) {
    const updated = await db.collection(col).updateMany(
      { user_id: { $in: ['user_owner_aron', 'test_user_aron'] } },
      { $set: { user_id: realUid } }
    );
    const totalDocs = await db.collection(col).countDocuments({ user_id: realUid });
    console.log(`- [${col}]: ${updated.modifiedCount} dokumen diperbarui -> Total aktif UID ${realUid}: ${totalDocs}`);
  }

  // Hapus placeholder duplicate social_accounts jika ada
  await db.collection('social_accounts').deleteMany({
    _id: { $in: ['acc_threads_default', 'acc_fb_default'] }
  });

  console.log('\n=== 🎉 AUDIT DAN HARMONISASI SELESAI! ===\n');
  process.exit(0);
}

auditAndFix().catch(console.error);
