const router = require("express").Router();
const python = require("../services/pythonClient");

const cache = new Map();
const CACHE_TTL = 1000 * 60 * 10;
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
    const url = String(req.query.url || "").trim();

    console.log("[stream] req.query:", req.query);
    console.log("[stream] url:", url);

    if (!url) {
      return res.status(400).json({
        ok: false,
        error: "No url provided"
      });
    }

    pruneCache();

    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      res.set("Cache-Control", "public, max-age=600");
      return res.json({
        ok: true,
        directUrl: cached.directUrl
      });
    }

    const result = await python.call("stream_url", { url });

    console.log("[stream] worker result:", result);

    if (
      !result ||
      typeof result.directUrl !== "string" ||
      !result.directUrl.trim()
    ) {
      return res.status(502).json({
        ok: false,
        error: "Invalid response from worker"
      });
    }

    cache.set(url, {
      directUrl: result.directUrl,
      timestamp: Date.now()
    });

    res.set("Cache-Control", "public, max-age=600");
    return res.json({
      ok: true,
      directUrl: result.directUrl
    });
  } catch (err) {
    const message = String(err.message || "");
    const lower = message.toLowerCase();

    console.error("[stream] Error:", message);

    if (lower.includes("timeout")) {
      return res.status(504).json({
        ok: false,
        error: "Stream timeout"
      });
    }

    if (lower.includes("missing url")) {
      return res.status(400).json({
        ok: false,
        error: "Missing url"
      });
    }

    return res.status(500).json({
      ok: false,
      error: "Internal server error"
    });
  }
});

module.exports = router;