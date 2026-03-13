const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const USERS_DIR = path.join(__dirname, "../../../../data/users");

function ensureUsersDir() {
  if (!fs.existsSync(USERS_DIR)) {
    fs.mkdirSync(USERS_DIR, { recursive: true });
  }
}

function sanitizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function getUserFilePath(username) {
  const safeUsername = sanitizeUsername(username);

  if (!safeUsername) {
    throw new Error("Nombre de usuario inválido");
  }

  return path.join(USERS_DIR, `${safeUsername}.json`);
}

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(String(password))
    .digest("hex");
}

function toPublicUser(user) {
  if (!user) return null;

  const { password, ...safeUser } = user;
  return safeUser;
}

function userExists(username) {
  ensureUsersDir();
  const filePath = getUserFilePath(username);
  return fs.existsSync(filePath);
}

function readUser(username) {
  ensureUsersDir();
  const filePath = getUserFilePath(username);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`No se pudo leer el usuario: ${sanitizeUsername(username)}`);
  }
}

function writeUser(username, data) {
  ensureUsersDir();
  const filePath = getUserFilePath(username);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Datos de usuario inválidos");
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  return data;
}

function createUser(username, password) {
  ensureUsersDir();

  const safeUsername = sanitizeUsername(username);

  if (!safeUsername) {
    throw new Error("Nombre de usuario inválido");
  }

  if (!password || String(password).trim().length < 1) {
    throw new Error("Contraseña inválida");
  }

  if (userExists(safeUsername)) {
    throw new Error("El usuario ya existe");
  }

  const now = new Date().toISOString();

  const userData = {
    username: safeUsername,
    password: hashPassword(password),
    role: "user",
    history: [],
    favorites: [],
    downloads: [],
    createdAt: now,
    updatedAt: now
  };

  writeUser(safeUsername, userData);
  return toPublicUser(userData);
}

function validateUser(username, password) {
  const user = readUser(username);

  if (!user) {
    throw new Error("Usuario no existe");
  }

  const hashedPassword = hashPassword(password);

  if (user.password !== hashedPassword) {
    throw new Error("Contraseña incorrecta");
  }

  return toPublicUser(user);
}

function updateUser(username, updater) {
  const user = readUser(username);

  if (!user) {
    throw new Error("Usuario no existe");
  }

  if (typeof updater !== "function") {
    throw new Error("Updater inválido");
  }

  const updatedUser = updater({ ...user });

  if (!updatedUser || typeof updatedUser !== "object" || Array.isArray(updatedUser)) {
    throw new Error("El updater devolvió un usuario inválido");
  }

  updatedUser.username = sanitizeUsername(updatedUser.username || user.username);
  updatedUser.updatedAt = new Date().toISOString();

  if (!updatedUser.username) {
    throw new Error("Nombre de usuario inválido");
  }

  if (!updatedUser.password) {
    updatedUser.password = user.password;
  }

  writeUser(username, updatedUser);
  return toPublicUser(updatedUser);
}

module.exports = {
  sanitizeUsername,
  getUserFilePath,
  userExists,
  readUser,
  writeUser,
  createUser,
  validateUser,
  updateUser,
  toPublicUser
};