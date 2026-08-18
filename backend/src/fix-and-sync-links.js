/**
 * Script untuk membersihkan data URL produk di affiliate_products,
 * menyinkronkan short_links, dan memperbaiki domain lama pada posts.
 */
require('dotenv').config({ path: './.env' });
const { db } = require('./config/firebase');
const { cleanShopeeProductUrl, buildAffiliateLink } = require('./routes/affiliate');

async function syncAndFixAll() {
  console.log('=== 🚀 MEMULAI PROSES SINKRONISASI & PERBAIKAN LINK ===\n');

  const targetDomain = 'shopee-link-aff.vercel.app';
  const oldDomain = 'medsos-agent.vercel.app';
  const affiliateId = process.env.SHOPEE_AFFILIATE_ID || '11328861338';

  // 1. Bersihkan product_url di koleksi affiliate_products
  console.log('1. Memeriksa dan membersihkan katalog affiliate_products...');
  const prodSnap = await db.collection('affiliate_products').get();
  let cleanedProdCount = 0;

  for (const doc of prodSnap.docs) {
    const data = doc.data();
    let dirtyUrl = data.product_url || '';
    let dirtyAffUrl = data.affiliate_url || '';
    let needsUpdate = false;
    const updatePayload = {};

    if (dirtyUrl) {
      const clean = cleanShopeeProductUrl(dirtyUrl);
      if (clean && clean !== dirtyUrl) {
        updatePayload.product_url = clean;
        needsUpdate = true;
      }
    }

    if (dirtyAffUrl && dirtyAffUrl.includes(oldDomain)) {
      updatePayload.affiliate_url = dirtyAffUrl.replace(new RegExp(oldDomain, 'g'), targetDomain);
      needsUpdate = true;
    }

    if (needsUpdate) {
      updatePayload.updated_at = new Date().toISOString();
      await db.collection('affiliate_products').doc(doc.id).update(updatePayload);
      cleanedProdCount++;
      console.log(`   ✅ Produk #${doc.id} "${(data.title || '').slice(0, 30)}..." diperbarui.`);
    }
  }
  console.log(`   -> Total ${cleanedProdCount} produk dibersihkan URL-nya.\n`);

  // 2. Perbaiki dokumen di koleksi short_links
  console.log('2. Memeriksa dokumen di koleksi short_links...');
  const linkSnap = await db.collection('short_links').get();
  let cleanedLinkCount = 0;

  for (const doc of linkSnap.docs) {
    const data = doc.data();
    let dest = data.destination_url || '';
    let prod = data.product_url || '';
    let needsUpdate = false;
    const updatePayload = {};

    if (dest.includes(oldDomain)) {
      dest = dest.replace(new RegExp(oldDomain, 'g'), targetDomain);
      updatePayload.destination_url = dest;
      needsUpdate = true;
    }

    if (prod) {
      const cleanProd = cleanShopeeProductUrl(prod);
      if (cleanProd && cleanProd !== prod) {
        updatePayload.product_url = cleanProd;
        needsUpdate = true;
      }
    }

    // Jika destination_url adalah an_redir dengan origin_link yang kotor (misal ada #/ atau extraParams)
    if (dest.includes('an_redir') && dest.includes('origin_link=')) {
      try {
        const destParsed = new URL(dest);
        const origin = destParsed.searchParams.get('origin_link');
        if (origin) {
          const cleanOrigin = cleanShopeeProductUrl(decodeURIComponent(origin));
          const currentTracking = data.tracking || null;
          const rebuiltDest = buildAffiliateLink(cleanOrigin, currentTracking, affiliateId);
          if (rebuiltDest !== dest) {
            updatePayload.destination_url = rebuiltDest;
            needsUpdate = true;
          }
        }
      } catch {}
    }

    if (needsUpdate) {
      updatePayload.updated_at = new Date().toISOString();
      await db.collection('short_links').doc(doc.id).update(updatePayload);
      cleanedLinkCount++;
      console.log(`   ✅ Shortlink #${doc.id} diperbarui destination_url.`);
    }
  }
  console.log(`   -> Total ${cleanedLinkCount} shortlink diperbarui.\n`);

  // 3. Perbaiki postingan di koleksi posts yang masih memuat domain lama
  console.log('3. Memeriksa postingan di koleksi posts...');
  const postsSnap = await db.collection('posts').get();
  let cleanedPostCount = 0;

  for (const doc of postsSnap.docs) {
    const data = doc.data();
    let content = data.content || '';
    let needsUpdate = false;
    const updatePayload = {};

    if (content.includes(oldDomain)) {
      content = content.replace(new RegExp(oldDomain, 'g'), targetDomain);
      updatePayload.content = content;
      needsUpdate = true;
    }

    if (needsUpdate) {
      updatePayload.updated_at = new Date().toISOString();
      await db.collection('posts').doc(doc.id).update(updatePayload);
      cleanedPostCount++;
      console.log(`   ✅ Post #${doc.id} [${data.status}] link diganti ke ${targetDomain}`);
    }
  }
  console.log(`   -> Total ${cleanedPostCount} postingan diperbarui.\n`);

  console.log('=== 🎉 SINKRONISASI SELESAI DENGAN SUKSES ===');
}

syncAndFixAll().then(() => process.exit(0)).catch(err => {
  console.error('[Fatal Error]:', err);
  process.exit(1);
});
