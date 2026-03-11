import { state } from "./config.js";

export function showStatus(messages = []) {
  const el = document.getElementById("videoLoading");

  if (!el) return () => {};

  const safeMessages = Array.isArray(messages) && messages.length
    ? messages.map(msg => String(msg ?? "").trim()).filter(Boolean)
    : ["Cargando..."];

  let index = 0;
  const statusToken = Symbol("statusToken");

  state.statusToken = statusToken;

  if (state.statusInterval) {
    clearInterval(state.statusInterval);
    state.statusInterval = null;
  }

  el.classList.remove("hidden");
  el.textContent = safeMessages[index];

  if (safeMessages.length > 1) {
    state.statusInterval = setInterval(() => {
      if (state.statusToken !== statusToken) return;

      index = (index + 1) % safeMessages.length;
      el.textContent = safeMessages[index];
    }, 900);
  }

  return () => {
    if (state.statusToken !== statusToken) return;

    if (state.statusInterval) {
      clearInterval(state.statusInterval);
      state.statusInterval = null;
    }

    state.statusToken = null;
    el.classList.add("hidden");
    el.textContent = "";
  };
}

export function updateVideoUI(video) {
  if (!video || typeof video !== "object") {
    console.warn("updateVideoUI: video inválido");
    return;
  }

  const mainTitle = document.getElementById("videoMainTitle");
  const subTitle = document.getElementById("videoSubTitle");

  const title = String(video.title ?? "Sin título");
  const uploader = String(video.uploader ?? "Desconocido");

  if (mainTitle) mainTitle.textContent = title;
  if (subTitle) subTitle.textContent = uploader;

  document.title = `${title} - Mi Player`;

  try {
    document.dispatchEvent(
      new CustomEvent("videoChanged", { detail: video })
    );
  } catch (error) {
    console.error("Error al emitir videoChanged:", error);
  }
}
/*import { state } from "./config.js";

export function showStatus(messages) {
  const el = document.getElementById("videoLoading");
  if (!el) return () => {};

  let index = 0;

  el.classList.remove("hidden");
  el.textContent = messages[index];

  if (state.statusInterval) clearInterval(state.statusInterval);

  state.statusInterval = setInterval(() => {
    index = (index + 1) % messages.length;
    el.textContent = messages[index];
  }, 900);

  return () => {
    clearInterval(state.statusInterval);
    state.statusInterval = null;
    el.classList.add("hidden");
  };
}

export function updateVideoUI(video) {
  const mainTitle = document.getElementById("videoMainTitle");
  const subTitle = document.getElementById("videoSubTitle");

  if (mainTitle) mainTitle.textContent = video.title;
  if (subTitle) subTitle.textContent = video.uploader;

  document.title = `${video.title} - Mi Player`;

  document.dispatchEvent(
    new CustomEvent("videoChanged", { detail: video })
  );
}*/