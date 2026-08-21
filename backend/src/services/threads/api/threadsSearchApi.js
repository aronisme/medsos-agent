const { get } = require('./threadsApiClient');

/**
 * Mencari postingan publik di Threads berdasarkan kata kunci atau tag
 * @param {string} token - User Access Token
 * @param {string} query - Kata kunci pencarian
 * @param {Object} [options] - { searchType: 'RECENT'|'TOP', searchMode: 'KEYWORD'|'TAG', limit: number, fields: string, since: string, until: string }
 */
async function searchPosts(token, query, options = {}) {
  if (!query || !query.trim()) {
    throw new Error('Query pencarian tidak boleh kosong.');
  }

  const {
    searchType = 'RECENT',
    searchMode = 'KEYWORD',
    limit = 25,
    fields = 'id,text,permalink,timestamp,username,media_type',
    since = null,
    until = null,
    after = null,
  } = options;

  const params = {
    q: String(query).trim(),
    search_type: searchType,
    search_mode: searchMode,
    limit,
    fields,
  };

  if (since) params.since = since;
  if (until) params.until = until;
  if (after) params.after = after;

  return await get('keyword_search', token, params);
}

module.exports = {
  searchPosts,
};
