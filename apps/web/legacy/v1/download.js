const API = location.origin;

let currentVideo = null;

// ==============================
// CONTROLADOR GLOBAL DE ESTADO
// ==============================
let statusInterval = null;

function showStatus(messages) {
  const el = document.getElementById("videoLoading");
  if (!el) return () => {};

  let index = 0;

  el.classList.remove("hidden");
  el.textContent = messages[index];

  if (statusInterval) clearInterval(statusInterval);

  statusInterval = setInterval(() => {
    index = (index + 1) % messages.length;
    el.textContent = messages[index];
  }, 900);

  return () => {
    clearInterval(statusInterval);
    statusInterval = null;
    el.classList.add("hidden");
  };
}

// ==============================
// INIT
// ==============================
export function initDownload() {

  const downloadVideoBtn = document.getElementById("downloadVideoBtn");
  const downloadAudioBtn = document.getElementById("downloadAudioBtn");

  if (downloadVideoBtn) {
    downloadVideoBtn.addEventListener("click", downloadVideo);
  }

  if (downloadAudioBtn) {
    downloadAudioBtn.addEventListener("click", downloadAudio);
  }

  document.addEventListener("videoChanged", (e) => {
    const video = e.detail;
    if (!video || !video.url) {
      currentVideo = null;
      return;
    }
    currentVideo = video;
  });
}

// ==============================
// DESCARGAR VIDEO
// ==============================
async function downloadVideo() {
  if (!currentVideo) return;

  const stopStatus = showStatus([
    "Descargando video...",
    "Espere...",
    "Procesando archivo..."
  ]);

  try {
    const response = await fetch(
      `${API}/download/video?url=${encodeURIComponent(currentVideo.url)}`
    );

    if (!response.ok) throw new Error("Error descargando video");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentVideo.title}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);

  } catch (err) {
    console.error(err);
  } finally {
    stopStatus();
  }
}

// ==============================
// DESCARGAR AUDIO
// ==============================
async function downloadAudio() {
  if (!currentVideo) return;

  const stopStatus = showStatus([
    "Descargando audio...",
    "Espere...",
    "Procesando archivo..."
  ]);

  try {
    const response = await fetch(`${API}/download/audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentVideo.url }),
    });

    if (!response.ok) throw new Error("Error descargando audio");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentVideo.title}.mp3`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);

  } catch (err) {
    console.error(err);
  } finally {
    stopStatus();
  }
}