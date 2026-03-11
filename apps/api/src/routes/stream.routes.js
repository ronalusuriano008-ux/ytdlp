const router = require("express").Router();
const python = require("../services/pythonClient");

const cache = new Map();
const CACHE_TTL = 1000 * 60 * 10; 

router.get("/", async (req, res) => {
  try {
    const url = (req.query.url || "").trim();

    if (!url) {
      return res.status(400).json({ error: "No url provided" });
    }

    const cacheKey = url;

    if (cache.has(cacheKey)) {
      const { data, timestamp } = cache.get(cacheKey);

      if (Date.now() - timestamp < CACHE_TTL) {
        return res.json(data);
      }

      cache.delete(cacheKey);
    }

    // ⏱ Timeout agresivo
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const result = await python.call(
      "stream_url",
      { url },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (!result || !result.directUrl) {
      return res.status(502).json({ error: "Invalid response from worker" });
    }

    // 🚀 Guardar en cache
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    res.set("Cache-Control", "public, max-age=600");
    res.json(result);

  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Stream timeout" });
    }

    console.error("Error en stream:", err.message);
    res.status(500).json({ error: "Error llamando a Python" });
  }
});

module.exports = router;