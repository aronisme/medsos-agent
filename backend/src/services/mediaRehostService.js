/**
 * Media Delivery Resolver & Rehost Service
 * 
 * Provides production-grade media resolution, SSRF protection,
 * Cloudinary rehosting for non-public/restricted CDNs (e.g. Shopee),
 * and persistent Firestore + in-memory caching.
 */

const axios = require('axios');
const crypto = require('crypto');
const FormData = require('form-data');
const { db } = require('../config/firebase');

// Allowed source domains for external fetching (SSRF Prevention)
const ALLOWED_SOURCE_HOSTS = [
  'susercontent.com',
  'shopee.co.id',
  'cf.shopee.co.id',
  'down-id.img.susercontent.com',
  'down-bs-id.vod.susercontent.com',
  'down-vn.img.susercontent.com',
  'down-my.img.susercontent.com',
  'down-ph.img.susercontent.com',
  'down-th.img.susercontent.com',
  'down-br.img.susercontent.com',
  'down-tw.img.susercontent.com',
  'down-sg.img.susercontent.com'
];

// Domains already trusted and publicly fetchable by Meta crawlers
const TRUSTED_PUBLIC_HOSTS = [
  'res.cloudinary.com',
  'cloudinary.com',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  's3.amazonaws.com',
  'images.unsplash.com'
];

// Configuration
const CONFIG = {
  MAX_IMAGE_SIZE_BYTES: 15 * 1024 * 1024, // 15 MB
  MAX_VIDEO_SIZE_BYTES: 50 * 1024 * 1024, // 50 MB
  DOWNLOAD_TIMEOUT_MS: 20000,             // 20s
  CLOUDINARY_IMAGE_NAME: process.env.CLOUDINARY_CLOUD_NAME_IMAGE || 'dwgfox722',
  CLOUDINARY_IMAGE_PRESET: process.env.CLOUDINARY_UPLOAD_PRESET_IMAGE || 'lynke_app',
  CLOUDINARY_VIDEO_NAME: process.env.CLOUDINARY_CLOUD_NAME_VIDEO || 'drkbqpxqf',
  CLOUDINARY_VIDEO_PRESET: process.env.CLOUDINARY_UPLOAD_PRESET_VIDEO || 'vidgram',
};

// In-Memory Fast LRU-style cache
const memoryCache = new Map();
const MAX_MEM_CACHE_ENTRIES = 500;

function getCacheKey(url) {
  if (!url || typeof url !== 'string') return '';
  const normalized = url.trim().split('?')[0].toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

/**
 * SSRF Protection & URL Validation
 */
function validateMediaUrlSecurity(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, reason: 'URL media kosong atau tidak valid.' };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (err) {
    return { valid: false, reason: `URL tidak valid: ${err.message}` };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: `Protokol dilarang (${parsed.protocol}). Hanya http/https yang diizinkan.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block private, loopback, and cloud metadata IP ranges
  const isPrivateIp = 
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '169.254.169.254' ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local');

  if (isPrivateIp) {
    return { valid: false, reason: `Akses ke host private/internal dilarang: ${hostname}` };
  }

  // Check if host is in trusted public or allowed source list
  const isTrustedPublic = TRUSTED_PUBLIC_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
  const isAllowedSource = ALLOWED_SOURCE_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));

  if (!isTrustedPublic && !isAllowedSource) {
    return { valid: false, reason: `Host ${hostname} tidak terdaftar dalam allowlist media.` };
  }

  return { valid: true, isTrustedPublic, isAllowedSource, hostname };
}

/**
 * Resolve specialized request headers for specific source providers
 */
function resolveSourceHeaders(url, hostname) {
  const isShopee = hostname.includes('susercontent.com') || hostname.includes('shopee.co.id');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  };

  if (isShopee) {
    headers['Referer'] = 'https://shopee.co.id/';
    headers['Origin'] = 'https://shopee.co.id';
    headers['sec-ch-ua'] = '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"';
    headers['sec-ch-ua-mobile'] = '?0';
    headers['sec-ch-ua-platform'] = '"Windows"';
    headers['sec-fetch-dest'] = 'image';
    headers['sec-fetch-mode'] = 'no-cors';
    headers['sec-fetch-site'] = 'cross-site';
  }

  return headers;
}

/**
 * Rehost a single media item to Cloudinary with persistent caching
 * 
 * @param {string} mediaUrl 
 * @param {'image'|'video'} [mediaType] 
 * @returns {Promise<{ media_url: string, media_type: string, source_url: string, rehosted: boolean, cloudinary_public_id?: string }>}
 */
async function resolveAndRehostMedia(mediaUrl, mediaType = 'image') {
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    throw new Error('mediaUrl wajib berupa string.');
  }

  const rawUrl = mediaUrl.trim();
  const sec = validateMediaUrlSecurity(rawUrl);

  if (!sec.valid) {
    throw new Error(`[Security Error] ${sec.reason}`);
  }

  // 1. Bypass check: If already on trusted public CDN (e.g. Cloudinary) -> pass-through
  if (sec.isTrustedPublic) {
    return {
      media_url: rawUrl,
      media_type: mediaType,
      source_url: rawUrl,
      rehosted: false,
    };
  }

  const cacheKey = getCacheKey(rawUrl);

  // 2. Check Fast Memory Cache
  if (memoryCache.has(cacheKey)) {
    const mem = memoryCache.get(cacheKey);
    console.log(`[MediaResolver] In-Memory Cache Hit: ${cacheKey.slice(0, 8)} -> ${mem.media_url}`);
    return { ...mem, rehosted: true };
  }

  // 3. Check Persistent Firestore Cache
  try {
    const cacheDoc = await db.collection('media_cache').doc(cacheKey).get();
    if (cacheDoc.exists) {
      const data = cacheDoc.data();
      if (data.cloudinary_url && data.status === 'active') {
        const cachedResult = {
          media_url: data.cloudinary_url,
          media_type: data.media_type || mediaType,
          source_url: rawUrl,
          source_provider: data.source_provider || 'shopee',
          cloudinary_public_id: data.cloudinary_public_id,
          rehosted: true,
        };

        if (memoryCache.size < MAX_MEM_CACHE_ENTRIES) {
          memoryCache.set(cacheKey, cachedResult);
        }

        console.log(`[MediaResolver] Firestore Cache Hit: ${cacheKey.slice(0, 8)} -> ${data.cloudinary_url}`);
        return cachedResult;
      }
    }
  } catch (cacheReadErr) {
    console.warn('[MediaResolver] Warning checking Firestore media_cache:', cacheReadErr.message);
  }

  // 4. Download source buffer with legitimate browser headers
  const isVideo = mediaType === 'video' || rawUrl.includes('.mp4') || rawUrl.includes('/vod.');
  const cleanMediaType = isVideo ? 'video' : 'image';
  const maxSize = isVideo ? CONFIG.MAX_VIDEO_SIZE_BYTES : CONFIG.MAX_IMAGE_SIZE_BYTES;

  console.log(`[MediaResolver] Downloading non-public media (${cleanMediaType}): ${rawUrl.slice(0, 75)}...`);

  const headers = resolveSourceHeaders(rawUrl, sec.hostname);

  let response;
  try {
    response = await axios.get(rawUrl, {
      responseType: 'arraybuffer',
      headers,
      timeout: CONFIG.DOWNLOAD_TIMEOUT_MS,
      maxContentLength: maxSize,
      maxBodyLength: maxSize,
    });
  } catch (downloadErr) {
    const status = downloadErr.response?.status;
    console.error(`[MediaResolver] Download failed (${status || 'NETWORK_ERROR'}): ${rawUrl}`);
    throw new Error(`Gagal mengunduh media dari ${sec.hostname} (Status: ${status || downloadErr.message})`);
  }

  const contentType = response.headers['content-type'] || (isVideo ? 'video/mp4' : 'image/jpeg');
  const buffer = Buffer.from(response.data);

  if (buffer.length === 0) {
    throw new Error('Media yang diunduh berukuran 0 byte.');
  }

  // 5. Upload buffer to Cloudinary
  const cloudName = isVideo ? CONFIG.CLOUDINARY_VIDEO_NAME : CONFIG.CLOUDINARY_IMAGE_NAME;
  const uploadPreset = isVideo ? CONFIG.CLOUDINARY_VIDEO_PRESET : CONFIG.CLOUDINARY_IMAGE_PRESET;
  const resourceType = isVideo ? 'video' : 'image';

  console.log(`[MediaResolver] Uploading to Cloudinary (${resourceType}, ${buffer.length} bytes, cloud: ${cloudName})...`);

  const base64Data = buffer.toString('base64');
  const formData = new URLSearchParams();
  formData.append('file', `data:${contentType};base64,${base64Data}`);
  formData.append('upload_preset', uploadPreset);

  let cloudRes;
  try {
    cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: 'POST',
      body: formData,
    });
  } catch (cloudNetErr) {
    throw new Error(`Koneksi ke Cloudinary gagal: ${cloudNetErr.message}`);
  }

  const cloudData = await cloudRes.json();

  if (!cloudRes.ok || !cloudData.secure_url) {
    const errMsg = cloudData.error?.message || 'Gagal mengunggah media ke Cloudinary';
    console.error('[MediaResolver] Cloudinary upload error:', errMsg, cloudData);
    throw new Error(`Cloudinary error: ${errMsg}`);
  }

  const result = {
    media_url: cloudData.secure_url,
    media_type: cleanMediaType,
    source_url: rawUrl,
    source_provider: sec.hostname.includes('shopee') || sec.hostname.includes('susercontent') ? 'shopee' : 'external',
    rehosted: true,
    cloudinary_public_id: cloudData.public_id,
    cloudinary_resource_type: resourceType,
    bytes: cloudData.bytes || buffer.length,
    format: cloudData.format
  };

  // 6. Save mapping to persistent Firestore media_cache (non-blocking write)
  try {
    await db.collection('media_cache').doc(cacheKey).set({
      source_url: rawUrl,
      source_host: sec.hostname,
      cloudinary_public_id: cloudData.public_id,
      cloudinary_url: cloudData.secure_url,
      media_type: cleanMediaType,
      content_type: contentType,
      content_length: buffer.length,
      status: 'active',
      created_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
    });
  } catch (cacheWriteErr) {
    console.warn('[MediaResolver] Warning saving Firestore media_cache:', cacheWriteErr.message);
  }

  // Update memory cache
  if (memoryCache.size < MAX_MEM_CACHE_ENTRIES) {
    memoryCache.set(cacheKey, result);
  }

  console.log(`[MediaResolver] ✅ Rehost successful: ${rawUrl.slice(0, 50)}... -> ${result.media_url}`);
  return result;
}

/**
 * Concurrently resolve an array of media objects with rate-limit concurrency
 * 
 * @param {Array<{ media_url?: string, url?: string, media_type?: string, type?: string }>} mediaArray 
 * @param {Object} [options]
 * @param {number} [options.concurrency=3]
 * @returns {Promise<{ updated: boolean, media: Array<{ media_url: string, media_type: string, source_url?: string, rehosted?: boolean }> }>}
 */
async function ensureMediaArrayReady(mediaArray = [], options = {}) {
  if (!Array.isArray(mediaArray) || mediaArray.length === 0) {
    return { updated: false, media: [] };
  }

  const { concurrency = 3 } = options;
  const resolvedList = [];
  let hasAnyRehost = false;

  // Process in chunks to prevent network saturation and serverless memory burst
  for (let i = 0; i < mediaArray.length; i += concurrency) {
    const chunk = mediaArray.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (item) => {
      const rawUrl = typeof item === 'string' ? item : (item.media_url || item.url || '');
      const rawType = (typeof item === 'object' && (item.media_type || item.type)) ? (item.media_type || item.type) : 'image';

      if (!rawUrl) return null;

      try {
        const res = await resolveAndRehostMedia(rawUrl, rawType);
        if (res.rehosted) {
          hasAnyRehost = true;
        }
        return {
          media_url: res.media_url,
          media_type: res.media_type,
          source_url: res.source_url,
          rehosted: res.rehosted,
          cloudinary_public_id: res.cloudinary_public_id,
        };
      } catch (err) {
        console.warn(`[MediaResolver] Warning resolving item ${rawUrl.slice(0, 50)}:`, err.message);
        // If rehost fails, return existing item so caller can decide
        return {
          media_url: rawUrl,
          media_type: rawType,
          error: err.message,
        };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    resolvedList.push(...chunkResults.filter(Boolean));
  }

  return {
    updated: hasAnyRehost,
    media: resolvedList,
  };
}

/**
 * Helper to classify if a post failure was media-related
 */
function isMediaRelatedFailure(postOrTarget) {
  if (!postOrTarget) return false;

  const errorMessages = [];
  if (typeof postOrTarget === 'string') {
    errorMessages.push(postOrTarget);
  } else {
    if (postOrTarget.error_message) errorMessages.push(postOrTarget.error_message);
    if (postOrTarget.error) errorMessages.push(postOrTarget.error);
    if (postOrTarget.first_reply?.reply_last_error) errorMessages.push(postOrTarget.first_reply.reply_last_error);
    if (Array.isArray(postOrTarget.targets)) {
      postOrTarget.targets.forEach(t => {
        if (t.error_message) errorMessages.push(t.error_message);
      });
    }
  }

  const fullErr = errorMessages.join(' ').toLowerCase();

  const mediaKeywords = [
    'the media could not be fetched',
    'media_url',
    'image_url',
    'video_url',
    'cannot be found',
    'gagal diproses (unknown)',
    'invalid, nonexistent, or expired',
    'timeout setelah 120s',
    'unsupported image',
    'susercontent',
    'media container'
  ];

  return mediaKeywords.some(k => fullErr.includes(k));
}

/**
 * Delete asset from Cloudinary using Destroy API
 */
async function deleteCloudinaryAsset(publicId, resourceType = 'image') {
  if (!publicId) return { success: false, reason: 'NO_PUBLIC_ID' };

  const isVideo = resourceType === 'video';
  const cloudName = isVideo ? CONFIG.CLOUDINARY_VIDEO_NAME : CONFIG.CLOUDINARY_IMAGE_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.log(`[MediaResolver Cleanup] Cloudinary credentials (API_KEY/SECRET) not present. Skipping remote asset destroy for ${publicId}.`);
    return { success: false, reason: 'NO_API_SECRET' };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(toSign).digest('hex');

    const formData = new URLSearchParams();
    formData.append('public_id', publicId);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    console.log(`[MediaResolver Cleanup] Deleted remote asset ${publicId}:`, data.result || data);
    return { success: data.result === 'ok', result: data.result };
  } catch (err) {
    console.warn(`[MediaResolver Cleanup] Error deleting ${publicId}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Cleanup old media from Cloudinary and database for posts older than retentionDays (e.g. 30 days)
 * 
 * @param {Object} [options]
 * @param {number} [options.retentionDays=30]
 * @param {number} [options.limit=30]
 * @returns {Promise<{ cleaned_posts: number, deleted_assets: number }>}
 */
async function cleanupOldCloudinaryMedia(options = {}) {
  const { retentionDays = 30, limit = 30 } = options;
  const cutoffEpoch = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  const cutoffIso = new Date(cutoffEpoch).toISOString();

  console.log(`[MediaResolver Cleanup] Scanning posted posts older than ${retentionDays} days (before ${cutoffIso.slice(0, 10)})...`);

  let cleanedPosts = 0;
  let deletedAssets = 0;

  try {
    // 1. Find posted posts where posted_at or scheduled_at < cutoffIso
    const postsSnap = await db.collection('posts')
      .where('status', '==', 'posted')
      .limit(limit)
      .get();

    for (const doc of postsSnap.docs) {
      const data = doc.data();
      const postDate = data.posted_at || data.scheduled_at || data.created_at;
      if (!postDate) continue;

      const postEpoch = new Date(postDate).getTime();
      if (isNaN(postEpoch) || postEpoch > cutoffEpoch) continue;

      const media = data.media || [];
      let updatedMedia = false;

      const newMedia = await Promise.all(media.map(async (m) => {
        if (typeof m === 'object' && m.rehosted && m.cloudinary_public_id) {
          const resType = m.media_type === 'video' ? 'video' : 'image';
          await deleteCloudinaryAsset(m.cloudinary_public_id, resType);
          deletedAssets++;
          updatedMedia = true;

          // Revert media_url to source_url if available
          return {
            ...m,
            media_url: m.source_url || m.media_url,
            rehosted: false,
            cleaned_at: new Date().toISOString(),
          };
        }
        return m;
      }));

      if (updatedMedia) {
        await db.collection('posts').doc(doc.id).update({
          media: newMedia,
          media_cleaned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        cleanedPosts++;
      }
    }

    // 2. Also clean expired media_cache items
    try {
      const cacheSnap = await db.collection('media_cache')
        .where('created_at', '<', cutoffIso)
        .limit(limit)
        .get();

      for (const cDoc of cacheSnap.docs) {
        const cData = cDoc.data();
        if (cData.cloudinary_public_id) {
          await deleteCloudinaryAsset(cData.cloudinary_public_id, cData.media_type || 'image');
        }
        await db.collection('media_cache').doc(cDoc.id).delete();
      }
    } catch (cErr) {
      console.warn('[MediaResolver Cleanup] Warning cleaning media_cache:', cErr.message);
    }

    console.log(`[MediaResolver Cleanup] ✅ Done. Cleaned ${cleanedPosts} posts, removed ${deletedAssets} remote assets.`);
  } catch (err) {
    console.error('[MediaResolver Cleanup] Error during media cleanup:', err.message);
  }

  return { cleaned_posts: cleanedPosts, deleted_assets: deletedAssets };
}

module.exports = {
  resolveAndRehostMedia,
  ensureMediaArrayReady,
  validateMediaUrlSecurity,
  isMediaRelatedFailure,
  deleteCloudinaryAsset,
  cleanupOldCloudinaryMedia,
  ALLOWED_SOURCE_HOSTS,
  TRUSTED_PUBLIC_HOSTS,
};
