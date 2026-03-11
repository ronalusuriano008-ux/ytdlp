import { initSearch } from "../features/search/search.js";
import { initVoice } from "../features/voice/voice.js";
import { initWebSocket } from "../features/websocket/websocket.js";
import { initDownload } from "../features/download/download.js";
import { initPlayer } from "../features/player/player.js";

import { getSession } from "../core/auth/session.js";
import { getDownloads } from "../features/downloads/downloadsPage.js";

document.addEventListener("DOMContentLoaded", () => {
  initSearch();
  initVoice();
  initWebSocket();
  initDownload();
  initPlayer();

  const username = getSession();

  if (username) {
    getDownloads();
  }

  document.addEventListener("voiceRecognized", () => {
    document.getElementById("searchBtn")?.click();
  });
});