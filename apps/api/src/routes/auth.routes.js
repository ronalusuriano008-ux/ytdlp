const express = require("express");
const router = express.Router();

const {
  createUser,
  validateUser,
  sanitizeUsername
} = require("../services/userFileService");

const MAX_USERNAME_LENGTH = 32;
const MAX_PASSWORD_LENGTH = 128;

function normalizeCredentials(body = {}) {
  const username = String(body.username || "").trim();
  const password = String(body.password || "").trim();

  return { username, password };
}

router.post("/register", (req, res) => {
  try {
    const { username, password } = normalizeCredentials(req.body);

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        error: "Faltan username o password"
      });
    }

    if (username.length > MAX_USERNAME_LENGTH) {
      return res.status(400).json({
        ok: false,
        error: "Username demasiado largo"
      });
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({
        ok: false,
        error: "Password demasiado largo"
      });
    }

    const sanitized = sanitizeUsername(username);

    if (!sanitized) {
      return res.status(400).json({
        ok: false,
        error: "Nombre de usuario inválido"
      });
    }

    const user = createUser(sanitized, password);

    return res.status(201).json({
      ok: true,
      message: "Usuario registrado correctamente",
      user: {
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    const message = String(error.message || "");

    if (message.includes("ya existe")) {
      return res.status(409).json({
        ok: false,
        error: message
      });
    }

    return res.status(400).json({
      ok: false,
      error: message || "No se pudo registrar el usuario"
    });
  }
});

router.post("/login", (req, res) => {
  try {
    const { username, password } = normalizeCredentials(req.body);

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        error: "Faltan username o password"
      });
    }

    if (username.length > MAX_USERNAME_LENGTH) {
      return res.status(400).json({
        ok: false,
        error: "Username demasiado largo"
      });
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({
        ok: false,
        error: "Password demasiado largo"
      });
    }

    const sanitized = sanitizeUsername(username);

    if (!sanitized) {
      return res.status(400).json({
        ok: false,
        error: "Nombre de usuario inválido"
      });
    }

    const user = validateUser(sanitized, password);

    return res.status(200).json({
      ok: true,
      message: "Login correcto",
      user: {
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    const message = String(error.message || "");

    if (
      message.includes("Contraseña incorrecta") ||
      message.includes("Usuario no existe")
    ) {
      return res.status(401).json({
        ok: false,
        error: "Credenciales inválidas"
      });
    }

    return res.status(400).json({
      ok: false,
      error: message || "No se pudo iniciar sesión"
    });
  }
});

module.exports = router;