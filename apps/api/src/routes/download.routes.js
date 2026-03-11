const router = require("express").Router();
const python = require("../services/pythonClient");
const fs = require("fs");
const path = require("path");

const MAX_CONCURRENT = 4;
let activeDownloads = 0;
const queue = [];

function runNext() {
  if (queue.length === 0 || activeDownloads >= MAX_CONCURRENT) return;

  const { fn, resolve, reject } = queue.shift();
  activeDownloads++;

  fn()
    .then(resolve)
    .catch(reject)
    .finally(() => {
      activeDownloads--;
      runNext();
    });
}

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    process.nextTick(runNext);
  });
}

async function safeDownload(method, payload) {
  const result = await python.call(method, payload);
  const filePath = typeof result === "string" ? result : result?.filePath;

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("Archivo no generado");
  }

  return filePath;
}

function sendAndDelete(res, filePath) {
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Content-Length", fs.statSync(filePath).size);

  res.download(filePath, path.basename(filePath), (err) => {
    fs.unlink(filePath, () => {});
    if (err) console.error("Error enviando archivo:", err.message);
  });
}

router.get("/video", async (req, res) => {
  try {
    const filePath = await enqueue(() =>
      safeDownload("download_video", req.query)
    );

    sendAndDelete(res, filePath);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Video download failed" });
  }
});

router.post("/audio", async (req, res) => {
  try {
    const filePath = await enqueue(() =>
      safeDownload("download_audio", req.body)
    );

    sendAndDelete(res, filePath);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Audio download failed" });
  }
});

module.exports = router;