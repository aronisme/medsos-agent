const { db } = require('../config/firebase');
const { publishPostNow } = require('../services/postService');
const { runAutonomousCycle, getAgentConfig } = require('../services/agent/orchestratorService');
const { autoRefreshAllTokens } = require('../services/tokenRefreshService');

// In-memory timestamp untuk rate-limiting AI cycle runner
let lastAutonomousCycleRun = 0;
let lastTokenRefreshRun = 0;

/**
 * Memproses postingan terjadwal yang sudah waktunya.
 * Fungsi ini dipanggil otomatis setiap menit oleh Google Apps Script / Cron.
 */
async function processScheduledPosts() {
  const results = [];
  try {
    // 1. FAST-PATH (Dijalankan setiap menit): Publish postingan yang jatuh tempo
    const snapshot = await db.collection('posts')
      .where('status', '==', 'scheduled')
      .get();
      
    const now = Date.now();

    if (!snapshot.empty) {
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (!data.scheduled_at) continue;

        let scheduledTime = new Date(data.scheduled_at).getTime();
        if (isNaN(scheduledTime)) {
          scheduledTime = new Date(String(data.scheduled_at).replace(' ', 'T')).getTime();
        }

        if (!isNaN(scheduledTime) && scheduledTime <= now) {
          try {
            await publishPostNow(doc.id);
            const msg = `[scheduler] ✅ Berhasil mempublish postingan terjadwal #${doc.id}`;
            console.log(msg);
            results.push({ postId: doc.id, success: true, message: msg });
          } catch (e) {
            const err = `[scheduler] ❌ Gagal publish postingan #${doc.id}: ${e.message}`;
            console.error(err);
            results.push({ postId: doc.id, success: false, error: err });
          }
        }
      }
    }

    // 2. SLOW-PATH dengan Smart Throttling (Cek setiap 15 menit):
    // Jika antrean postingan kosong atau kurang dari kuota, jalankan Autonomous Cycle
    const fifteenMinutes = 15 * 60 * 1000;
    if (now - lastAutonomousCycleRun >= fifteenMinutes) {
      lastAutonomousCycleRun = now;
      // Jalankan secara asynchronous di background agar response ke GAS tetap instan
      setImmediate(async () => {
        try {
          // Ambil user yang memiliki akun aktif
          const accountsSnap = await db.collection('social_accounts')
            .where('is_active', '==', 1)
            .get();

          const activeUserIds = new Set();
          accountsSnap.forEach(d => {
            const u = d.data().user_id;
            if (u) activeUserIds.add(u);
          });

          for (const uid of activeUserIds) {
            const cfg = await getAgentConfig(uid);
            if (cfg.autopilot_enabled) {
              console.log(`[scheduler] Menjalankan Autonomous Cycle untuk User: ${uid}`);
              await runAutonomousCycle(uid, { forceRun: false });
            }
          }
        } catch (autoErr) {
          console.error('[scheduler] Error running background autonomous cycle:', autoErr.message);
        }
      });
    // 3. TOKEN HEALTH & AUTO-REFRESH (Cek setiap 12 jam untuk FB, IG, dan Threads):
    const twelveHours = 12 * 60 * 60 * 1000;
    if (now - lastTokenRefreshRun >= twelveHours) {
      lastTokenRefreshRun = now;
      setImmediate(async () => {
        try {
          console.log('[scheduler] Menjalankan rutin Auto-Refresh Token (FB, IG, Threads)...');
          await autoRefreshAllTokens();
        } catch (tokErr) {
          console.error('[scheduler] Error auto-refreshing social tokens:', tokErr.message);
        }
      });
    }

  } catch (e) {
    console.error('[scheduler] error:', e.message);
    throw e;
  }
  return results;
}

module.exports = { processScheduledPosts };

