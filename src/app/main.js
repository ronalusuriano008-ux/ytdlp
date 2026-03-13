import { initSearch } from "../src/features/search/search.js";
import { initVoice } from "../src/features/voice/voice.js";
import { initWebSocket } from "../src/features/websocket/websocket.js";
import { initDownload } from "../src/features/download/download.js";
import { initPlayer } from "../src/features/player/player.js";

import { getSession } from "../src/core/auth/session.js";
import { getDownloads } from "../src/features/downloads/downloadsPage.js";

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