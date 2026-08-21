const { get, post } = require('./threadsApiClient');

/**
 * Mengambil daftar top-level replies dari sebuah postingan Threads
 * @param {string} threadId - ID Postingan / Media Threads
 * @param {string} token - User Access Token
 * @param {Object} [options] - { limit: number, after: string, fields: string }
 */
async function getReplies(threadId, token, options = {}) {
  const {
    limit = 25,
    after = null,
    fields = 'id,text,timestamp,username,permalink,has_replies,root_post,replied_to,is_reply'
  } = options;

  const params = { fields, limit };
  if (after) params.after = after;

  return await get(`${threadId}/replies`, token, params);
}

/**
 * Mengambil struktur percakapan lengkap dari sebuah thread
 * @param {string} threadId 
 * @param {string} token 
 */
async function getConversation(threadId, token) {
  return await get(`${threadId}/conversation`, token);
}

/**
 * Membuat container reply berformat teks untuk sebuah postingan / balasan orang lain
 * @param {string} threadsUserId - ID Pengguna Threads
 * @param {string} token 
 * @param {string} replyToId - ID Postingan target yang ingin dibalas
 * @param {string} text - Isi teks balasan
 */
async function createReplyContainer(threadsUserId, token, replyToId, text) {
  const params = {
    media_type: 'TEXT',
    text: String(text).slice(0, 495),
    reply_to_id: replyToId,
  };

  const data = await post(`${threadsUserId}/threads`, token, null, params);
  if (!data?.id) {
    throw new Error(`Gagal membuat container reply Threads: ${JSON.stringify(data)}`);
  }
  return data.id;
}

/**
 * Memublikasikan container reply yang sudah dibuat
 * @param {string} threadsUserId 
 * @param {string} token 
 * @param {string} creationId 
 */
async function publishReplyContainer(threadsUserId, token, creationId) {
  const params = { creation_id: creationId };
  const data = await post(`${threadsUserId}/threads_publish`, token, null, params);
  if (!data?.id) {
    throw new Error(`Gagal mempublish reply Threads: ${JSON.stringify(data)}`);
  }
  return data.id;
}

/**
 * Abstraksi terpadu untuk membalas komentar / thread dalam satu pemanggilan
 * @param {string} threadsUserId 
 * @param {string} token 
 * @param {{ replyToId: string, text: string }} options 
 */
async function publishTextReply(threadsUserId, token, { replyToId, text }) {
  if (!replyToId) throw new Error('replyToId wajib diisi.');
  if (!text) throw new Error('text balasan tidak boleh kosong.');

  const cleanUserId = threadsUserId ? String(threadsUserId).trim() : 'me';
  const creationId = await createReplyContainer(cleanUserId, token, replyToId, text);
  const publishedId = await publishReplyContainer(cleanUserId, token, creationId);
  return { success: true, publishedId, creationId };
}

/**
 * Membuat container postingan baru yang mengutip (Quote Post) postingan orang lain
 * @param {string} threadsUserId - ID Pengguna Threads
 * @param {string} token 
 * @param {string} quotePostId - ID Postingan publik Threads yang ingin di-quote
 * @param {string} text - Teks caption postingan kita
 */
async function createQuoteContainer(threadsUserId, token, quotePostId, text) {
  const params = {
    media_type: 'TEXT',
    text: String(text).slice(0, 495),
    quote_post_id: quotePostId,
  };

  const data = await post(`${threadsUserId}/threads`, token, null, params);
  if (!data?.id) {
    throw new Error(`Gagal membuat container Quote Post Threads: ${JSON.stringify(data)}`);
  }
  return data.id;
}

/**
 * Abstraksi terpadu untuk mempublikasikan Quote Post ke Threads
 * @param {string} threadsUserId 
 * @param {string} token 
 * @param {{ quotePostId: string, text: string }} options 
 */
async function publishQuotePost(threadsUserId, token, { quotePostId, text }) {
  if (!quotePostId) throw new Error('quotePostId wajib diisi.');
  if (!text) throw new Error('text postingan tidak boleh kosong.');

  const cleanUserId = threadsUserId ? String(threadsUserId).trim() : 'me';
  const creationId = await createQuoteContainer(cleanUserId, token, quotePostId, text);
  const publishedId = await publishReplyContainer(cleanUserId, token, creationId);
  return { success: true, publishedId, creationId };
}

/**
 * Menyembunyikan atau memunculkan kembali komentar (Reply Moderation)
 * @param {string} replyId - ID Balasan
 * @param {string} token 
 * @param {boolean} hide - true untuk sembunyikan, false untuk unhide
 */
async function manageReply(replyId, token, hide = true) {
  const params = { hide: Boolean(hide) };
  return await post(`${replyId}/manage_reply`, token, null, params);
}

module.exports = {
  getReplies,
  getConversation,
  createReplyContainer,
  publishReplyContainer,
  publishTextReply,
  createQuoteContainer,
  publishQuotePost,
  manageReply,
};
