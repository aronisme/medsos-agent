const express = require('express');
const axios = require('axios');
const { db } = require('../config/firebase');
const { generatePerformanceReportText } = require('../services/telegramService');
const router = express.Router();

// POST /api/telegram/webhook/:token (Public webhook called by Telegram)
router.post('/webhook/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const update = req.body;

    if (!update || !update.message) {
      return res.sendStatus(200); // Selalu kembalikan 200 ke Telegram
    }

    const message = update.message;
    const text = String(message.text || '').trim().toLowerCase();
    const chatId = message.chat.id;

    // 1. Cari akun Telegram sosial di DB yang memiliki access_token === token
    const accountsSnap = await db.collection('social_accounts')
      .where('platform', '==', 'telegram')
      .where('access_token', '==', token)
      .limit(1)
      .get();

    if (accountsSnap.empty) {
      console.warn(`[Telegram Webhook] Akun tidak ditemukan untuk token: ${token.slice(0, 8)}...`);
      return res.sendStatus(200);
    }

    const accDoc = accountsSnap.docs[0];
    const accData = accDoc.data();
    const userId = accData.user_id;

    // 2. Tangani perintah
    if (text === '/report' || text === '/kinerja' || text === '/status' || text === 'minta laporan') {
      const replyUrl = `https://api.telegram.org/bot${token}/sendMessage`;
      
      // Kirim indikasi loading cepat
      try {
        await axios.post(replyUrl, {
          chat_id: chatId,
          text: `⏳ <i>Sedang menyusun laporan kinerja Anda... Mohon tunggu sebentar.</i>`,
          parse_mode: 'HTML'
        });
      } catch (_) {}

      // Ambil data laporan
      const reportText = await generatePerformanceReportText(userId);

      // Kirim hasil laporan kinerja asli
      await axios.post(replyUrl, {
        chat_id: chatId,
        text: reportText,
        parse_mode: 'HTML'
      });
      console.log(`[Telegram Webhook] Berhasil memproses laporan On-Demand untuk User ID: ${userId}`);
    } else if (text === '/start' || text === '/help') {
      const replyUrl = `https://api.telegram.org/bot${token}/sendMessage`;
      await axios.post(replyUrl, {
        chat_id: chatId,
        text: `👋 <b>Halo! Saya adalah Medsos Agent Report Bot.</b>\n\nKirim perintah berikut untuk berinteraksi dengan saya:\n\n• <code>/report</code> atau <code>/kinerja</code> - Mengambil Laporan Kinerja 24 jam terakhir secara real-time.\n• <code>/status</code> - Mengecek ringkasan performa dan postingan Anda.\n• <code>/help</code> - Menampilkan bantuan ini.`,
        parse_mode: 'HTML'
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[Telegram Webhook Error]:', err.message);
    res.sendStatus(200); // Selalu kirim 200 OK agar Telegram tidak terus-terusan mengulang request (retry loops)
  }
});

module.exports = router;
