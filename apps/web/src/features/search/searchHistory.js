// /src/features/search/searchHistory.js

const KEY = "gmcn_search_history";
const MAX_ITEMS = 5;

export function getSearchHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Error leyendo historial de búsquedas:", error);
    return [];
  }
}

export function saveSearchQuery(query) {
  const value = String(query || "").trim();
  if (!value) return;

  try {
    let history = getSearchHistory();

    history = history.filter(item => item.toLowerCase() !== value.toLowerCase());
    history.unshift(value);

    if (history.length > MAX_ITEMS) {
      history = history.slice(0, MAX_ITEMS);
    }

    localStorage.setItem(KEY, JSON.stringify(history));
  } catch (error) {
    console.error("Error guardando historial de búsquedas:", error);
  }
}

export function removeSearchQuery(query) {
  try {
    const history = getSearchHistory().filter(item => item !== query);
    localStorage.setItem(KEY, JSON.stringify(history));
  } catch (error) {
    console.error("Error eliminando búsqueda:", error);
  }
}

export function clearSearchHistory() {
  localStorage.removeItem(KEY);
}