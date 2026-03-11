const router = require("express").Router();
const python = require("../services/pythonClient");

const cache = new Map();
const CACHE_TTL = 1000 * 60 * 5;
const MAX_QUERY_LENGTH = 100;

router.get("/", async (req, res) => {
  try {
    const query = (req.query.q || "").trim();

    if (!query) {
      return res.status(400).json({ error: "No query provided" });
    }

    if (query.length > MAX_QUERY_LENGTH) {
      return res.status(400).json({ error: "Query too long" });
    }

    const cacheKey = query.toLowerCase();

    if (cache.has(cacheKey)) {
      const { data, timestamp } = cache.get(cacheKey);

      if (Date.now() - timestamp < CACHE_TTL) {
        return res.json(data);
      }

      cache.delete(cacheKey);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const data = await python.call("search", { query }, { signal: controller.signal });

    clearTimeout(timeout);

    if (!data || !Array.isArray(data.results)) {
      return res.status(502).json({ error: "Invalid response from worker" });
    }

    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    res.set("Cache-Control", "public, max-age=300");
    res.json(data);

  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Search timeout" });
    }

    console.error("[search] Error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;