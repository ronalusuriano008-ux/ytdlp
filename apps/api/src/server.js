const os = require("os");
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const fs = require("fs");
const gradient = require("gradient-string");

require("dotenv").config();

function getLocalIP() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }

  return "127.0.0.1";
}

const text = `YT Music Downloader`;

const search = require("./routes/search.routes");
const metadata = require("./routes/metadata.routes");
const download = require("./routes/download.routes");
const stream = require("./routes/stream.routes");
const auth = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const ws = require("./websocket/progress.gateway");

const app = express();

// ===== Config base =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: "audio/wav", limit: "10mb" }));

// ===== Logger global =====
app.use((req, res, next) => {
  const start = Date.now();

  console.log("\n📥 ===== NUEVA PETICIÓN =====");
  console.log("Método:", req.method);
  console.log("Ruta:", req.originalUrl);
  console.log("IP:", req.ip);
  console.log("User-Agent:", req.headers["user-agent"]);
/*
  console.log("Headers:");
  console.log(req.headers);
*/
  if (Object.keys(req.query || {}).length > 0) {
    console.log("Query Params:");
    console.log(req.query);
  }

  if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
    console.log("Body:");
    console.log(req.body);
  }

  res.on("finish", () => {
    const duration = Date.now() - start;

    console.log("\n📤 ===== RESPUESTA =====");
    console.log("Status:", res.statusCode);
    console.log("Tiempo:", duration + " ms");
    console.log("========================\n");
  });

  next();
});

// ===== Rutas del proyecto =====
const WEB_PUBLIC = path.join(__dirname, "../../web/public");
const WEB_ASSETS = path.join(__dirname, "../../web/assets");
const WEB_SRC = path.join(__dirname, "../../web/src");
const WEB_LEGACY = path.join(__dirname, "../../web/legacy");

const WORKER_AUDIO = path.join(__dirname, "../../worker/storage/audio");
const WORKER_VIDEOS = path.join(__dirname, "../../worker/storage/videos");

// ===== Archivos estáticos =====
app.use(express.static(WEB_PUBLIC));
app.use("/assets", express.static(WEB_ASSETS));
app.use("/src", express.static(WEB_SRC));
app.use("/legacy", express.static(WEB_LEGACY));

// ===== API =====
app.use("/auth", auth);
app.use("/user", userRoutes);
app.use("/search", search);
app.use("/metadata", metadata);
app.use("/download", download);
app.use("/stream", stream);

// ===== Ruta principal =====
app.get("/", (req, res) => {
  console.log("🖥 Usuario cargó el frontend desde:", req.ip);
  res.sendFile(path.join(WEB_PUBLIC, "index.html"));
});

const server = http.createServer(app);

// ===== Eventos del servidor =====
server.on("connection", (socket) => {
  console.log("\n🔌 ===== CONEXIÓN TCP =====");
  console.log("Cliente:", socket.remoteAddress);

  socket.on("close", () => {
    console.log("❌ Conexión TCP cerrada:", socket.remoteAddress);
  });
});

server.on("error", (err) => {
  console.error("🚨 Error en servidor HTTP:", err);
});

// ===== WebSocket =====
ws.init(server);
console.log("📡 WebSocket inicializado");

// ===== Arranque =====
server.listen(3000, "0.0.0.0", () => {
  const localIP = getLocalIP();

  console.log(gradient.pastel.multiline(text));
  console.log(gradient.instagram("Servidor listo en la red local"));
  console.log(`👉 http://${localIP}:3000`);
});

// ===== Monitoreo =====
setInterval(() => {
  const memory = process.memoryUsage();
  const usedMB = (memory.rss / 1024 / 1024).toFixed(2);
  const cpu = os.loadavg()[0].toFixed(2);

  console.log("\n📊 ===== MONITOR SERVIDOR =====");
  console.log("Memoria usada:", usedMB + " MB");
  console.log("CPU load:", cpu);
  console.log("PID:", process.pid);
  console.log("================================\n");
}, 30000);

setInterval(() => {
  try {
    const audioFiles = fs.existsSync(WORKER_AUDIO)
      ? fs.readdirSync(WORKER_AUDIO).length
      : 0;

    const videoFiles = fs.existsSync(WORKER_VIDEOS)
      ? fs.readdirSync(WORKER_VIDEOS).length
      : 0;

    console.log("📁 Archivos audio:", audioFiles);
    console.log("📁 Archivos video:", videoFiles);
  } catch (err) {
    console.log("⚠ No se pudo leer storage:", err.message);
  }
}, 60000);

// ===== Manejo de cierre y errores =====
process.on("SIGINT", () => {
  console.log("\n🛑 Servidor detenido manualmente (CTRL+C)");
  process.exit();
});

process.on("SIGTERM", () => {
  console.log("🛑 Señal SIGTERM recibida");
  process.exit();
});

process.on("uncaughtException", (err) => {
  console.error("🚨 Excepción no capturada:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🚨 Rechazo de promesa no manejado:", err);
});