const { db } = require('./backend/src/config/firebase');

async function run() {
  const doc = await db.collection('posts').doc('rblyqGSTwOCBscxSMDc2').get();
  console.log(JSON.stringify(doc.data(), null, 2));
  process.exit(0);
}

run();
