/**
 * Shopee Media Resolver
 * Resolves high-resolution CDN images and MP4 video URLs.
 */

const SHOPEE_IMAGE_CDN = 'https://down-id.img.susercontent.com/file';
const SHOPEE_CF_CDN = 'https://cf.shopee.co.id/file';

/**
 * Resolves a single image key/hash or relative path to a full CDN URL.
 * @param {string} imageKey 
 * @returns {string|null}
 */
function resolveImageUrl(imageKey) {
  if (!imageKey || typeof imageKey !== 'string') return null;
  const cleanKey = imageKey.trim();
  if (cleanKey.startsWith('http://') || cleanKey.startsWith('https://')) {
    return cleanKey;
  }
  return `${SHOPEE_IMAGE_CDN}/${cleanKey}`;
}

/**
 * Resolves an array of image IDs to full CDN URLs.
 * @param {Array<string>|null|undefined} imageKeys 
 * @returns {string[]}
 */
function resolveImages(imageKeys) {
  if (!Array.isArray(imageKeys)) return [];
  const urls = [];
  for (const key of imageKeys) {
    const url = resolveImageUrl(key);
    if (url && !urls.includes(url)) {
      urls.push(url);
    }
  }
  return urls;
}

/**
 * Extracts and inspects video info from Shopee raw product data.
 * Tolerant: does not fail if video is missing or format is unexpected.
 * 
 * @param {object|null|undefined} rawData 
 * @returns {Array<{ url: string, thumbnail: string|null, duration: number|null, format: string }>}
 */
function extractVideos(rawData) {
  if (!rawData || typeof rawData !== 'object') return [];

  const videoList = rawData.video_info_list || rawData.videos || [];
  if (!Array.isArray(videoList) || videoList.length === 0) {
    // Check if there is a single video object
    if (rawData.video_info && typeof rawData.video_info === 'object') {
      const v = rawData.video_info;
      const url = v.default_format?.url || v.url;
      if (url) {
        return [{
          url,
          thumbnail: resolveImageUrl(v.thumb_url || v.thumbnail || rawData.image),
          duration: v.duration || null,
          format: 'mp4'
        }];
      }
    }
    return [];
  }

  const results = [];

  for (const item of videoList) {
    if (!item) continue;

    // Look for video URL inside default_format or formats array or direct url
    let directUrl = null;
    let format = 'mp4';

    if (item.default_format && item.default_format.url) {
      directUrl = item.default_format.url;
    } else if (Array.isArray(item.formats) && item.formats.length > 0) {
      const preferred = item.formats.find(f => f.format === 'mp4' || (f.url && f.url.includes('.mp4'))) || item.formats[0];
      directUrl = preferred?.url || null;
    } else if (item.url) {
      directUrl = item.url;
    }

    if (directUrl) {
      const thumb = resolveImageUrl(item.thumb_url || item.thumbnail || rawData.image);
      results.push({
        url: directUrl,
        thumbnail: thumb,
        duration: item.duration || null,
        format: format
      });
    }
  }

  return results;
}

module.exports = {
  resolveImageUrl,
  resolveImages,
  extractVideos
};
