const axios = require('axios');
const { db } = require('./config/firebase');

async function run() {
  try {
    const fbSnap = await db.collection('social_accounts').where('platform', '==', 'facebook').get();
    if (fbSnap.empty) {
      console.log('No FB accounts found');
      process.exit(1);
    }
    const fbAccount = fbSnap.docs[0].data();
    const pageId = fbAccount.page_id;
    const token = fbAccount.access_token;
    
    console.log(`Checking Facebook Page ${pageId} for linked Instagram account...`);
    const url = `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${token}`;
    
    const { data } = await axios.get(url);
    console.log("Graph API Response:", JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error("Error from Graph API:");
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  } finally {
    process.exit(0);
  }
}

run();
