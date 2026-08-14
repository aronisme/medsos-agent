const { db } = require('./config/firebase');

async function run() {
  const snapshot = await db.collection('posts').where('status', '==', 'failed').get();
  snapshot.docs.forEach(doc => {
    console.log(`\n\n--- POST ID: ${doc.id} ---`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
  process.exit(0);
}

run();
