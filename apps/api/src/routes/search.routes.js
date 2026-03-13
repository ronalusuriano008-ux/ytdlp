const router = require("express").Router();
const python = require("../services/pythonClient");

const cache = new Map();
const CACHE_TTL = 1000 * 60 * 5;
const MAX_QUERY_LENGTH = 100;
const MAX_CACHE_ITEMS = 200;

function pruneCache() {
  const now = Date.now();

  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }

  while (cache.size > MAX_CACHE_ITEMS) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

router.get("/", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.status(400).json({
        ok: false,
        error: "No query provided"
      });
    }

    if (query.length > MAX_QUERY_LENGTH) {
      return res.status(400).json({
        ok: false,
        error: "Query too long"
      });
    }

    const cacheKey = query.toLowerCase();
    pruneCache();

    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      res.set("Cache-Control", "public, max-age=300");
      return res.json({
        ok: true,
        results: cached.data
      });
    }

    const results = await python.call("search", { query });

    console.log("[search] worker result:", results);
    console.log("[search] isArray:", Array.isArray(results));

    if (!Array.isArray(results)) {
      return res.status(502).json({
        ok: false,
        error: "Invalid response from worker"
      });
    }

    cache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });

    res.set("Cache-Control", "public, max-age=300");
    return res.json({
      ok: true,
      results
    });
  } catch (err) {
    const isTimeout = String(err.message || "").toLowerCase().includes("timeout");

    if (isTimeout) {
      return res.status(504).json({
        ok: false,
        error: "Search timeout"
      });
    }

    console.error("[search] Error:", err.message);

    return res.status(500).json({
      ok: false,
      error: "Internal server error"
    });
  }
});

module.exports = router;