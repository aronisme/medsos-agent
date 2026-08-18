const { db } = require('../../config/firebase');

/**
 * Menghasilkan deterministic time-bucket string (interval 30 menit).
 * Format: YYYYMMDD_HH00 atau YYYYMMDD_HH30
 */
function getTimeBucket(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minBucket = date.getMinutes() < 30 ? '00' : '30';
  return `${year}${month}${day}_${hour}${minBucket}`;
}

/**
 * Menyimpan snapshot metrik post ke Firestore dengan deduplikasi berbasis bucket.
 * @param {Object} post Objek post ternormalisasi
 * @param {string} userId ID pengguna pemilik
 * @returns {Promise<string>} Snapshot doc ID
 */
async function captureSnapshot(post, userId) {
  if (!post?.id || !post?.metrics) return null;

  const now = new Date();
  const timeBucket = getTimeBucket(now);
  const snapshotId = `${post.id}_${timeBucket}`;

  const snapshotDoc = {
    post_id: post.id,
    platform: post.identity?.platform || 'unknown',
    user_id: userId,
    captured_at: now.toISOString(),
    time_bucket: timeBucket,
    metrics: { ...post.metrics },
    video_metrics: { ...post.video_metrics },
    affiliate_clicks: post.affiliate?.human_clicks || post.affiliate?.total_clicks || 0,
  };

  // Set with deterministic ID so multiple syncs in the same 30-min window overwrite/update rather than duplicate
  await db.collection('post_analytics_snapshots').doc(snapshotId).set(snapshotDoc, { merge: true });

  return snapshotId;
}

/**
 * Mengambil riwayat time-series snapshot untuk postingan tertentu beserta perhitungan delta/velocity.
 * @param {string} postId ID postingan ternormalisasi
 * @param {number} limit Maksimal snapshot yang diambil
 * @returns {Promise<Array>} List of snapshots with velocity metadata
 */
async function getPostHistory(postId, limit = 50) {
  if (!postId) return [];

  const snap = await db.collection('post_analytics_snapshots')
    .where('post_id', '==', postId)
    .get();

  if (snap.empty) return [];

  const snapshots = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Sort chronologically ascending
  snapshots.sort((a, b) => new Date(a.captured_at || 0) - new Date(b.captured_at || 0));

  // Compute velocity / deltas between consecutive snapshots
  const enriched = snapshots.slice(-limit).map((current, idx, arr) => {
    if (idx === 0) {
      return {
        ...current,
        delta: { views: 0, likes: 0, comments: 0, shares: 0, clicks: 0, hours_elapsed: 0 },
      };
    }

    const prev = arr[idx - 1];
    const prevTime = new Date(prev.captured_at || 0).getTime();
    const currTime = new Date(current.captured_at || 0).getTime();
    const hoursElapsed = Math.max((currTime - prevTime) / (1000 * 60 * 60), 0.1);

    const deltaViews = Math.max((current.metrics?.views || 0) - (prev.metrics?.views || 0), 0);
    const deltaLikes = (current.metrics?.likes || 0) - (prev.metrics?.likes || 0);
    const deltaComments = (current.metrics?.comments || 0) - (prev.metrics?.comments || 0);
    const deltaShares = (current.metrics?.shares || 0) - (prev.metrics?.shares || 0);
    const deltaClicks = (current.affiliate_clicks || 0) - (prev.affiliate_clicks || 0);

    return {
      ...current,
      delta: {
        views: deltaViews,
        likes: deltaLikes,
        comments: deltaComments,
        shares: deltaShares,
        clicks: deltaClicks,
        hours_elapsed: Number(hoursElapsed.toFixed(2)),
        views_velocity_per_hour: Number((deltaViews / hoursElapsed).toFixed(1)),
      },
    };
  });

  return enriched;
}

module.exports = {
  getTimeBucket,
  captureSnapshot,
  getPostHistory,
};
