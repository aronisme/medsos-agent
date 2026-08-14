const axios = require('axios');

const GRAPH_VERSION = 'v1.0';
const BASE = `https://graph.threads.net/${GRAPH_VERSION}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Buat media container untuk Threads (TEXT, IMAGE, VIDEO).
 */
async function createMediaContainer(threadsUserId, token, { text, imageUrl, videoUrl }) {
  const body = { text, access_token: token };
  
  if (videoUrl) {
    body.media_type = 'VIDEO';
    body.video_url = videoUrl;
  } else if (imageUrl) {
    body.media_type = 'IMAGE';
    body.image_url = imageUrl;
  } else {
    body.media_type = 'TEXT';
  }

  const { data } = await axios.post(`${BASE}/${threadsUserId}/threads`, body);
  if (!data?.id) throw new Error(`Threads create container gagal: ${JSON.stringify(data)}`);
  return data.id;
}

/**
 * Poll status media container sampai FINISHED (maks timeoutMs).
 * status: IN_PROGRESS | FINISHED | ERROR
 */
async function waitForMediaReady(token, creationId, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await axios.get(`${BASE}/${creationId}`, {
      params: { fields: 'status', access_token: token },
    });
    const status = data?.status;
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      const errMsg = data?.error_message || status;
      throw new Error(`Threads media ${creationId} gagal diproses (${errMsg}).`);
    }
    await sleep(5000); // cek tiap 5 detik
  }
  throw new Error(`Threads media ${creationId} timeout setelah ${timeoutMs / 1000}s.`);
}

/**
 * Publish media yang sudah siap.
 */
async function publishMedia(threadsUserId, token, creationId) {
  const { data } = await axios.post(`${BASE}/${threadsUserId}/threads_publish`, {
    creation_id: creationId,
    access_token: token,
  });
  if (!data?.id) throw new Error(`Threads publish gagal: ${JSON.stringify(data)}`);
  return data.id;
}

/**
 * Orkestrasi posting ke Meta Threads Account.
 * Mendukung: text, single image, single video. (Carousel belum didukung API)
 * @param {{page_id:string, access_token:string}} account
 * @param {string} content
 * @param {Array<{media_url:string, media_type:string}>} media
 */
async function postToThreads(account, content, media = []) {
  if (!Array.isArray(media)) media = [];
  const normalizedMedia = media.map(m => ({
    media_url: m?.url || m?.media_url || '',
    media_type: m?.type || m?.media_type || 'image'
  })).filter(m => Boolean(m.media_url));

  const threadsUserId = account.page_id;
  const token = account.access_token;

  let imageUrl, videoUrl;

  if (normalizedMedia.length > 0) {
    const m = normalizedMedia[0];
    if (m.media_type === 'video') {
      videoUrl = m.media_url;
    } else {
      imageUrl = m.media_url;
    }
    if (normalizedMedia.length > 1) {
      console.warn('Threads API saat ini hanya mendukung 1 media. Media lainnya akan diabaikan.');
    }
  }

  // Jika tidak ada konten dan tidak ada media, tidak bisa post.
  if (!content && !imageUrl && !videoUrl) {
    throw new Error('Postingan Threads wajib memiliki teks, gambar, atau video.');
  }

  const creationId = await createMediaContainer(threadsUserId, token, {
    text: content,
    imageUrl,
    videoUrl,
  });

  // Jika mengirim media, butuh waktu untuk diproses Meta (khususnya video)
  if (imageUrl || videoUrl) {
    await waitForMediaReady(token, creationId);
  } else {
    // Teks biasanya langsung selesai, tapi untuk aman tunggu sebentar (rekomendasi Meta)
    await sleep(2000);
  }

  const postId = await publishMedia(threadsUserId, token, creationId);
  return { postId };
}

module.exports = { postToThreads, GRAPH_VERSION };
