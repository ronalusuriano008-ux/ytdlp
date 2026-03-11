const express = require("express");
const router = express.Router();
const { updateUser, readUser } = require("../services/userFileService");

router.post("/downloads/add", (req, res) => {
  try {
    const { username, title, url, type } = req.body || {};

    if (!username || !title || !url || !type) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos de descarga"
      });
    }

    const updatedUser = updateUser(username, (user) => {
      if (!Array.isArray(user.downloads)) {
        user.downloads = [];
      }

      user.downloads.push({
        title,
        url,
        type,
        date: Date.now()
      });

      return user;
    });

    return res.json({
      ok: true,
      downloads: updatedUser.downloads
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

router.get("/downloads/:username", (req, res) => {
  try {
    const { username } = req.params;
    const user = readUser(username);

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "Usuario no existe"
      });
    }

    return res.json({
      ok: true,
      downloads: Array.isArray(user.downloads) ? user.downloads : []
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});




router.post("/history/add", (req, res) => {
  try {
    const { username, title, url, type } = req.body || {};

    if (!username || !title || !url || !type) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos del historial"
      });
    }

    const updatedUser = updateUser(username, (user) => {
      if (!Array.isArray(user.history)) {
        user.history = [];
      }

      user.history.unshift({
        title,
        url,
        type,
        date: Date.now()
      });

      return user;
    });

    return res.json({
      ok: true,
      history: updatedUser.history
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

router.get("/history/:username", (req, res) => {
  try {
    const { username } = req.params;
    const user = readUser(username);

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "Usuario no existe"
      });
    }

    return res.json({
      ok: true,
      history: Array.isArray(user.history) ? user.history : []
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});
module.exports = router;