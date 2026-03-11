import { API, state } from "./config.js";
import { showStatus, updateVideoUI } from "./playerUI.js";

export async function loadVideo(player, downloadContainer, videoCard) {
  const requestId = ++state.currentRequestId;
  const video = state.videoList?.[state.currentIndex];

  if (!player || !video) {
    console.warn("loadVideo: player o video no disponible");
    return false;
  }

  const mainTitle = document.getElementById("videoMainTitle");
  const subTitle = document.getElementById("videoSubTitle");

  if (videoCard) videoCard.style.display = "block";
  if (mainTitle) mainTitle.textContent = video.title || "Sin título";
  if (subTitle) subTitle.textContent = video.uploader || "Desconocido";

  document.title = `${video.title || "Video"} - Mi Player`;

  if (downloadContainer) {
    downloadContainer.classList.add("hidden");
  }

  state.isPrebuffered = false;

  const stopStatus = showStatus([
    "Cargando video...",
    "Conectando...",
    "Preparando reproducción...",
    "Espere..."
  ]);

  let settled = false;

  const cleanup = () => {
    player.removeEventListener("playing", handlePlaying);
    player.removeEventListener("error", handlePlayerError);
    player.removeEventListener("loadeddata", handleLoadedData);
  };

  const finishSafely = () => {
    if (settled) return;
    settled = true;
    cleanup();
    stopStatus();
  };

  const isStaleRequest = () => requestId !== state.currentRequestId;

  const handleLoadedData = () => {
    if (isStaleRequest()) return;
  };

  const handlePlaying = () => {
    if (isStaleRequest()) return;

    finishSafely();

    if (downloadContainer) {
      downloadContainer.classList.remove("hidden");
    }

    updateVideoUI(video);
  };

  const handlePlayerError = () => {
    if (isStaleRequest()) return;

    console.error("Error del reproductor al intentar reproducir el video");
    finishSafely();
  };

  player.addEventListener("loadeddata", handleLoadedData);
  player.addEventListener("playing", handlePlaying);
  player.addEventListener("error", handlePlayerError);

  try {
    const response = await fetch(
      `${API}/stream?url=${encodeURIComponent(video.url)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (isStaleRequest()) {
      finishSafely();
      return false;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} al solicitar /stream`);
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error("La respuesta del servidor no es JSON válido");
    }

    if (isStaleRequest()) {
      finishSafely();
      return false;
    }

    if (!data || typeof data.directUrl !== "string" || !data.directUrl.trim()) {
      throw new Error("El servidor no devolvió una directUrl válida");
    }

    player.pause();
    player.src = data.directUrl;
    player.preload = "auto";
    player.load();

    return true;
  } catch (err) {
    if (!isStaleRequest()) {
      console.error("Error cargando video:", err);
      finishSafely();
    }
    return false;
  }
}
