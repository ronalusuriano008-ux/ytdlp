#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".html",
  ".css",
  ".py",
  ".md",
  ".txt"
]);

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".cache",
  "__pycache__"
]);

const renameMap = new Map([
  // ===== FRONTEND / WEB =====
  ["apps/web/public/index.html", "apps/web/public/index.html"],
  ["apps/web/public/musica.html", "apps/web/public/musica.html"],
  ["apps/web/public/perfil.html", "apps/web/public/perfil.html"],
  ["apps/web/public/historial.html", "apps/web/public/historial.html"],
  ["apps/web/public/favoritos.html", "apps/web/public/favoritos.html"],
  ["apps/web/public/descargas.html", "apps/web/public/descargas.html"],
  ["apps/web/public/favicon.png", "apps/web/public/favicon.png"],
  ["apps/web/assets/styles/main.css", "apps/web/assets/styles/main.css"],

  ["apps/web/src/core/auth/auth.js", "apps/web/src/core/auth/auth.js"],
  ["apps/web/src/core/auth/session.js", "apps/web/src/core/auth/session.js"],
  ["apps/web/src/core/storage/db.js", "apps/web/src/core/storage/db.js"],

  ["apps/web/src/app/main.js", "apps/web/src/app/main.js"],
  ["apps/web/src/features/search/search.js", "apps/web/src/features/search/search.js"],
  ["apps/web/src/features/voice/voice.js", "apps/web/src/features/voice/voice.js"],
  ["apps/web/src/features/websocket/websocket.js", "apps/web/src/features/websocket/websocket.js"],

  ["apps/web/src/features/player/config.js", "apps/web/src/features/player/config.js"],
  ["apps/web/src/features/player/loader.js", "apps/web/src/features/player/loader.js"],
  ["apps/web/src/features/player/player.js", "apps/web/src/features/player/player.js"],
  ["apps/web/src/features/player/prebuffer.js", "apps/web/src/features/player/prebuffer.js"],
  ["apps/web/src/features/player/playerUI.js", "apps/web/src/features/player/playerUI.js"],

  ["apps/web/src/features/download/download.js", "apps/web/src/features/download/download.js"],
  ["apps/web/src/features/download/downloadAudio.js", "apps/web/src/features/download/downloadAudio.js"],
  ["apps/web/src/features/download/downloadState.js", "apps/web/src/features/download/downloadState.js"],
  ["apps/web/src/features/download/downloadStatus.js", "apps/web/src/features/download/downloadStatus.js"],
  ["apps/web/src/features/download/downloadVideo.js", "apps/web/src/features/download/downloadVideo.js"],

  ["apps/web/src/features/downloads/downloadsPage.js", "apps/web/src/features/downloads/downloadsPage.js"],
  ["apps/web/legacy/musicPlayer.js", "apps/web/legacy/musicPlayer.js"],
  ["apps/web/legacy/download.js", "apps/web/legacy/download.js"],

  ["apps/web/legacy/v1/app.js", "apps/web/legacy/v1/app.js"],
  ["apps/web/legacy/v1/download.js", "apps/web/legacy/v1/download.js"],
  ["apps/web/legacy/v1/player.js", "apps/web/legacy/v1/player.js"],

  // ===== API =====
  ["apps/api/src/server.js", "apps/api/src/server.js"],
  ["apps/api/src/routes/search.routes.js", "apps/api/src/routes/search.routes.js"],
  ["apps/api/src/routes/metadata.routes.js", "apps/api/src/routes/metadata.routes.js"],
  ["apps/api/src/routes/stream.routes.js", "apps/api/src/routes/stream.routes.js"],
  ["apps/api/src/routes/download.routes.js", "apps/api/src/routes/download.routes.js"],
  ["apps/api/src/services/pythonClient.js", "apps/api/src/services/pythonClient.js"],
  ["apps/api/src/services/queue.js", "apps/api/src/services/queue.js"],
  ["apps/api/src/websocket/progress.gateway.js", "apps/api/src/websocket/progress.gateway.js"],
  ["apps/api/storage/uploads", "apps/api/storage/uploads"],
  ["apps/api/src/services/download.legacy.js", "apps/api/src/services/download.legacy.js"],

  // ===== WORKER =====
  ["apps/worker/src/main.py", "apps/worker/src/main.py"],
  ["apps/worker/src/downloader/ffmpeg_runner.py", "apps/worker/src/downloader/ffmpeg_runner.py"],
  ["apps/worker/src/downloader/metadata.py", "apps/worker/src/downloader/metadata.py"],
  ["apps/worker/src/downloader/ytdlp_runner.py", "apps/worker/src/downloader/ytdlp_runner.py"],
  ["apps/worker/src/downloader/cookies.txt", "apps/worker/src/downloader/cookies.txt"],
  ["apps/worker/src/models/job.py", "apps/worker/src/models/job.py"],
  ["apps/worker/static/favicon.png", "apps/worker/static/favicon.png"],
  ["apps/worker/storage/audio", "apps/worker/storage/audio"],
  ["apps/worker/storage/videos", "apps/worker/storage/videos"],
  ["apps/worker/requirements.txt", "apps/worker/requirements.txt"],
  ["apps/worker/cookies.txt", "apps/worker/cookies.txt"]
]);

const report = {
  filesScanned: 0,
  filesChanged: 0,
  replacements: []
};

function normalizeToPosix(p) {
  return p.replace(/\\/g, "/");
}

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full, out);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (TEXT_EXTENSIONS.has(ext)) {
        out.push(full);
      }
    }
  }

  return out;
}

function safeRead(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function safeWrite(file, content) {
  fs.writeFileSync(file, content, "utf8");
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function relativeImport(fromFile, toFile) {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, toFile);
  rel = normalizeToPosix(rel);
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function replaceAllTracked(content, regex, replacer, file, label) {
  let changed = false;
  const next = content.replace(regex, (...args) => {
    changed = true;
    return typeof replacer === "function" ? replacer(...args) : replacer;
  });

  if (changed) {
    report.replacements.push({
      file: normalizeToPosix(path.relative(ROOT, file)),
      label
    });
  }

  return { content: next, changed };
}

function fixOldAbsoluteLikeRefs(content, file) {
  let changedAny = false;

  for (const [oldRel, newRel] of renameMap.entries()) {
    const oldEsc = escapeRegExp(oldRel);

    // Reemplaza referencias textuales exactas tipo "frontend/..." o 'frontend/...'
    const res1 = replaceAllTracked(
      content,
      new RegExp(oldEsc, "g"),
      newRel,
      file,
      `texto: ${oldRel} -> ${newRel}`
    );
    content = res1.content;
    changedAny = changedAny || res1.changed;
  }

  return { content, changed: changedAny };
}

function fixJsImports(content, file) {
  const relFile = normalizeToPosix(path.relative(ROOT, file));
  let changedAny = false;

  const importRegex =
    /((?:import|export)\s+(?:[^'"]*?\s+from\s+)?|require\()\s*(['"])([^'"]+)(\2\)?)/g;

  content = content.replace(importRegex, (full, prefix, quote, spec, suffix) => {
    if (
      !spec.startsWith(".") &&
      !spec.startsWith("/") &&
      !spec.includes("frontend/") &&
      !spec.includes("node-api/") &&
      !spec.includes("python-worker/")
    ) {
      return full;
    }

    let changed = false;
    let nextSpec = spec;

    const specPosix = normalizeToPosix(spec);

    // Caso 1: referencia directa vieja exacta
    for (const [oldRel, newRel] of renameMap.entries()) {
      if (specPosix === oldRel || specPosix.endsWith("/" + oldRel)) {
        nextSpec = relativeImport(file, path.join(ROOT, newRel));
        changed = true;
        break;
      }
    }

    // Caso 2: imports relativos viejos comunes por nombre
    if (!changed && relFile === "apps/web/src/app/main.js") {
      const map = {
        "./search.js": "../features/search/search.js",
        "./voice.js": "../features/voice/voice.js",
        "./websocket.js": "../features/websocket/websocket.js",
        "./download/download.js": "../features/download/download.js",
        "./player/player.js": "../features/player/player.js",
        "./session.js": "../core/auth/session.js",
        "./downloads.js": "../features/downloads/downloadsPage.js"
      };
      if (map[specPosix]) {
        nextSpec = map[specPosix];
        changed = true;
      }
    }

    // Casos internos del player
    if (!changed && relFile.startsWith("apps/web/src/features/player/")) {
      const map = {
        "./ui.js": "./playerUI.js"
      };
      if (map[specPosix]) {
        nextSpec = map[specPosix];
        changed = true;
      }
    }

    // Caso server.js movido a apps/api/src/
    if (!changed && relFile === "apps/api/src/server.js") {
      const map = {
        "./routes/search": "./routes/search.routes",
        "./routes/search.js": "./routes/search.routes.js",
        "./routes/metadata": "./routes/metadata.routes",
        "./routes/metadata.js": "./routes/metadata.routes.js",
        "./routes/stream": "./routes/stream.routes",
        "./routes/stream.js": "./routes/stream.routes.js",
        "./routes/download": "./routes/download.routes",
        "./routes/download.js": "./routes/download.routes.js",
        "./services/pythonClient": "./services/pythonClient",
        "./services/pythonClient.js": "./services/pythonClient.js",
        "./services/queue": "./services/queue",
        "./services/queue.js": "./services/queue.js",
        "./websocket/progress": "./websocket/progress.gateway",
        "./websocket/progress.js": "./websocket/progress.gateway.js",
        "./uploads": "../storage/uploads",
        "apps/api/storage/uploads": "../storage/uploads"
      };
      if (map[specPosix]) {
        nextSpec = map[specPosix];
        changed = true;
      }
    }

    // Caso routes de api
    if (!changed && relFile.startsWith("apps/api/src/routes/")) {
      const map = {
        "../services/pythonClient": "../services/pythonClient",
        "../services/pythonClient.js": "../services/pythonClient.js",
        "../services/queue": "../services/queue",
        "../services/queue.js": "../services/queue.js"
      };
      if (map[specPosix]) {
        nextSpec = map[specPosix];
        changed = true;
      }
    }

    if (changed) {
      report.replacements.push({
        file: relFile,
        label: `import: ${spec} -> ${nextSpec}`
      });
      changedAny = true;
      return `${prefix}${quote}${nextSpec}${suffix}`;
    }

    return full;
  });

  return { content, changed: changedAny };
}

function fixHtmlRefs(content, file) {
  const relFile = normalizeToPosix(path.relative(ROOT, file));
  let changedAny = false;

  // Si es una página pública, corrige recursos típicos
  if (relFile.startsWith("apps/web/public/")) {
    const replacements = [
      [/href=["']styles\.css["']/g, 'href="../assets/styles/main.css"'],
      [/src=["']js\/main\.js["']/g, 'src="../src/app/main.js"'],
      [/src=["']musicPlayer\.js["']/g, 'src="../legacy/musicPlayer.js"'],
      [/src=["']download\.js["']/g, 'src="../legacy/download.js"'],

      [/src=["']auth\.js["']/g, 'src="../src/core/auth/auth.js"'],
      [/src=["']session\.js["']/g, 'src="../src/core/auth/session.js"'],
      [/src=["']db\.js["']/g, 'src="../src/core/storage/db.js"'],

      [/href=["']favicon\.png["']/g, 'href="./favicon.png"'],
      [/src=["']favicon\.png["']/g, 'src="./favicon.png"']
    ];

    for (const [regex, replacement] of replacements) {
      const before = content;
      content = content.replace(regex, replacement);
      if (content !== before) {
        changedAny = true;
        report.replacements.push({
          file: relFile,
          label: `html: ${regex} -> ${replacement}`
        });
      }
    }
  }

  return { content, changed: changedAny };
}

function fixNodePaths(content, file) {
  const relFile = normalizeToPosix(path.relative(ROOT, file));
  let changedAny = false;

  if (relFile.startsWith("apps/api/")) {
    const replacements = [
      [/node-api\/uploads/g, "apps/api/storage/uploads"],
      [/["'`]uploads["'`]/g, '"../storage/uploads"'],
      [/["'`]\.\/uploads["'`]/g, '"../storage/uploads"'],
      [/["'`]frontend["'`]/g, '"../../web/public"'],
      [/["'`]..\/frontend["'`]/g, '"../../web/public"'],
      [/["'`]frontend\/styles\.css["'`]/g, '"../../web/assets/styles/main.css"']
    ];

    for (const [regex, replacement] of replacements) {
      const before = content;
      content = content.replace(regex, replacement);
      if (content !== before) {
        changedAny = true;
        report.replacements.push({
          file: relFile,
          label: `node-path: ${regex} -> ${replacement}`
        });
      }
    }
  }

  return { content, changed: changedAny };
}

function fixPythonPaths(content, file) {
  const relFile = normalizeToPosix(path.relative(ROOT, file));
  let changedAny = false;

  if (relFile.startsWith("apps/worker/")) {
    const replacements = [
      [/python-worker\/storage\/audio/g, "apps/worker/storage/audio"],
      [/python-worker\/storage\/videos/g, "apps/worker/storage/videos"],
      [/["'`]storage\/audio["'`]/g, '"../storage/audio"'],
      [/["'`]storage\/videos["'`]/g, '"../storage/videos"'],
      [/["'`]cookies\.txt["'`]/g, '"../cookies.txt"'],
      [/["'`]downloader\/cookies\.txt["'`]/g, '"./downloader/cookies.txt"'],
      [/requeriments\.txt/g, "requirements.txt"]
    ];

    for (const [regex, replacement] of replacements) {
      const before = content;
      content = content.replace(regex, replacement);
      if (content !== before) {
        changedAny = true;
        report.replacements.push({
          file: relFile,
          label: `python-path: ${regex} -> ${replacement}`
        });
      }
    }
  }

  return { content, changed: changedAny };
}

function fixExpressStatic(content, file) {
  const relFile = normalizeToPosix(path.relative(ROOT, file));
  if (relFile !== "apps/api/src/server.js") {
    return { content, changed: false };
  }

  let changedAny = false;

  const replacements = [
    [
      /express\.static\(([^)]*?)frontend([^)]*?)\)/g,
      'express.static(path.join(__dirname, "../../web/public"))'
    ]
  ];

  for (const [regex, replacement] of replacements) {
    const before = content;
    content = content.replace(regex, replacement);
    if (content !== before) {
      changedAny = true;
      report.replacements.push({
        file: relFile,
        label: `express-static: ${regex} -> ${replacement}`
      });
    }
  }

  // si falta require('path'), lo agrega arriba
  if (
    content.includes("express.static(path.join(") &&
    !content.match(/const\s+path\s*=\s*require\(["']path["']\)/)
  ) {
    content = `const path = require("path");\n` + content;
    changedAny = true;
    report.replacements.push({
      file: relFile,
      label: `agregado require("path")`
    });
  }

  return { content, changed: changedAny };
}

function processFile(file) {
  let content = safeRead(file);
  if (content === null) return;

  report.filesScanned += 1;
  let original = content;

  ({ content } = fixOldAbsoluteLikeRefs(content, file));
  ({ content } = fixJsImports(content, file));
  ({ content } = fixHtmlRefs(content, file));
  ({ content } = fixNodePaths(content, file));
  ({ content } = fixPythonPaths(content, file));
  ({ content } = fixExpressStatic(content, file));

  if (content !== original) {
    safeWrite(file, content);
    report.filesChanged += 1;
    console.log(`✔ Corregido: ${normalizeToPosix(path.relative(ROOT, file))}`);
  }
}

function writeReport() {
  const out = {
    resumen: {
      filesScanned: report.filesScanned,
      filesChanged: report.filesChanged,
      totalReplacements: report.replacements.length
    },
    cambios: report.replacements
  };

  const reportPath = path.join(ROOT, "scripts", "fix-paths-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(out, null, 2), "utf8");

  console.log("\n===== REPORTE =====");
  console.log(`Archivos revisados: ${report.filesScanned}`);
  console.log(`Archivos corregidos: ${report.filesChanged}`);
  console.log(`Cambios detectados: ${report.replacements.length}`);
  console.log(`Reporte: ${normalizeToPosix(path.relative(ROOT, reportPath))}`);
}

function main() {
  console.log("Iniciando reparación de rutas e imports...\n");

  const files = walk(ROOT);

  for (const file of files) {
    processFile(file);
  }

  writeReport();

  console.log("\nFinalizado.");
  console.log("Ahora revisa especialmente:");
  console.log("- apps/web/public/*.html");
  console.log("- apps/web/src/app/main.js");
  console.log("- apps/api/src/server.js");
  console.log("- apps/worker/src/main.py");
}

main();