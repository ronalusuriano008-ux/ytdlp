const fetch = require("node-fetch");
const AbortController = global.AbortController || require("abort-controller");

const WORKER_URL = process.env.WORKER_URL || process.env.PYTHON_URL || "http://127.0.0.1:5000";
const WORKER_TIMEOUT = Number(process.env.WORKER_TIMEOUT || 120000);

function buildUrl(endpoint, payload = {}) {
  const baseUrl = `${WORKER_URL.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;

  if (endpoint === "search" && payload.query) {
    const url = new URL(baseUrl);
    url.searchParams.set("q", payload.query);
    return url.toString();
  }

  return baseUrl;
}

async function parseJsonSafe(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Respuesta inválida del worker: ${text}`);
  }
}

/**
 * Llama al worker Python/Flask
 * @param {string} endpoint
 * @param {object} payload
 * @returns {Promise<any>}
 */
async function call(endpoint, payload = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORKER_TIMEOUT);

  try {
    const isSearchGet = endpoint === "search" && payload.query;
    const url = buildUrl(endpoint, payload);

    const options = {
      method: isSearchGet ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal
    };

    if (!isSearchGet) {
      options.body = JSON.stringify(payload || {});
    }

    const response = await fetch(url, options);
    const data = await parseJsonSafe(response);

    console.log("[pythonClient] endpoint:", endpoint);
    console.log("[pythonClient] raw data:", data);

    if (!response.ok) {
      const message =
        data?.error ||
        data?.message ||
        `Worker respondió con estado ${response.status}`;

      throw new Error(message);
    }

    if (data && data.ok === false) {
      throw new Error(data.error || "El worker devolvió un error");
    }

    // Normalización por endpoint
    if (endpoint === "search") {
      return (
        data?.results?.results ??
        data?.results ??
        data?.data?.results ??
        data?.data ??
        data
      );
    }

    if (endpoint === "download_audio" || endpoint === "download_video") {
      const result = data.data ?? data;

      if (!result || !result.filePath) {
        throw new Error(`El worker no devolvió filePath en ${endpoint}`);
      }

      return result;
    }

    return data.data ?? data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Timeout al llamar al worker (${endpoint})`);
    }

    console.error(`[pythonClient] Error calling ${endpoint}:`, error.message);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { call };