const router = require("express").Router();
const python = require("../services/pythonClient");

const cache = new Map();
const CACHE_TTL = 1000 * 60 * 15; // 15 minutos

router.get("/", async (req, res) => {
  try {
    const url = (req.query.url || "").trim();

    if (!url) {
      return res.status(400).json({ error: "No url provided" });
    }

    const cacheKey = url;

    // 🔥 Cache en memoria
    if (cache.has(cacheKey)) {
      const { data, timestamp } = cache.get(cacheKey);

      if (Date.now() - timestamp < CACHE_TTL) {
        return res.json(data);
      }

      cache.delete(cacheKey);
    }

    // ⏱ Timeout controlado
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const data = await python.call(
      "metadata",
      { url },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (!data) {
      return res.status(502).json({ error: "Invalid response from worker" });
    }

    // 🚀 Guardar en cache
    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    res.set("Cache-Control", "public, max-age=900");
    res.json(data);

  } catch (e) {
    if (e.name === "AbortError") {
      return res.status(504).json({ error: "Metadata timeout" });
    }

    res.status(500).json({ error: e.message });
  }
});

module.exports = router;