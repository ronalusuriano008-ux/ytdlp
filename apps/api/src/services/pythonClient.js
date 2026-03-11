// apps/api/src/services/pythonClient.js

const fetch = require("node-fetch");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // ⚠️ solo para desarrollo


const PYTHON_URL = process.env.PYTHON_URL || "http://localhost:5000";

/**
 * Llama al Python Worker
 * @param {string} endpoint - nombre del endpoint: "search", "metadata", "download_audio", etc.
 * @param {object} payload - datos para enviar
 */
async function call(endpoint, payload = {}) {
  try {
    let url = `${PYTHON_URL}/${endpoint}`;
    let options = {};

    // GET para search
    if (endpoint === "search" && payload.query) {
      url += `?q=${encodeURIComponent(payload.query)}`;
      options = { method: "GET" };
    } else {
      // POST para metadata y descargas
      options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      };
    }

    const res = await fetch(url, options);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Python responded with ${res.status}: ${text}`);
    }

    const data = await res.json();

    // 🔥 Si es descarga, devolver solo filePath
    if (endpoint === "download_audio" || endpoint === "download_video") {
      if (!data.filePath) {
        throw new Error("Python did not return filePath");
      }
      return data.filePath;
    }

    return data;

  } catch (err) {
    console.error(`[pythonClient] Error calling ${endpoint}:`, err);
    throw err;
  }
}

module.exports = { call };