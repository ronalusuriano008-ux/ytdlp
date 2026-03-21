import { addHistory } from "../history/history.js";
import { saveSearchQuery } from "./searchHistory.js";
import { renderSearchHistory } from "./searchHistoryPage.js";

const API = location.origin;

let dotsInterval = null;
let currentController = null;
let isSearching = false;

function getEl(id) {
  return document.getElementById(id);
}

function formatDuration(seconds = 0) {
  const total = Number(seconds);

  if (!Number.isFinite(total) || total < 0) {
    return "0:00";
  }

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = Math.floor(total % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function showSkeletons() {
  const container = getEl("results");
  if (!container) return;

  container.innerHTML = Array.from({ length: 9 }, () => `
    <div class="card skeleton-card" aria-hidden="true">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text short"></div>
    </div>
  `).join("");
}

function setStatus(html) {
  const status = getEl("searchStatus");
  if (!status) return;

  status.style.display = "block";
  status.innerHTML = html;
}

function hideStatus(delay = 0) {
  const status = getEl("searchStatus");
  if (!status) return;

  window.setTimeout(() => {
    status.style.display = "none";
  }, delay);
}

function startDotsAnimation() {
  const dots = getEl("dots");
  if (!dots) return;

  let count = 0;
  stopDotsAnimation();

  dotsInterval = window.setInterval(() => {
    count = (count + 1) % 4;
    dots.textContent = ".".repeat(count);
  }, 500);
}

function stopDotsAnimation() {
  if (dotsInterval) {
    clearInterval(dotsInterval);
    dotsInterval = null;
  }

  const dots = getEl("dots");
  if (dots) dots.textContent = "";
}

function setSearchButtonLoading(loading) {
  const searchBtn = getEl("searchBtn");
  if (!searchBtn) return;

  searchBtn.disabled = loading;
  searchBtn.setAttribute("aria-busy", String(loading));

  if (loading) {
    searchBtn.dataset.originalHtml = searchBtn.innerHTML;
    searchBtn.innerHTML = `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>`;
  } else if (searchBtn.dataset.originalHtml) {
    searchBtn.innerHTML = searchBtn.dataset.originalHtml;
    delete searchBtn.dataset.originalHtml;
  }
}

function showLoadingStatus() {
  setStatus(`
    <i class="fas fa-spinner fa-spin" style="margin-right:8px; font-size:1.5em;" aria-hidden="true"></i>
    <span style="font-size:1.5em; font-weight:bold;">Buscando resultados</span>
    <span id="dots" style="font-size:1.5em;"></span>
  `);

  startDotsAnimation();
}

function showSuccessStatus(total = 0) {
  stopDotsAnimation();

  setStatus(`
    <span style="font-size:1.5em; font-weight:bold;">
      ${total} resultado${total !== 1 ? "s" : ""} encontrado${total !== 1 ? "s" : ""}
    </span>
  `);

  hideStatus(1000);
}

function showEmptyStatus(query = "") {
  stopDotsAnimation();

  setStatus(`
    <span style="font-size:1.3em; font-weight:bold;">
      Sin resultados${query ? ` para "${query}"` : ""}
    </span>
  `);

  hideStatus(1400);
}

function showErrorStatus(message = "Error en la búsqueda") {
  stopDotsAnimation();

  const status = getEl("searchStatus");
  if (!status) return;

  status.style.display = "block";
  status.textContent = `❌ ${message}`;
  hideStatus(1800);
}

function clearResults() {
  const container = getEl("results");
  if (!container) return;
  container.innerHTML = "";
}

function renderEmptyResults(query = "") {
  const container = getEl("results");
  if (!container) return;

  const wrapper = document.createElement("div");
  wrapper.className = "empty-results";
  wrapper.setAttribute("role", "status");
  wrapper.setAttribute("aria-live", "polite");

  const icon = document.createElement("i");
  icon.className = "fas fa-search";
  icon.setAttribute("aria-hidden", "true");

  const text = document.createElement("p");
  text.textContent = query
    ? `No se encontraron resultados para "${query}".`
    : "No se encontraron resultados.";

  wrapper.append(icon, text);

  container.innerHTML = "";
  container.appendChild(wrapper);
}

async function handleCardSelection(video, list, index) {
  await addHistory(video.title, video.url, "video");

  document.dispatchEvent(
    new CustomEvent("videoSelected", {
      detail: {
        list,
        index
      }
    })
  );
}

function createFallbackThumb() {
  const fallback = document.createElement("div");
  fallback.className = "thumb thumb-fallback";
  fallback.setAttribute("aria-hidden", "true");

  const icon = document.createElement("i");
  icon.className = "fas fa-image";

  fallback.appendChild(icon);
  return fallback;
}

function createResultCard(video, list, index) {
  const card = document.createElement("div");
  card.className = "card";
  card.setAttribute("tabindex", "0");
  card.setAttribute("role", "button");
  card.setAttribute(
    "aria-label",
    `Seleccionar ${video.title || "video"} de ${video.uploader || "autor desconocido"}`
  );

  const thumbWrapper = document.createElement("div");
  thumbWrapper.className = "thumb-wrapper";

  const img = document.createElement("img");
  img.src = video.thumbnail || "";
  img.width = 320;
  img.height = 180;
  img.loading = "lazy";
  img.decoding = "async";
  img.className = "thumb";
  img.alt = `Miniatura de ${video.title || "video"}`;

  img.onerror = () => {
    if (img.dataset.fallbackApplied === "true") return;
    img.dataset.fallbackApplied = "true";

    const fallback = createFallbackThumb();
    thumbWrapper.innerHTML = "";
    thumbWrapper.appendChild(fallback);
  };

  const title = document.createElement("h4");
  title.textContent = video.title || "Sin título";

  const meta = document.createElement("h5");
  const uploader = video.uploader || "Autor desconocido";
  meta.textContent = `${uploader} - ${formatDuration(video.duration)}`;

  thumbWrapper.appendChild(img);
  card.append(thumbWrapper, title, meta);

  card.addEventListener("click", async () => {
    await handleCardSelection(video, list, index);
  });

  card.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      await handleCardSelection(video, list, index);
    }
  });

  return card;
}

function renderResults(results = []) {
  const container = getEl("results");
  if (!container) return;

  const fragment = document.createDocumentFragment();

  results.forEach((video, index) => {
    fragment.appendChild(createResultCard(video, results, index));
  });

  container.innerHTML = "";
  container.appendChild(fragment);
}

async function search() {
  const input = getEl("searchInput");
  const container = getEl("results");

  if (!input || !container) return;

  const q = input.value.trim();

  if (!q) {
    if (currentController) {
      currentController.abort();
      currentController = null;
    }

    isSearching = false;
    clearResults();
    stopDotsAnimation();
    setSearchButtonLoading(false);
    hideStatus();
    return;
  }

  if (currentController) {
    currentController.abort();
  }

  currentController = new AbortController();
  isSearching = true;

  saveSearchQuery(q);
  showSkeletons();
  showLoadingStatus();
  setSearchButtonLoading(true);

  try {
    const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}`, {
      signal: currentController.signal
    });

    if (!res.ok) {
      throw new Error("No se pudo cargar la búsqueda");
    }

    const data = await res.json();

    if (data.results.length === 0) {
      renderEmptyResults(q);
      showEmptyStatus(q);
      return;
    }

    renderResults(data.results);
    showSuccessStatus(data.results.length);
  } catch (err) {
    if (err.name === "AbortError") {
      return;
    }

    console.error(err);
    clearResults();
    showErrorStatus(err.message || "No se pudo completar la búsqueda");
  } finally {
    isSearching = false;
    setSearchButtonLoading(false);
    stopDotsAnimation();
  }
}

export function initSearch() {
  const searchBtn = getEl("searchBtn");
  const searchInput = getEl("searchInput");

  const handleHistorySelect = (text) => {
    if (!searchInput) return;
    searchInput.value = text;
    search();
  };

  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      if (isSearching) return;
      search();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (isSearching) return;
        search();
      }
    });

    searchInput.addEventListener("input", () => {
      if (searchInput.value.trim()) return;

      if (currentController) {
        currentController.abort();
        currentController = null;
      }

      isSearching = false;
      clearResults();
      stopDotsAnimation();
      setSearchButtonLoading(false);
      hideStatus();
    });
  }

  renderSearchHistory(handleHistorySelect);
}