import { addHistory } from "../history/history.js";
import { saveSearchQuery } from "./searchHistory.js";
import { renderSearchHistory } from "./searchHistoryPage.js";

const API = location.origin;

let dotsInterval;

function getEl(id) {
  return document.getElementById(id);
}

function formatDuration(seconds = 0) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return "0:00";

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
    <div class="card skeleton-card">
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

  setTimeout(() => {
    status.style.display = "none";
  }, delay);
}

function startDotsAnimation() {
  const dots = getEl("dots");
  if (!dots) return;

  let count = 0;
  clearInterval(dotsInterval);

  dotsInterval = setInterval(() => {
    count = (count + 1) % 4;
    dots.textContent = ".".repeat(count);
  }, 500);
}

function stopDotsAnimation() {
  clearInterval(dotsInterval);
  const dots = getEl("dots");
  if (dots) dots.textContent = "";
}

function showLoadingStatus() {
  setStatus(`
    <i class="fas fa-spinner fa-spin" style="margin-right:8px; font-size:1.5em;"></i>
    <span style="font-size:1.5em; font-weight:bold;">Buscando resultados</span>
    <span id="dots" style="font-size:1.5em;"></span>
  `);
  startDotsAnimation();
}

function showSuccessStatus() {
  stopDotsAnimation();
  setStatus(`
    <span style="font-size:1.5em; font-weight:bold;">
      Resultados encontrados
    </span>
  `);
  hideStatus(800);
}

function showErrorStatus() {
  stopDotsAnimation();
  const status = getEl("searchStatus");
  if (!status) return;

  status.style.display = "block";
  status.textContent = "❌ Error en la búsqueda";
  hideStatus(1500);
}

function createResultCard(video, list, index) {
  const card = document.createElement("div");
  card.className = "card";

  card.innerHTML = `
    <div class="thumb-wrapper">
      <img 
        src="${video.thumbnail}" 
        width="320" 
        height="180"
        loading="lazy"
        decoding="async"
        class="thumb"
      >
    </div>
    <h4>${video.title}</h4>
    <h5>${video.uploader} - ${formatDuration(video.duration)}</h5>
  `;

  card.onclick = async () => {
    await addHistory(video.title, video.url, "video");

    document.dispatchEvent(
      new CustomEvent("videoSelected", {
        detail: {
          list,
          index
        }
      })
    );
  };

  return card;
}

async function search() {
  const input = getEl("searchInput");
  const container = getEl("results");

  if (!input || !container) return;

  const q = input.value.trim();

  if (!q) {
    hideStatus();
    return;
  }

  saveSearchQuery(q);

  showSkeletons();
  showLoadingStatus();

  try {
    const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error("No se pudo cargar");

    const data = await res.json();
    container.innerHTML = "";

    data.results.forEach((video, index) => {
      container.appendChild(createResultCard(video, data.results, index));
    });

    showSuccessStatus();
  } catch (err) {
    console.error(err);
    showErrorStatus();
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

  if (searchBtn) searchBtn.onclick = search;

  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") search();
    });
  }

  renderSearchHistory(handleHistorySelect);
}
