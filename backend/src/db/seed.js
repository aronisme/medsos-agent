require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./index');

function clear() {
  db.exec(`
    DELETE FROM logs;
    DELETE FROM post_targets;
    DELETE FROM post_media;
    DELETE FROM posts;
    DELETE FROM templates;
    DELETE FROM social_accounts;
    DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);
}

function seed() {
  clear();

  const passwordHash = bcrypt.hashSync('demo1234', 10);

  const user = db.prepare(
    `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`
  ).run('Demo User', 'demo@demo.com', passwordHash);
  const userId = user.lastInsertRowid;

  // Demo akun (dry-run) — ganti dengan token asli saat mode produksi
  const fbAccount = db.prepare(
    `INSERT INTO social_accounts (user_id, platform, page_id, access_token, page_name, expires_at, is_active)
     VALUES (?, 'facebook', 'demo_page_123', NULL, 'Demo Coffee Shop', NULL, 1)`
  ).run(userId);

  const igAccount = db.prepare(
    `INSERT INTO social_accounts (user_id, platform, page_id, access_token, page_name, expires_at, is_active)
     VALUES (?, 'instagram', 'demo_ig_456', NULL, '@democoffeeshop', NULL, 1)`
  ).run(userId);

  // Contoh postingan dengan status berbeda
  const mkPost = db.prepare(
    `INSERT INTO posts (user_id, title, content, status, scheduled_at, posted_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))`
  );

  const p1 = mkPost.run(userId, 'Promo Akhir Pekan', 'Promo akhir pekan! ☕ Semua menu minuman diskon 25%. Cobain sekarang!', 'posted', null, "datetime('now', '-1 day')", '-1 day');
  const p2 = mkPost.run(userId, 'Produk Baru', 'Perkenalkan menu baru kami: Caramel Cloud Latte 🌥️ Manisnya pas, creamy banget!', 'posted', null, "datetime('now', '-3 days')", '-3 days');
  const p3 = mkPost.run(userId, 'Jadwal: Tips Meracik Kopi', 'Tips meracik kopi di rumah! ☕ 3 langkah mudah untuk hasil ala cafe.', 'scheduled', "datetime('now', '+1 day')", null, '0 minute');
  const p4 = mkPost.run(userId, 'Draft: Behind The Scene', 'Behind the scene proses roasting biji kopi pilihan kami. Stay tuned!', 'draft', null, null, '0 minute');

  db.prepare(
    `INSERT INTO post_targets (post_id, account_id, platform, post_id_on_platform, status, processed_at)
     VALUES (?, ?, 'facebook', 'fb_post_1001', 'success', datetime('now'))`
  ).run(p1.lastInsertRowid, fbAccount.lastInsertRowid);

  db.prepare(
    `INSERT INTO post_targets (post_id, account_id, platform, post_id_on_platform, status, processed_at)
     VALUES (?, ?, 'instagram', 'ig_post_2002', 'success', datetime('now'))`
  ).run(p2.lastInsertRowid, igAccount.lastInsertRowid);

  const t1 = db.prepare(
    `INSERT INTO post_targets (post_id, account_id, platform, status) VALUES (?, ?, 'facebook', 'pending')`
  ).run(p3.lastInsertRowid, fbAccount.lastInsertRowid);
  db.prepare(
    `INSERT INTO post_targets (post_id, account_id, platform, status) VALUES (?, ?, 'instagram', 'pending')`
  ).run(p3.lastInsertRowid, igAccount.lastInsertRowid);

  // Template
  db.prepare(
    `INSERT INTO templates (user_id, name, content) VALUES (?, 'Promo Diskon', '⚡ FLASH SALE! Diskon {persen}% untuk semua item di toko kami. Periode {tanggal}. Jangan sampai kehabisan!')`
  ).run(userId);
  db.prepare(
    `INSERT INTO templates (user_id, name, content) VALUES (?, 'Announcement', 'Halo semuanya! 👋 Kami punya kabar baik...')`
  ).run(userId);

  console.log(`✅ Seed selesai:
  - User: demo@demo.com / demo1234
  - ${fbAccount.changes + igAccount.changes} akun sosial (demo)
  - 4 postingan contoh (1 posted FB, 1 posted IG, 1 scheduled, 1 draft)
  - 2 template konten`);
}

seed();
