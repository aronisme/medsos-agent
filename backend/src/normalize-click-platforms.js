const { getDb } = require('./config/mongo');

async function normalizeClickPlatforms() {
  console.log('=== 🍃 NORMALISASI PLATFORM DATA PADA LINK CLICKS & SHORT LINKS ===');
  const db = await getDb();

  // Normalize link_clicks platform
  const updateThreadsClicks = await db.collection('link_clicks').updateMany(
    { platform: { $in: ['threads', 'l.threads.com', 'l.threads.net'] } },
    { $set: { platform: 'Threads' } }
  );
  console.log('Normalized Threads clicks:', updateThreadsClicks.modifiedCount);

  const updateFbClicks = await db.collection('link_clicks').updateMany(
    { platform: { $in: ['facebook', 'fb', 'l.facebook.com', 'm.facebook.com'] } },
    { $set: { platform: 'Facebook' } }
  );
  console.log('Normalized Facebook clicks:', updateFbClicks.modifiedCount);

  const updateIgClicks = await db.collection('link_clicks').updateMany(
    { platform: { $in: ['instagram', 'ig', 'l.instagram.com'] } },
    { $set: { platform: 'Instagram' } }
  );
  console.log('Normalized Instagram clicks:', updateIgClicks.modifiedCount);

  // Link matching: For any clicks that are 'Direct / Link' but whose short_links document has a platform, backfill platform
  const shortLinks = await db.collection('short_links').find({}).toArray();
  const linkPlatformMap = new Map();
  shortLinks.forEach(l => {
    if (l._id && l.platform) {
      const p = l.platform.toLowerCase();
      const norm = p === 'threads' ? 'Threads' : p === 'facebook' ? 'Facebook' : p === 'instagram' ? 'Instagram' : l.platform;
      linkPlatformMap.set(l._id, norm);
    }
  });

  const directClicks = await db.collection('link_clicks').find({ platform: 'Direct / Link' }).toArray();
  let backfilledCount = 0;
  for (const c of directClicks) {
    if (c.code && linkPlatformMap.has(c.code)) {
      const targetPlat = linkPlatformMap.get(c.code);
      await db.collection('link_clicks').updateOne(
        { _id: c._id },
        { $set: { platform: targetPlat } }
      );
      backfilledCount++;
    }
  }
  console.log('Backfilled Direct clicks from bound shortlink platform:', backfilledCount);

  const distinctPlatforms = await db.collection('link_clicks').distinct('platform');
  console.log('Final distinct platforms in link_clicks:', distinctPlatforms);

  process.exit(0);
}

normalizeClickPlatforms().catch(err => {
  console.error(err);
  process.exit(1);
});
