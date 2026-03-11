const fs = require("fs");
const path = require("path");

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

  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function writeUser(username, data) {
  ensureUsersDir();
  const filePath = getUserFilePath(username);

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
    password: String(password),
    role: "user",
    history: [],
    favorites: [],
    downloads: [],
    createdAt: now,
    updatedAt: now
  };

  writeUser(safeUsername, userData);
  return userData;
}

function validateUser(username, password) {
  const user = readUser(username);

  if (!user) {
    throw new Error("Usuario no existe");
  }

  if (user.password !== String(password)) {
    throw new Error("Contraseña incorrecta");
  }

  return user;
}

function updateUser(username, updater) {
  const user = readUser(username);

  if (!user) {
    throw new Error("Usuario no existe");
  }

  const updatedUser = updater({ ...user });
  updatedUser.updatedAt = new Date().toISOString();

  writeUser(username, updatedUser);
  return updatedUser;
}

module.exports = {
  sanitizeUsername,
  getUserFilePath,
  userExists,
  readUser,
  writeUser,
  createUser,
  validateUser,
  updateUser
};