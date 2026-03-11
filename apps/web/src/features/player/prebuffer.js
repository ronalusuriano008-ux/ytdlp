import { API, state } from "./config.js";

export async function prebufferNextVideo() {
  if (
    !Array.isArray(state.videoList) ||
    state.videoList.length === 0 ||
    !state.preloadPlayer
  ) {
    return false;
  }

  if (state.isPrebuffering || state.isPrebuffered) {
    return false;
  }

  const totalVideos = state.videoList.length;
  const nextIndex = (state.currentIndex + 1) % totalVideos;
  const nextVideo = state.videoList[nextIndex];

  if (!nextVideo?.url) {
    return false;
  }

  state.isPrebuffering = true;

  const prebufferId = (state.currentPrebufferId || 0) + 1;
  state.currentPrebufferId = prebufferId;

  if (state.prebufferController) {
    try {
      state.prebufferController.abort();
    } catch (error) {
      console.warn("No se pudo abortar el prebuffer anterior:", error);
    }
  }

  state.prebufferController = new AbortController();
  const { signal } = state.prebufferController;

  const isStale = () => state.currentPrebufferId !== prebufferId;

  const resetPreloadPlayer = () => {
    try {
      state.preloadPlayer.pause();
      state.preloadPlayer.removeAttribute("src");
      state.preloadPlayer.load();
    } catch (error) {
      console.warn("No se pudo limpiar preloadPlayer:", error);
    }
  };

  try {
    const response = await fetch(
      `${API}/stream?url=${encodeURIComponent(nextVideo.url)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        signal
      }
    );

    if (isStale()) {
      return false;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} al solicitar prebuffer`);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("La respuesta del servidor no es JSON válido");
    }

    if (isStale()) {
      return false;
    }

    if (!data?.directUrl || typeof data.directUrl !== "string" || !data.directUrl.trim()) {
      throw new Error("El servidor no devolvió una directUrl válida para prebuffer");
    }

    resetPreloadPlayer();

    state.preloadPlayer.src = data.directUrl;
    state.preloadPlayer.preload = "auto";
    state.preloadPlayer.load();

    if (isStale()) {
      resetPreloadPlayer();
      return false;
    }

    state.prebufferedIndex = nextIndex;
    state.isPrebuffered = true;

    return true;
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("Error prebuffer:", err);
    }

    if (!isStale()) {
      state.isPrebuffered = false;
      state.prebufferedIndex = null;
      resetPreloadPlayer();
    }

    return false;
  } finally {
    if (!isStale()) {
      state.isPrebuffering = false;
    }
  }
}