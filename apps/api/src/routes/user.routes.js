const express = require("express");
const router = express.Router();

const {
  updateUser,
  readUser,
  sanitizeUsername
} = require("../services/userFileService");

const MAX_TITLE_LENGTH = 200;
const MAX_URL_LENGTH = 1000;
const MAX_TYPE_LENGTH = 20;
const MAX_HISTORY_ITEMS = 200;
const MAX_DOWNLOAD_ITEMS = 200;
const ALLOWED_TYPES = new Set(["audio", "video"]);

function normalizeText(value) {
  return String(value || "").trim();
}

function validateEntry({ username, title, url, type }) {
  const safeUsername = sanitizeUsername(username);
  const safeTitle = normalizeText(title);
  const safeUrl = normalizeText(url);
  const safeType = normalizeText(type).toLowerCase();

  if (!safeUsername || !safeTitle || !safeUrl || !safeType) {
    throw new Error("Faltan datos requeridos");
  }

  if (safeTitle.length > MAX_TITLE_LENGTH) {
    throw new Error("Título demasiado largo");
  }

  if (safeUrl.length > MAX_URL_LENGTH) {
    throw new Error("URL demasiado larga");
  }

  if (safeType.length > MAX_TYPE_LENGTH) {
    throw new Error("Tipo inválido");
  }

  if (!/^https?:\/\//i.test(safeUrl)) {
    throw new Error("URL inválida");
  }

  if (!ALLOWED_TYPES.has(safeType)) {
    throw new Error("Tipo inválido");
  }

  return {
    username: safeUsername,
    title: safeTitle,
    url: safeUrl,
    type: safeType
  };
}

function getUserOrThrow(username) {
  const safeUsername = sanitizeUsername(username);
  const user = readUser(safeUsername);

  if (!user) {
    const error = new Error("Usuario no existe");
    error.status = 404;
    throw error;
  }

  return { user, username: safeUsername };
}

router.post("/downloads/add", (req, res) => {
  try {
    const entry = validateEntry(req.body);

    const updatedUser = updateUser(entry.username, (user) => {
      if (!Array.isArray(user.downloads)) {
        user.downloads = [];
      }

      user.downloads.unshift({
        title: entry.title,
        url: entry.url,
        type: entry.type,
        date: new Date().toISOString()
      });

      user.downloads = user.downloads.slice(0, MAX_DOWNLOAD_ITEMS);
      return user;
    });

    return res.status(200).json({
      ok: true,
      downloads: Array.isArray(updatedUser.downloads) ? updatedUser.downloads : []
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      ok: false,
      error: error.message
    });
  }
});

router.get("/downloads/:username", (req, res) => {
  try {
    const { user } = getUserOrThrow(req.params.username);

    return res.status(200).json({
      ok: true,
      downloads: Array.isArray(user.downloads) ? user.downloads : []
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      ok: false,
      error: error.message
    });
  }
});

router.post("/history/add", (req, res) => {
  try {
    const entry = validateEntry(req.body);

    const updatedUser = updateUser(entry.username, (user) => {
      if (!Array.isArray(user.history)) {
        user.history = [];
      }

      user.history.unshift({
        title: entry.title,
        url: entry.url,
        type: entry.type,
        date: new Date().toISOString()
      });

      user.history = user.history.slice(0, MAX_HISTORY_ITEMS);
      return user;
    });

    return res.status(200).json({
      ok: true,
      history: Array.isArray(updatedUser.history) ? updatedUser.history : []
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      ok: false,
      error: error.message
    });
  }
});

router.get("/history/:username", (req, res) => {
  try {
    const { user } = getUserOrThrow(req.params.username);

    return res.status(200).json({
      ok: true,
      history: Array.isArray(user.history) ? user.history : []
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      ok: false,
      error: error.message
    });
  }
});

module.exports = router;