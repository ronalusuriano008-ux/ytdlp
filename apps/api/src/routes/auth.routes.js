const express = require("express");
const router = express.Router();

const {
  createUser,
  validateUser
} = require("../services/userFileService");

router.post("/register", (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        error: "Faltan username o password"
      });
    }

    const user = createUser(username, password);
    return res.status(201).json({
      ok: true,
      message: "Usuario registrado correctamente",
      user: {
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

router.post("/login", (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        error: "Faltan username o password"
      });
    }

    const user = validateUser(username, password);

    return res.status(200).json({
      ok: true,
      message: "Login correcto",
      user: {
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

module.exports = router;