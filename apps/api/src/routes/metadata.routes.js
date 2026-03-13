const router = require("express").Router();
const python = require("../services/pythonClient");

const cache = new Map();
const CACHE_TTL = 1000 * 60 * 15;
const MAX_CACHE_ITEMS = 300;

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
    const url = String(req.query.url || "").trim();

    if (!url) {
      return res.status(400).json({
        ok: false,
        error: "No url provided"
      });
    }

    pruneCache();

    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      res.set("Cache-Control", "public, max-age=900");
      return res.json({
        ok: true,
        data: cached.data
      });
    }

    const data = await python.call("metadata", { url });

    if (!data) {
      return res.status(502).json({
        ok: false,
        error: "Invalid response from worker"
      });
    }

    cache.set(url, {
      data,
      timestamp: Date.now()
    });

    res.set("Cache-Control", "public, max-age=900");
    return res.json({
      ok: true,
      data
    });
  } catch (err) {
    const isTimeout = String(err.message || "").toLowerCase().includes("timeout");

    if (isTimeout) {
      return res.status(504).json({
        ok: false,
        error: "Metadata timeout"
      });
    }

    console.error("[metadata] Error:", err.message);

    return res.status(500).json({
      ok: false,
      error: err.message || "Internal server error"
    });
  }
});

module.exports = router;