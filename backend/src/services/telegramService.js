const axios = require('axios');
const { db } = require('../config/firebase');

/**
 * Mengirimkan laporan HTML ke bot Telegram milik user
 * @param {string} userId - ID Pengguna
 * @param {string} message - Isi pesan dalam format HTML
 * @param {string} [customChatId] - Chat ID kustom untuk membalas pesan (opsional)
 */
async function sendTelegramReport(userId, message, customChatId = null) {
  try {
    // 1. Ambil akun Telegram aktif milik user ini
    const tgAccountsSnap = await db.collection('social_accounts')
      .where('user_id', '==', userId)
      .where('platform', '==', 'telegram')
      .where('is_active', 'in', [1, true, '1'])
      .get();

    if (tgAccountsSnap.empty) {
      return; // Tidak ada bot Telegram yang terhubung
    }

    for (const doc of tgAccountsSnap.docs) {
      const acc = doc.data();
      const botToken = acc.access_token;
      const defaultChatId = acc.page_id;
      const targetChatId = customChatId || defaultChatId;

      if (!botToken || !targetChatId) {
        console.warn(`[Telegram Service] Token atau Chat ID kosong untuk dokumen: ${doc.id}`);
        continue;
      }

      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await axios.post(url, {
        chat_id: targetChatId,
        text: message,
        parse_mode: 'HTML'
      });
      console.log(`[Telegram Service] Berhasil mengirim laporan ke Telegram Chat: ${targetChatId}`);
    }
  } catch (err) {
    console.error('[Telegram Service] Gagal mengirim pesan ke Telegram:', err.response?.data || err.message);
  }
}

/**
 * Membuat teks laporan kinerja 24 jam terakhir untuk pengguna
 * @param {string} userId - ID Pengguna
 * @returns {Promise<string>} Teks laporan HTML siap kirim
 */
async function generatePerformanceReportText(userId) {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneDayAgoIso = oneDayAgo.toISOString();

    // 1. Ambil klik link 24 jam terakhir
    // [A6] Filter langsung di query level — menghindari full-scan seluruh link_clicks
    // Field 'timestamp' disimpan sebagai ISO string di redirect.js line 401
    const clicksSnap = await db.collection('link_clicks')
      .where('user_id', '==', userId)
      .where('timestamp', '>=', oneDayAgoIso)
      .get();

    const recentClicks = clicksSnap.docs.map(d => d.data());

    const totalClicks = recentClicks.length;
    const botClicks = recentClicks.filter(c => c.counted_as_human === false || c.is_bot).length;
    const humanClicks = totalClicks - botClicks;

    // 2. Hitung statistik platform & produk terpopuler
    const platformBreakdown = {};
    const productClicks = {};

    recentClicks.forEach(c => {
      // Platform
      // actual_source = new schema, platform = backward-compat fallback for old docs
      const plat = c.actual_source || c.platform || 'Direct / Link';
      platformBreakdown[plat] = (platformBreakdown[plat] || 0) + 1;

      // Produk
      const pId = c.product_id || c.link_code || 'Unknown';
      productClicks[pId] = (productClicks[pId] || 0) + 1;
    });

    // Cari top platform
    let topPlatform = 'Belum ada trafik';
    let maxPlatClicks = 0;
    Object.entries(platformBreakdown).forEach(([plat, count]) => {
      if (count > maxPlatClicks) {
        maxPlatClicks = count;
        topPlatform = `${plat} (${count} klik)`;
      }
    });

    // Cari top produk
    let topProductId = null;
    let maxProdClicks = 0;
    Object.entries(productClicks).forEach(([pId, count]) => {
      if (count > maxProdClicks) {
        maxProdClicks = count;
        topProductId = pId;
      }
    });

    let topProductTitle = 'Belum ada klik';
    if (topProductId) {
      try {
        const prodDoc = await db.collection('affiliate_products').doc(topProductId).get();
        if (prodDoc.exists) {
          topProductTitle = `${prodDoc.data().title?.slice(0, 35)}... (${maxProdClicks} klik)`;
        } else {
          // Coba cari di short_links jika itu custom shortlink
          const linkDoc = await db.collection('short_links').doc(topProductId).get();
          if (linkDoc.exists) {
            topProductTitle = `${linkDoc.data().title?.slice(0, 35)}... (${maxProdClicks} klik)`;
          } else {
            topProductTitle = `Kode Link: /s/${topProductId} (${maxProdClicks} klik)`;
          }
        }
      } catch (_) {
        topProductTitle = `Kode Link: /s/${topProductId} (${maxProdClicks} klik)`;
      }
    }

    // 3. Hitung postingan yang dipublish 24 jam terakhir
    // [A7] Filter status di query level + limit untuk menghindari full-scan
    const postsSnap = await db.collection('posts')
      .where('user_id', '==', userId)
      .where('status', '==', 'posted')
      .limit(100)
      .get();
      
    const recentPosts = postsSnap.docs
      .map(d => d.data())
      .filter(p => (p.posted_at || p.updated_at || '') >= oneDayAgoIso);

    const activeAccountsSnap = await db.collection('social_accounts')
      .where('user_id', '==', userId)
      .where('is_active', 'in', [1, true, '1'])
      .get();

    const activeAccountsCount = activeAccountsSnap.size;

    // 4. Rangkai teks laporan HTML
    let msg = `<b>📊 LAPORAN KINERJA HARIAN (WIB)</b>\n`;
    msg += `<i>Periode: 24 Jam Terakhir</i>\n\n`;
    
    msg += `<b>📈 Statistik Klik Link:</b>\n`;
    msg += `• Total Klik: <b>${totalClicks}</b>\n`;
    msg += `• Pengunjung Asli (Manusia): <b>${humanClicks}</b>\n`;
    msg += `• Deteksi Bot / Crawler: <b>${botClicks}</b>\n\n`;

    msg += `<b>🎯 Traffic & Produk Terpopuler:</b>\n`;
    msg += `• Top Sumber Trafik: <code>${topPlatform}</code>\n`;
    msg += `• Produk #1 Terpopuler: <code>${topProductTitle}</code>\n\n`;

    msg += `<b>⚙️ Status postingan & Sistem:</b>\n`;
    msg += `• Postingan Sukses (24j): <b>${recentPosts.length} konten</b>\n`;
    msg += `• Akun Sosmed Terhubung: <b>${activeAccountsCount} akun</b>\n\n`;

    msg += `👉 <i>Gunakan perintah <code>/report</code> kapan saja untuk memperbarui laporan kinerja Anda.</i>`;

    return msg;
  } catch (err) {
    console.error('[Telegram Service] Gagal merangkai teks laporan:', err.message);
    return `❌ <b>Gagal menyusun laporan kinerja:</b> ${err.message}`;
  }
}

/**
 * Pengecekan otomatis untuk mengirimkan Laporan Kinerja Harian
 * @param {string} userId - ID Pengguna
 */
async function sendDailyPerformanceReport(userId) {
  try {
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const docRef = db.collection('system_state').doc(`telegram_report_${userId}`);
    const doc = await docRef.get();

    if (doc.exists && doc.data().last_sent_date === todayStr) {
      return; // Laporan hari ini sudah dikirim
    }

    console.log(`[Telegram Service] Mengirimkan Laporan Kinerja Harian otomatis untuk user: ${userId}`);
    const reportText = await generatePerformanceReportText(userId);
    await sendTelegramReport(userId, reportText);

    // Tandai tanggal terakhir dikirim
    await docRef.set({ last_sent_date: todayStr }, { merge: true });
  } catch (err) {
    console.error('[Telegram Service] Gagal mengirim Laporan Kinerja Harian:', err.message);
  }
}

module.exports = {
  sendTelegramReport,
  generatePerformanceReportText,
  sendDailyPerformanceReport
};
