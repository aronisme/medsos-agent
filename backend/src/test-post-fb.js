const { db } = require('./config/firebase');
const { publishPostNow } = require('./services/postService');

async function run() {
  try {
    console.log("Creating test post for Facebook...");
    
    const accountsSnap = await db.collection('social_accounts').where('platform', '==', 'facebook').get();
    if (accountsSnap.empty) {
      console.log("No active facebook accounts found!");
      process.exit(1);
    }
    
    // Pick the first FB account
    const accountDoc = accountsSnap.docs[0];
    const account = accountDoc.data();
    console.log(`Found Facebook Account: ${account.page_name} (${account.page_id})`);

    const newPostRef = db.collection('posts').doc();
    const postId = newPostRef.id;

    const postData = {
      user_id: account.user_id,
      title: 'Automated FB Permissions Test',
      content: 'Hello Facebook! This is an automated test post to verify that the new permissions (pages_manage_posts) are working correctly. 🚀 #test',
      scheduled_at: null,
      post_type: 'feed',
      media: [], // Text only post to make it quick
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'draft',
      targets: [
        {
          id: Math.random().toString(36).substring(7),
          account_id: accountDoc.id,
          platform: 'facebook',
          page_name: account.page_name,
          status: 'pending'
        }
      ]
    };

    await newPostRef.set(postData);
    console.log(`Created test post doc: ${postId}`);

    console.log("Publishing now...");
    await publishPostNow(postId);

    console.log("Publishing finished. Checking final status...");
    const finalDoc = await newPostRef.get();
    console.log(JSON.stringify(finalDoc.data(), null, 2));

  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

run();
