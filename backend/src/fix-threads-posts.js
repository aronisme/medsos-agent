require('dotenv').config({ path: './.env' });
const { db } = require('./config/firebase');

async function fixThreadsPosts() {
  const postsSnap = await db.collection('posts').get();
  for (const doc of postsSnap.docs) {
    const d = doc.data();
    const isThreads = (d.targets || []).some(t => t.platform === 'threads');
    if (isThreads && d.content && d.content.length > 500) {
      console.log('Fixing post:', doc.id, 'original length:', d.content.length);
      const shortlinkMatch = d.content.match(/(https?:\/\/[^\s]+)/);
      const shortlink = shortlinkMatch ? shortlinkMatch[0] : 'https://shopee-link-aff.vercel.app';

      const compactContent = `Jujur awalnya ragu, pas dicoba ternyata sebagus itu! 😍

Sepatu Sneakers Wanita DNY Casual Shoes:
• Desain feminim & ringan, nyaman buat outfit harian
• Harga promo spesial Rp 139.800

Spill link tokonya di sini ya:
${shortlink}

#SneakersWanita #RacunShopee #ShopeeAffiliate`;

      const resetTargets = (d.targets || []).map(t => ({
        ...t,
        status: 'pending',
        error_message: null
      }));

      await db.collection('posts').doc(doc.id).update({
        content: compactContent,
        status: 'scheduled',
        targets: resetTargets,
        updated_at: new Date().toISOString()
      });
      console.log('Post', doc.id, 'successfully updated! New length:', compactContent.length);
    }
  }
}

fixThreadsPosts().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
