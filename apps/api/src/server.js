const os = require("os");
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const gradient = require("gradient-string");

require("dotenv").config();

const search = require("./routes/search.routes");
const metadata = require("./routes/metadata.routes");
const download = require("./routes/download.routes");
const stream = require("./routes/stream.routes");
const auth = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";
const isDev = NODE_ENV !== "production";

const WEB_PUBLIC = path.join(__dirname, "../../web/public");
const WEB_ASSETS = path.join(__dirname, "../../web/assets");
const WEB_SRC = path.join(__dirname, "../../web/src");

app.use("/src", express.static(WEB_SRC));

const API_TEMP = path.join(__dirname, "../storage/temp");
const API_UPLOADS = path.join(__dirname, "../storage/uploads");

const WORKER_AUDIO = path.join(__dirname, "../../worker/storage/audio");
const WORKER_VIDEOS = path.join(__dirname, "../../worker/storage/videos");
const WORKER_TEMP = path.join(__dirname, "../../worker/storage/temp");

function getLocalIP() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }

  return "127.0.0.1";
}

function ensureDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (error) {
    console.error(`No se pudo crear la carpeta: ${dirPath}`);
    console.error(error.message);
    process.exit(1);
  }
}

function bootstrapStorage() {
  [
    API_TEMP,
    API_UPLOADS,
    WORKER_AUDIO,
    WORKER_VIDEOS,
    WORKER_TEMP
  ].forEach(ensureDir);
}

bootstrapStorage();

// Middlewares base
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logger simple y seguro
app.use((req, res, next) => {
  const start = Date.now();

  if (isDev) {
    console.log(`[REQ] ${req.method} ${req.originalUrl} - ${req.ip}`);
  }

  res.on("finish", () => {
    const duration = Date.now() - start;

    if (isDev) {
      console.log(`[RES] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    }
  });

  next();
});

// Archivos estáticos
app.use(express.static(WEB_PUBLIC));
app.use("/assets", express.static(WEB_ASSETS));

// Rutas API
app.use("/auth", auth);
app.use("/user", userRoutes);
app.use("/search", search);
app.use("/metadata", metadata);
app.use("/download", download);
app.use("/stream", stream);

// Health check para despliegue
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "downloader-api",
    env: NODE_ENV,
    uptime: process.uptime()
  });
});

// Ruta principal
app.get("/", (req, res) => {
  res.sendFile(path.join(WEB_PUBLIC, "index.html"));
});

// 404
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Ruta no encontrada"
  });
});

// Error global
app.use((err, req, res, next) => {
  console.error("[ERROR]", err);

  res.status(err.status || 500).json({
    ok: false,
    error: err.message || "Error interno del servidor"
  });
});

app.listen(PORT, HOST, () => {
  const localIP = getLocalIP();

  console.log(gradient.pastel.multiline("YT Music Downloader API"));
  console.log(`Modo: ${NODE_ENV}`);
  console.log(`Servidor escuchando en ${HOST}:${PORT}`);

  if (isDev) {
    console.log(`Local: http://127.0.0.1:${PORT}`);
    console.log(`Red local: http://${localIP}:${PORT}`);
  }
});

// Cierre limpio
process.on("SIGINT", () => {
  console.log("\nServidor detenido manualmente");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Servidor detenido por SIGTERM");
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error("Excepción no capturada:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Promesa rechazada no manejada:", reason);
  process.exit(1);
});