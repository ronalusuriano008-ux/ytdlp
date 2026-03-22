# 🎬 YTDLP Web App

![Node](https://img.shields.io/badge/node-%3E=18-green)
![Python](https://img.shields.io/badge/python-%3E=3.10-blue)
![yt-dlp](https://img.shields.io/badge/engine-yt--dlp-red)
![ffmpeg](https://img.shields.io/badge/media-ffmpeg-black)
![License](https://img.shields.io/badge/license-MIT-yellow)
![Status](https://img.shields.io/badge/status-active-success)
![Architecture](https://img.shields.io/badge/architecture-monorepo-purple)

Aplicación web moderna para **buscar, reproducir y descargar videos o música** usando **yt-dlp** como motor principal, con una interfaz visual simple e intuitiva.

Permite **previsualizar contenido antes de descargar**, algo que normalmente no es cómodo desde la terminal.

---

# ✨ Características

* 🔎 Búsqueda integrada
* ▶️ Reproducción previa antes de descargar
* 🎵 Descarga en audio o video
* ⚡ Motor basado en **yt-dlp**
* 🎯 Interfaz amigable
* 📦 Arquitectura modular escalable
* 🔌 API independiente (Node.js)
* 🐍 Worker Python dedicado
* 📁 Persistencia temporal en JSON
* 🌐 Preparado para VPS

---

# 🧠 Motivación del proyecto

**yt-dlp es extremadamente potente**, pero trabajar desde terminal:

* no permite previsualizar fácilmente
* requiere comandos manuales
* no es amigable para usuarios nuevos
* no ofrece experiencia visual

Este proyecto crea una **capa web moderna sobre yt-dlp** manteniendo su potencia pero mejorando la experiencia del usuario.

---

# 🏗️ Arquitectura

Proyecto organizado como **monorepo modular**

```
apps/
 ├── web
 ├── api
 └── worker

packages/
 └── shared

data/
```

### Flujo interno

```
Frontend → API (Node.js) → Worker (Python) → yt-dlp + ffmpeg
```

Esto permite:

* separación clara de responsabilidades
* mantenimiento sencillo
* despliegue independiente
* escalabilidad futura

---

# 🧰 Tecnologías utilizadas

## Frontend

* HTML
* CSS
* JavaScript modular

## Backend

* Node.js
* Express
* WebSockets

## Worker

* Python
* yt-dlp
* ffmpeg

---

# 🚀 Funcionalidades principales

## 🔎 Búsqueda

Permite buscar contenido directamente desde la interfaz web

```
/search?q=query
```

---

## ▶️ Streaming previo

Reproducción antes de descargar

```
/stream
```

---

## ⬇️ Descarga

Descarga en:

* audio
* video
* múltiples calidades
* con metadata

```
/download
```

---

## 📊 Metadata

Obtiene información antes de descargar

```
/metadata
```

---

# 📂 Estructura del proyecto

## apps/web

Frontend:

* reproductor integrado
* resultados dinámicos
* historial
* descargas

---

## apps/api

Servidor Express:

* rutas REST
* comunicación con worker
* WebSockets
* control de descargas

---

## apps/worker

Procesamiento multimedia:

* ejecución de yt-dlp
* extracción metadata
* conversión con ffmpeg
* streaming

---

## packages/shared

Comparte:

* constantes
* esquemas
* validaciones

entre servicios

---

# ⚙️ Requisitos

Instalar previamente:

```
Node.js >= 18
Python >= 3.10
yt-dlp
ffmpeg
```

---

# 🧪 Ejecutar en desarrollo

## API

```
cd apps/api
npm install
npm start
```

---

## Worker

```
cd apps/worker
pip install -r requirements.txt
python main.py
```

---

## Frontend

Abrir:

```
apps/web/public/index.html
```

o servir con:

```
npm run dev
```

(según configuración)

---

# 🌍 Deploy en producción

Compatible con:

```
Frontend → Nginx
API → Node.js
Worker → Python service
```

También funciona con:

* VPS Linux
* Docker
* Cloudflare Tunnel
* Ngrok

---

# 🎯 Objetivo del proyecto

Crear una interfaz moderna para usar **yt-dlp desde el navegador**, permitiendo:

* previsualizar contenido antes de descargar
* simplificar la experiencia
* automatizar procesos
* facilitar integración futura

---

# 📌 Roadmap

Futuras mejoras:

* sistema de usuarios
* historial persistente
* playlists
* cola de descargas
* modo móvil optimizado
* soporte multi-plataforma ampliado

---

# 🤝 Contribuciones

Contribuciones bienvenidas

```
fork → branch → commit → pull request
```

---

# ⭐ Créditos

Motor principal

```
yt-dlp
```

Procesamiento multimedia

```
ffmpeg
```

Interfaz web desarrollada como capa visual sobre estas herramientas.
