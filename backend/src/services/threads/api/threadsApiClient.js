const axios = require('axios');

const GRAPH_VERSION = 'v1.0';
const BASE_URL = `https://graph.threads.net/${GRAPH_VERSION}`;

/**
 * Standardized Meta Graph API error parser
 */
function parseMetaError(err, context = 'Threads API') {
  const metaError = err.response?.data?.error;
  if (metaError) {
    const code = metaError.code;
    const subcode = metaError.error_subcode;
    const message = metaError.message || metaError.error_user_msg || 'Unknown Meta API Error';
    const type = metaError.type || 'OAuthException';
    return new Error(`[${context}] Meta Error (${type} | Code: ${code}, Subcode: ${subcode}): ${message}`);
  }
  return new Error(`[${context}] Network/HTTP Error: ${err.message}`);
}

/**
 * Low-level HTTP GET request to Threads API
 */
async function get(endpoint, token, params = {}, timeoutMs = 15000) {
  try {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `${BASE_URL}/${cleanEndpoint}`;
    const response = await axios.get(url, {
      params: { access_token: token, ...params },
      timeout: timeoutMs,
    });
    return response.data;
  } catch (err) {
    throw parseMetaError(err, `GET /${endpoint}`);
  }
}

/**
 * Low-level HTTP POST request to Threads API
 */
async function post(endpoint, token, data = {}, params = {}, timeoutMs = 20000) {
  try {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `${BASE_URL}/${cleanEndpoint}`;
    const response = await axios.post(url, data, {
      params: { access_token: token, ...params },
      timeout: timeoutMs,
    });
    return response.data;
  } catch (err) {
    throw parseMetaError(err, `POST /${endpoint}`);
  }
}

module.exports = {
  GRAPH_VERSION,
  BASE_URL,
  get,
  post,
  parseMetaError,
};
