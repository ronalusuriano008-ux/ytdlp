let currentBackground = "";
let preloadImage = null;

function getBackgroundEl() {
  return document.getElementById("appBackground");
}

function sanitizeUrl(url) {
  if (!url || typeof url !== "string") return "";
  return url.replace(/"/g, '\\"');
}

export function clearAppBackground() {
  const bg = getBackgroundEl();
  if (!bg) return;

  currentBackground = "";
  bg.style.backgroundImage = "";
  bg.style.opacity = "0";
}

export function setAppBackground(thumbnail) {
  const bg = getBackgroundEl();
  if (!bg) return;

  const cleanUrl = sanitizeUrl(thumbnail);
  if (!cleanUrl) {
    clearAppBackground();
    return;
  }

  if (cleanUrl === currentBackground) {
    return;
  }

  preloadImage = new Image();

  preloadImage.onload = () => {
    currentBackground = cleanUrl;
    bg.style.backgroundImage = `url("${cleanUrl}")`;
    bg.style.opacity = window.innerWidth <= 768 ? "0.38" : "0.45";
  };

  preloadImage.onerror = () => {
    if (!currentBackground) {
      bg.style.backgroundImage = "";
      bg.style.opacity = "0";
    }
  };

  preloadImage.src = cleanUrl;
}