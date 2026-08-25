const axios = require('axios');

const GRAPH_VERSION = 'v1.0';
const BASE = `https://graph.threads.net/${GRAPH_VERSION}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Buat media container untuk Threads (TEXT, IMAGE, VIDEO).
 * @param {string} threadsUserId 
 * @param {string} token 
 * @param {Object} options 
 * @param {string} [options.text] 
 * @param {string} [options.imageUrl] 
 * @param {string} [options.videoUrl] 
 * @param {boolean} [options.isCarouselItem] 
 * @param {string} [options.replyToId] 
 * @param {string} [options.quotePostId] 
 */
async function createMediaContainer(threadsUserId, token, { text, imageUrl, videoUrl, isCarouselItem = false, replyToId, quotePostId }) {
  const params = { access_token: token };
  if (text) params.text = text;
  if (isCarouselItem) params.is_carousel_item = 'true';
  if (replyToId) params.reply_to_id = replyToId;
  if (quotePostId) params.quote_post_id = quotePostId;

  if (videoUrl) {
    params.media_type = 'VIDEO';
    params.video_url = videoUrl;
  } else if (imageUrl) {
    params.media_type = 'IMAGE';
    params.image_url = imageUrl;
  } else {
    params.media_type = 'TEXT';
  }

  const { data } = await axios.post(`${BASE}/${threadsUserId}/threads`, null, { params });
  if (!data?.id) throw new Error(`Threads create container gagal: ${JSON.stringify(data)}`);
  return data.id;
}

/**
 * Buat Carousel media container untuk Threads (dari beberapa child container id).
 */
async function createCarouselContainer(threadsUserId, token, childrenIds, text, { replyToId, quotePostId } = {}) {
  const params = {
    media_type: 'CAROUSEL',
    children: childrenIds.join(','),
    access_token: token,
  };
  if (text) params.text = text;
  if (replyToId) params.reply_to_id = replyToId;
  if (quotePostId) params.quote_post_id = quotePostId;

  const { data } = await axios.post(`${BASE}/${threadsUserId}/threads`, null, { params });
  if (!data?.id) throw new Error(`Threads create carousel container gagal: ${JSON.stringify(data)}`);
  return data.id;
}

/**
 * Poll status media container sampai FINISHED (maks timeoutMs).
 * status: IN_PROGRESS | FINISHED | ERROR | EXPIRED
 */
async function waitForMediaReady(token, creationId, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await axios.get(`${BASE}/${creationId}`, {
      params: { fields: 'status,error_message', access_token: token },
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
  const { data } = await axios.post(`${BASE}/${threadsUserId}/threads_publish`, null, {
    params: {
      creation_id: creationId,
      access_token: token,
    }
  });
  if (!data?.id) throw new Error(`Threads publish gagal: ${JSON.stringify(data)}`);
  return data.id;
}

/**
 * Memastikan teks untuk Threads tidak pernah melebihi batas 500 karakter Meta API.
 * Menjaga link afiliasi & hook tetap utuh.
 */
function formatThreadsText(text = '', maxLen = 495) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;

  // Cari URL di dalam teks (terutama shortlink / CTA link)
  const urlMatch = trimmed.match(/(https?:\/\/[^\s]+)/i);
  const foundUrl = urlMatch ? urlMatch[0] : '';

  if (foundUrl) {
    const urlIndex = trimmed.indexOf(foundUrl);
    const beforeUrl = trimmed.substring(0, urlIndex).trim();
    const afterUrl = trimmed.substring(urlIndex + foundUrl.length).trim();

    const urlPart = `\n\n${foundUrl}`;
    const remainingBudget = maxLen - urlPart.length - (afterUrl ? 15 : 0);

    let trimmedBefore = beforeUrl;
    if (trimmedBefore.length > remainingBudget) {
      const lines = trimmedBefore.split('\n');
      let accumulated = '';
      for (const line of lines) {
        if ((accumulated + '\n' + line).length <= remainingBudget - 5) {
          accumulated += (accumulated ? '\n' : '') + line;
        } else {
          break;
        }
      }
      trimmedBefore = accumulated || trimmedBefore.substring(0, remainingBudget - 3) + '...';
    }

    let finalPost = `${trimmedBefore}${urlPart}`;
    if (afterUrl && finalPost.length + afterUrl.length + 2 <= maxLen) {
      finalPost += `\n\n${afterUrl}`;
    }
    return finalPost.slice(0, maxLen).trim();
  }

  return trimmed.substring(0, maxLen - 3).trim() + '...';
}

/**
 * Publikasikan Root Post ke Threads (Text, Single Image/Video, atau Carousel).
 * @param {{page_id:string, access_token:string}} account
 * @param {string} content
 * @param {Array<{media_url:string, media_type:string}>} media
 * @param {Object} [options]
 */
async function publishThreadsPost(account, content, media = [], options = {}) {
  return postToThreads(account, content, media, options);
}

/**
 * Publikasikan Balasan / First Reply ke sebuah Thread (menggunakan reply_to_id).
 * @param {{page_id:string, access_token:string}} account
 * @param {string} replyText
 * @param {string} rootPostId
 * @param {Object} [options]
 */
async function publishThreadsReply(account, replyText, rootPostId, options = {}) {
  if (!rootPostId) {
    throw new Error('publishThreadsReply memerlukan rootPostId yang valid.');
  }
  if (!replyText || typeof replyText !== 'string' || !replyText.trim()) {
    throw new Error('publishThreadsReply memerlukan teks balasan yang tidak kosong.');
  }
  return postToThreads(account, replyText, [], { ...options, replyToId: String(rootPostId) });
}

/**
 * Orkestrasi posting ke Meta Threads Account.
 * Mendukung: text, single image, single video, carousel (multi-gambar/video), reply, & quote post.
 * @param {{page_id:string, access_token:string}} account
 * @param {string} content
 * @param {Array<{media_url:string, media_type:string}>} media
 * @param {Object} [options]
 * @param {string} [options.replyToId]
 * @param {string} [options.quotePostId]
 */
async function postToThreads(account, content, media = [], options = {}) {
  if (!Array.isArray(media)) media = [];
  const normalizedMedia = media.map(m => ({
    media_url: m?.url || m?.media_url || '',
    media_type: m?.type || m?.media_type || 'image'
  })).filter(m => Boolean(m.media_url));

  const threadsUserId = account.page_id;
  const token = account.access_token;
  const { replyToId, quotePostId } = options;

  // Sanitasi panjang teks agar selalu mematuhi batas 500 karakter Threads API
  const formattedContent = formatThreadsText(content, 495);

  // Jika tidak ada konten dan tidak ada media, tidak bisa post.
  if (!formattedContent && normalizedMedia.length === 0) {
    throw new Error('Postingan Threads wajib memiliki teks, gambar, atau video.');
  }

  let creationId;

  if (normalizedMedia.length === 0) {
    // Postingan Teks saja
    creationId = await createMediaContainer(threadsUserId, token, {
      text: formattedContent,
      replyToId,
      quotePostId,
    });
  } else if (normalizedMedia.length === 1) {
    // Single Media (Image / Video)
    const m = normalizedMedia[0];
    const isVideo = m.media_type === 'video';
    creationId = await createMediaContainer(threadsUserId, token, {
      text: formattedContent,
      imageUrl: isVideo ? undefined : m.media_url,
      videoUrl: isVideo ? m.media_url : undefined,
      replyToId,
      quotePostId,
    });
  } else {
    // Carousel (Multi Media)
    const childIds = [];
    for (const m of normalizedMedia) {
      const isVideo = m.media_type === 'video';
      const childId = await createMediaContainer(threadsUserId, token, {
        imageUrl: isVideo ? undefined : m.media_url,
        videoUrl: isVideo ? m.media_url : undefined,
        isCarouselItem: true,
      });
      childIds.push(childId);
    }
    // Tunggu semua child container siap (khususnya jika ada video)
    for (const childId of childIds) {
      await waitForMediaReady(token, childId);
    }
    creationId = await createCarouselContainer(threadsUserId, token, childIds, formattedContent, { replyToId, quotePostId });
  }

  // Jika mengirim media (single / parent container), tunggu hingga FINISHED
  if (normalizedMedia.length > 0) {
    await waitForMediaReady(token, creationId);
  } else {
    await sleep(2000);
  }

  const postId = await publishMedia(threadsUserId, token, creationId);
  return { postId };
}

module.exports = {
  postToThreads,
  publishThreadsPost,
  publishThreadsReply,
  formatThreadsText,
  GRAPH_VERSION,
};


