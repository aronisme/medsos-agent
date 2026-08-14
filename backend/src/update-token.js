const { db } = require('./config/firebase');

async function run() {
  const newToken = "EAAliUg7XxeMBSHoU4uzESNqqiYE09j832PLTb1DJJyCjELEdyR8zk1j8fX1aPnaXzhjX6GbDAsKRtF3mcA457ZBtT5gReM6FtpZAk6HeNiymRRpWikDzBY9ZC4bEZBN1aKATSTcM5KTXR0ZABzfilU8D8huJ26SJ6ES0nEXT39mloSoA1NnpZBA8RwGuTcdSXXZBvdL3Wve";

  try {
    const snapshot = await db.collection('social_accounts').get();
    
    if (snapshot.empty) {
      console.log('No accounts found in db');
      process.exit(1);
    }

    let updatedCount = 0;
    for (const doc of snapshot.docs) {
      const data = doc.data();
      // We update the token for Airish Aisya (FB) and Nazilla (IG) which were using the Airish Aisya token
      if (data.page_name === 'Airish Aisya' || data.page_name === 'Nazilla' || data.platform === 'facebook' || data.platform === 'instagram') {
        await doc.ref.update({ access_token: newToken });
        console.log(`Updated access_token for: ${data.page_name} (${data.platform})`);
        updatedCount++;
      }
    }
    
    console.log(`Successfully updated ${updatedCount} accounts with the new token.`);
  } catch (err) {
    console.error('Error updating db:', err);
  } finally {
    process.exit(0);
  }
}

run();
