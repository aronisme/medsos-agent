const { db } = require('../config/firebase');
const { publishPostNow } = require('../services/postService');
const { runAutonomousCycle, getAgentConfig } = require('../services/agent/orchestratorService');
const { autoRefreshAllTokens } = require('../services/tokenRefreshService');
const { syncAllPostsAnalytics } = require('../services/postAnalytics/syncService');
const { evaluateExperiment } = require('../services/agent/experimentService');

/**
 * Memproses postingan terjadwal yang sudah waktunya.
 * Fungsi ini dipanggil otomatis setiap menit oleh Google Apps Script / Cron.
 */
async function processScheduledPosts() {
  const results = [];
  try {
    const now = Date.now();

    // 0. CHECK FOR DAILY PERFORMANCE REPORT (08:00 WIB)
    try {
      const jakartaTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
      const jakartaDate = new Date(jakartaTime);
      const currentHour = jakartaDate.getHours();
      
      if (currentHour >= 8) {
        // Find active users
        const accountsSnap = await db.collection('social_accounts')
          .where('is_active', 'in', [1, true, '1'])
          .get();

        const activeUserIds = new Set();
        accountsSnap.forEach(d => {
          const u = d.data().user_id;
          if (u) activeUserIds.add(u);
        });

        const { sendDailyPerformanceReport } = require('../services/telegramService');
        for (const uid of activeUserIds) {
          // sendDailyPerformanceReport internally throttles to once per day using locks
          await sendDailyPerformanceReport(uid).catch(err => {
            console.error(`[scheduler] Failed to send daily Telegram report for user ${uid}:`, err.message);
          });
        }
      }
    } catch (reportErr) {
      console.error('[scheduler] Daily Telegram performance report check error:', reportErr.message);
    }

    // 1. FAST-PATH (Dijalankan setiap menit): Publish postingan yang jatuh tempo
    // Menggunakan limit(10) untuk menghemat kuota Firestore reads
    const snapshot = await db.collection('posts')
      .where('status', '==', 'scheduled')
      .limit(10)
      .get();

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

    // 2. PERSISTENT SERVERLESS RATE-LIMITING LOCK
    // Pada serverless (Vercel), variabel in-memory akan ter-reset di setiap cold start (1 menit sekali).
    // Menggunakan dokumen Firestore 'scheduler_locks' agar throttling 15m / 30m / 12h benar-benar persisten!
    const lockRef = db.collection('system_state').doc('scheduler_locks');
    let lockData = {};
    try {
      const lockSnap = await lockRef.get();
      if (lockSnap.exists) {
        lockData = lockSnap.data() || {};
      }
    } catch (lockErr) {
      console.warn('[scheduler] Warning reading lock document:', lockErr.message);
    }

    const lastAnalyticsSync = Number(lockData.last_analytics_sync_epoch) || 0;
    const lastAutonomousCycle = Number(lockData.last_autonomous_cycle_epoch) || 0;
    const lastTokenRefresh = Number(lockData.last_token_refresh_epoch) || 0;

    const thirtyMinutes = 30 * 60 * 1000;
    const fifteenMinutes = 15 * 60 * 1000;
    const twelveHours = 12 * 60 * 60 * 1000;

    const updateLocks = {};

    // Check 1: Auto-Sync Analitik Meta & Link (Persisten setiap 30 menit)
    if (now - lastAnalyticsSync >= thirtyMinutes) {
      updateLocks.last_analytics_sync_epoch = now;
      setImmediate(async () => {
        try {
          const accountsSnap = await db.collection('social_accounts')
            .where('is_active', 'in', [1, true, '1'])
            .get();

          const activeUserIds = new Set();
          accountsSnap.forEach(d => {
            const u = d.data().user_id;
            if (u) activeUserIds.add(u);
          });

          for (const uid of activeUserIds) {
            console.log(`[scheduler] Menjalankan Auto-Sync Analitik Meta & Link untuk User: ${uid}`);
            await syncAllPostsAnalytics(uid, { limit: 15 });
          }

          // Evaluasi eksperimen A/B yang sedang berjalan
          const expSnap = await db.collection('experiments')
            .where('status', '==', 'running')
            .limit(10)
            .get();

          for (const expDoc of expSnap.docs) {
            await evaluateExperiment(expDoc.id);
          }
        } catch (syncErr) {
          console.error('[scheduler] Error running background analytics sync:', syncErr.message);
        }
      });
    }

    // Check 2: Autonomous Cycle (Persisten setiap 15 menit)
    if (now - lastAutonomousCycle >= fifteenMinutes) {
      updateLocks.last_autonomous_cycle_epoch = now;
      setImmediate(async () => {
        try {
          const accountsSnap = await db.collection('social_accounts')
            .where('is_active', 'in', [1, true, '1'])
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
    }

    // Check 3: Token Auto-Refresh (Persisten setiap 12 jam)
    if (now - lastTokenRefresh >= twelveHours) {
      updateLocks.last_token_refresh_epoch = now;
      setImmediate(async () => {
        try {
          console.log('[scheduler] Menjalankan rutin Auto-Refresh Token (FB, IG, Threads)...');
          await autoRefreshAllTokens();
        } catch (tokErr) {
          console.error('[scheduler] Error auto-refreshing social tokens:', tokErr.message);
        }
      });
    }

    // Check 4: Inbound Threads Auto-Reply Polling (Persisten setiap 10 menit)
    const lastInboundScan = Number(lockData.last_inbound_scan_epoch) || 0;
    const tenMinutes = 10 * 60 * 1000;
    if (now - lastInboundScan >= tenMinutes) {
      updateLocks.last_inbound_scan_epoch = now;
      setImmediate(async () => {
        try {
          const accountsSnap = await db.collection('social_accounts')
            .where('platform', '==', 'threads')
            .where('is_active', 'in', [1, true, '1'])
            .get();

          const activeUserIds = new Set();
          accountsSnap.forEach(d => {
            const u = d.data().user_id;
            if (u) activeUserIds.add(u);
          });

          const { scanAndProcessInboundReplies } = require('../services/threads/inbound/inboundService');
          for (const uid of activeUserIds) {
            await scanAndProcessInboundReplies(uid);
          }
        } catch (inboundErr) {
          console.error('[scheduler] Error running background inbound threads scan:', inboundErr.message);
        }
      });
    }

    // Simpan timestamp lock terbaru jika ada background task yang dipicu
    if (Object.keys(updateLocks).length > 0) {
      await lockRef.set(updateLocks, { merge: true });
    }

  } catch (e) {
    console.error('[scheduler] error:', e.message);
    throw e;
  }
  return results;
}

module.exports = { processScheduledPosts };

