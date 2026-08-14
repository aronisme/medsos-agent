const axios = require('axios');

const GRAPH_VERSION = 'v21.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

/**
 * Upload media ke Facebook Page (photos/videos) tanpa publish.
 * Mendukung URL publik maupun file lokal (/uploads/...).
 * @returns {Promise<string>} media_fbid
 */
async function uploadMedia(pageId, accessToken, mediaUrl, isVideo = false) {
  const endpoint = isVideo ? 'videos' : 'photos';

  if (!mediaUrl) throw new Error('URL media tidak boleh kosong.');

  if (mediaUrl.startsWith('/uploads/') || mediaUrl.startsWith('uploads/')) {
    const cleanPath = mediaUrl.startsWith('/') ? mediaUrl.slice(1) : mediaUrl;
    const filePath = path.resolve(__dirname, '..', '..', 'storage', cleanPath);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File media lokal tidak ditemukan: ${filePath}`);
    }

    const form = new FormData();
    form.append('access_token', accessToken);
    form.append('published', 'false');
    form.append('source', fs.createReadStream(filePath));

    const { data } = await axios.post(`${BASE}/${pageId}/${endpoint}`, form, {
      headers: form.getHeaders(),
    });
    if (!data?.id) throw new Error(`FB upload media lokal gagal: ${JSON.stringify(data)}`);
    return data.id;
  } else {
    const body = isVideo
      ? { file_url: mediaUrl, published: 'false' }
      : { url: mediaUrl, published: 'false' };

    const { data } = await axios.post(`${BASE}/${pageId}/${endpoint}`, body, {
      params: { access_token: accessToken },
    });
    if (!data?.id) throw new Error(`FB upload media gagal: ${JSON.stringify(data)}`);
    return data.id;
  }
}

/**
 * Buat postingan di halaman Facebook.
 * @returns {Promise<string>} post id di Facebook
 */
async function createPost(pageId, accessToken, message, mediaIds = []) {
  const postData = { message };
  if (mediaIds.length > 0) {
    postData.attached_media = mediaIds.map((id) => ({ media_fbid: id }));
  }
  const { data } = await axios.post(`${BASE}/${pageId}/feed`, postData, {
    params: { access_token: accessToken },
  });
  if (!data?.id) throw new Error(`FB create post gagal: ${JSON.stringify(data)}`);
  return data.id;
}

/**
 * Post Facebook Reel menggunakan Meta 3-Phase Resumable Upload API (video_reels).
 * @param {{page_id:string, access_token:string}} account
 * @param {string} content
 * @param {string} mediaUrl
 * @returns {Promise<{postId:string}>}
 */
async function postReelToFacebook(account, content, mediaUrl) {
  if (!mediaUrl) throw new Error('URL video untuk Reel tidak boleh kosong.');
  const pageId = account.page_id;
  const token = account.access_token;

  // Phase 1: Inisialisasi (upload_phase=start)
  const startRes = await axios.post(`${BASE}/${pageId}/video_reels`, null, {
    params: {
      upload_phase: 'start',
      access_token: token,
    },
  });

  const videoId = startRes.data?.video_id;
  const uploadUrl = startRes.data?.upload_url;

  if (!videoId || !uploadUrl) {
    throw new Error(`Inisialisasi FB Reels gagal: ${JSON.stringify(startRes.data)}`);
  }

  // Phase 2: Transfer binary file video ke upload_url (rupload.facebook.com)
  if (mediaUrl.startsWith('/uploads/') || mediaUrl.startsWith('uploads/')) {
    const cleanPath = mediaUrl.startsWith('/') ? mediaUrl.slice(1) : mediaUrl;
    const filePath = path.resolve(__dirname, '..', '..', 'storage', cleanPath);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File video Reel lokal tidak ditemukan: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = fileBuffer.length;

    await axios.post(uploadUrl, fileBuffer, {
      headers: {
        Authorization: `OAuth ${token}`,
        offset: 0,
        file_size: fileSize,
        'Content-Length': fileSize,
        'X-Entity-Length': fileSize,
        'Content-Type': 'application/octet-stream',
      },
    });
  } else {
    const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
    const fileBuffer = Buffer.from(response.data);
    const fileSize = fileBuffer.length;

    await axios.post(uploadUrl, fileBuffer, {
      headers: {
        Authorization: `OAuth ${token}`,
        offset: 0,
        file_size: fileSize,
        'Content-Length': fileSize,
        'X-Entity-Length': fileSize,
        'Content-Type': 'application/octet-stream',
      },
    });
  }

  // Phase 3: Finalisasi (upload_phase=finish)
  const finishRes = await axios.post(`${BASE}/${pageId}/video_reels`, null, {
    params: {
      upload_phase: 'finish',
      video_id: videoId,
      description: content || '',
      video_state: 'PUBLISHED',
      access_token: token,
    },
  });

  const finishData = finishRes.data;
  if (finishData?.success !== true && !finishData?.video_id && !finishData?.post_id && !finishData?.id) {
    throw new Error(`Finalisasi FB Reel gagal: ${JSON.stringify(finishData)}`);
  }

  return { postId: finishData?.post_id || finishData?.video_id || videoId };
}

/**
 * Orkestrasi posting ke Facebook Page.
 * Mendukung post teks, foto, video biasa, dan Facebook Reels.
 * @param {{page_id:string, access_token:string}} account
 * @param {string} content
 * @param {Array<{media_url:string, media_type:string}>} media
 * @param {'feed'|'reel'} postType
 * @returns {Promise<{postId:string}>}
 */
async function postToFacebook(account, content, media = [], postType = 'feed') {
  // Pastikan media adalah array dan normalisasi format objeknya
  if (!Array.isArray(media)) media = [];
  const normalizedMedia = media.map(m => ({
    media_url: m?.url || m?.media_url || '',
    media_type: m?.type || m?.media_type || 'image'
  })).filter(m => Boolean(m.media_url));

  // Pastikan media beneran video (bukan foto .png/.jpg yang salah pilih tipe)
  const videoMedia = normalizedMedia.find((m) => {
    if (m.media_type !== 'video') return false;
    const url = m.media_url.toLowerCase();
    return !/\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  });

  if (videoMedia && postType === 'reel') {
    return await postReelToFacebook(account, content, videoMedia.media_url);
  }

  const hasVideo = Boolean(videoMedia);

  if (hasVideo) {
    // Facebook Video dikirim langsung ke endpoint /{page_id}/videos dengan description
    const mediaUrl = videoMedia.media_url;

    if (mediaUrl.startsWith('/uploads/') || mediaUrl.startsWith('uploads/')) {
      const cleanPath = mediaUrl.startsWith('/') ? mediaUrl.slice(1) : mediaUrl;
      const filePath = path.resolve(__dirname, '..', '..', 'storage', cleanPath);

      if (!fs.existsSync(filePath)) {
        throw new Error(`File video lokal tidak ditemukan: ${filePath}`);
      }

      const form = new FormData();
      form.append('access_token', account.access_token);
      form.append('description', content || '');
      form.append('source', fs.createReadStream(filePath));

      const { data } = await axios.post(`${BASE}/${account.page_id}/videos`, form, {
        headers: form.getHeaders(),
      });
      if (!data?.id) throw new Error(`FB publish video lokal gagal: ${JSON.stringify(data)}`);
      return { postId: data.id };
    } else {
      const { data } = await axios.post(`${BASE}/${account.page_id}/videos`, {
        description: content || '',
        file_url: mediaUrl,
        access_token: account.access_token,
      });
      if (!data?.id) throw new Error(`FB publish video gagal: ${JSON.stringify(data)}`);
      return { postId: data.id };
    }
  }

  // Foto / Teks biasa
  const mediaIds = [];
  for (const m of normalizedMedia) {
    const id = await uploadMedia(account.page_id, account.access_token, m.media_url, false);
    mediaIds.push(id);
  }
  const postId = await createPost(account.page_id, account.access_token, content, mediaIds);
  return { postId };
}

module.exports = { postToFacebook, postReelToFacebook, uploadMedia, createPost, GRAPH_VERSION };

