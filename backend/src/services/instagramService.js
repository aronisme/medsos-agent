const axios = require('axios');

const GRAPH_VERSION = 'v21.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Buat media container untuk Instagram (single image/video).
 */
async function createMediaContainer(igUserId, token, { imageUrl, videoUrl, caption, isCarouselItem = false }) {
  const body = { caption, access_token: token };
  if (isCarouselItem) body.is_carousel_item = 'true';
  if (videoUrl) {
    body.media_type = 'REELS';
    body.video_url = videoUrl;
    body.share_to_feed = true;
  } else {
    body.image_url = imageUrl;
  }
  try {
    const { data } = await axios.post(`${BASE}/${igUserId}/media`, body);
    if (!data?.id) throw new Error(`IG create container gagal: ${JSON.stringify(data)}`);
    return data.id;
  } catch (err) {
    const detail = err?.response?.data?.error?.error_user_msg || err?.response?.data?.error?.message || err?.message;
    throw new Error(`IG create container gagal: ${detail}`);
  }
}

/**
 * Buat carousel container dari beberapa child container id.
 */
async function createCarouselContainer(igUserId, token, childrenIds, caption) {
  const { data } = await axios.post(`${BASE}/${igUserId}/media`, {
    media_type: 'CAROUSEL',
    children: childrenIds.join(','),
    caption,
    access_token: token,
  });
  if (!data?.id) throw new Error(`IG create carousel gagal: ${JSON.stringify(data)}`);
  return data.id;
}

/**
 * Poll status media container sampai FINISHED (maks timeoutMs).
 * status: IN_PROGRESS | FINISHED | ERROR (expired/error)
 */
async function waitForMediaReady(igUserId, token, creationId, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await axios.get(`${BASE}/${creationId}`, {
      params: { fields: 'status_code', access_token: token },
    });
    const status = data?.status_code;
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`IG media ${creationId} gagal diproses (${status}).`);
    }
    await sleep(5000); // cek tiap 5 detik
  }
  throw new Error(`IG media ${creationId} timeout setelah ${timeoutMs / 1000}s.`);
}

/**
 * Publish media yang sudah siap.
 */
async function publishMedia(igUserId, token, creationId) {
  const { data } = await axios.post(`${BASE}/${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  });
  if (!data?.id) throw new Error(`IG publish gagal: ${JSON.stringify(data)}`);
  return data.id;
}

/**
 * Orkestrasi posting ke Instagram Business Account.
 * Mendukung: single image, single video, dan carousel multi-gambar.
 * @param {{page_id:string, access_token:string}} account
 * @param {Array<{media_url:string, media_type:string}>} media
 */
async function postToInstagram(account, content, media = []) {
  if (!Array.isArray(media)) media = [];
  const normalizedMedia = media.map(m => ({
    media_url: m?.url || m?.media_url || '',
    media_type: m?.type || m?.media_type || 'image'
  })).filter(m => Boolean(m.media_url));

  if (normalizedMedia.length === 0) {
    throw new Error('Postingan Instagram wajib memiliki minimal 1 media (gambar/video).');
  }
  const igUserId = account.page_id;
  const token = account.access_token;

  let creationId;
  if (normalizedMedia.length === 1) {
    const m = normalizedMedia[0];
    const isVideo = m.media_type === 'video';
    creationId = await createMediaContainer(igUserId, token, {
      imageUrl: isVideo ? undefined : m.media_url,
      videoUrl: isVideo ? m.media_url : undefined,
      caption: content,
    });
  } else {
    // Carousel: buat container per item, lalu gabung
    const children = [];
    for (const m of normalizedMedia) {
      if (m.media_type === 'video') {
        throw new Error('Carousel Instagram tidak mendukung video. Gunakan gambar saja.');
      }
      const id = await createMediaContainer(igUserId, token, {
        imageUrl: m.media_url,
        isCarouselItem: true,
      });
      children.push(id);
    }
    creationId = await createCarouselContainer(igUserId, token, children, content);
  }

  await waitForMediaReady(igUserId, token, creationId);
  const postId = await publishMedia(igUserId, token, creationId);
  return { postId };
}

module.exports = { postToInstagram, GRAPH_VERSION };
