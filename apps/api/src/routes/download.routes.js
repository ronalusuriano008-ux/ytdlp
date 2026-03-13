const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const python = require("../services/pythonClient");

const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_DOWNLOADS || 4);

let activeDownloads = 0;
const queue = [];

function runNext() {
  if (queue.length === 0 || activeDownloads >= MAX_CONCURRENT) {
    return;
  }

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
  if (!payload || !payload.url) {
    const error = new Error("Missing url");
    error.status = 400;
    throw error;
  }

  const result = await python.call(method, payload);
  const filePath = result?.filePath;

  if (!filePath) {
    const error = new Error("El worker no devolvió filePath");
    error.status = 500;
    throw error;
  }

  if (!fs.existsSync(filePath)) {
    const error = new Error("El archivo generado no existe");
    error.status = 500;
    throw error;
  }

  return {
    filePath,
    filename: result?.filename || path.basename(filePath)
  };
}

function removeFileSafe(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`No se pudo eliminar el archivo temporal: ${filePath}`);
      console.error(err.message);
    }
  });
}

function sendAndDelete(res, filePath, filename) {
  const stat = fs.statSync(filePath);

  res.setHeader("Content-Length", stat.size);

  res.download(filePath, filename, (err) => {
    removeFileSafe(filePath);

    if (err) {
      console.error("Error enviando archivo:", err.message);
    }
  });
}

router.post("/video", async (req, res) => {
  try {
    const { filePath, filename } = await enqueue(() =>
      safeDownload("download_video", req.body)
    );

    sendAndDelete(res, filePath, filename);
  } catch (err) {
    console.error("[download/video]", err.message);

    res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Video download failed"
    });
  }
});

router.post("/audio", async (req, res) => {
  try {
    const { filePath, filename } = await enqueue(() =>
      safeDownload("download_audio", req.body)
    );

    sendAndDelete(res, filePath, filename);
  } catch (err) {
    console.error("[download/audio]", err.message);

    res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Audio download failed"
    });
  }
});

module.exports = router;