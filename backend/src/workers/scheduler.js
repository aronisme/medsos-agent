const db = require('../db');
const { publishTarget } = require('../services/postService');

/**
 * Scheduler in-process: scan postingan terjadwal yang sudah waktunya,
 * lalu publish semua target pending-nya.
 * Ganti dengan Bull + Redis saat produksi (lih. implementation plan).
 */
function startScheduler(intervalMs = 30000) {
  const timer = setInterval(async () => {
    try {
      const due = db
        .prepare(
          `SELECT pt.id AS target_id, p.id AS post_id
           FROM post_targets pt
           JOIN posts p ON p.id = pt.post_id
           WHERE p.status = 'scheduled'
             AND p.scheduled_at IS NOT NULL
             AND p.scheduled_at <= datetime('now')
             AND pt.status IN ('pending','failed')
           ORDER BY p.scheduled_at ASC
           LIMIT 20`
        )
        .all();

      for (const row of due) {
        try {
          await publishTarget(row.target_id);
          console.log(`[scheduler] ✅ Post #${row.post_id} → target #${row.target_id}`);
        } catch (e) {
          console.error(`[scheduler] ❌ Post #${row.post_id} → target #${row.target_id}: ${e.message}`);
        }
      }
    } catch (e) {
      console.error('[scheduler] error:', e.message);
    }
  }, intervalMs);

  console.log(`[scheduler] Aktif — cek jadwal setiap ${intervalMs / 1000} detik.`);
  return timer;
}

module.exports = { startScheduler };
