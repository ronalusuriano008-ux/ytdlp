// /src/features/search/searchHistoryPage.js

import { getSearchHistory, removeSearchQuery } from "./searchHistory.js";

export function renderSearchHistory(onSearchClick) {
  const container = document.getElementById("searchHistoryList");
  if (!container) return;

  const history = getSearchHistory();
  container.innerHTML = "";

  if (history.length === 0) {
    container.innerHTML = `<div class="search-history-empty">No hay búsquedas recientes.</div>`;
    return;
  }

  history.forEach((query) => {
    const item = document.createElement("div");
    item.className = "search-history-item";

    item.innerHTML = `
      <div class="search-history-left">
        <i class="fas fa-clock-rotate-left"></i>
        <span class="search-history-text">${query}</span>
      </div>
      <button class="search-history-delete" type="button" title="Eliminar">
        <i class="fas fa-xmark"></i>
      </button>
    `;

    item.addEventListener("click", () => {
      if (typeof onSearchClick === "function") {
        onSearchClick(query);
      }
    });

    const deleteBtn = item.querySelector(".search-history-delete");
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeSearchQuery(query);
      renderSearchHistory(onSearchClick);
    });

    container.appendChild(item);
  });
}