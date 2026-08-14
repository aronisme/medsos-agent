const { db } = require('./config/firebase');

async function run() {
  const accountsSnap = await db.collection('social_accounts').where('platform', '==', 'instagram').get();
  if (accountsSnap.empty) {
    console.log('No IG accounts found');
    process.exit(1);
  }
  
  const doc = accountsSnap.docs[0];
  await doc.ref.update({ page_id: '17841434113482134' });
  console.log(`Updated IG Account ${doc.id} page_id to 17841434113482134`);
  process.exit(0);
}

run();
