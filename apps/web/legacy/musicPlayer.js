import { state } from "/src/features/player/config.js";
import { prebufferNextVideo } from "/src/features/player/prebuffer.js";
import { updateVideoUI } from "/src/features/player/playerUI.js";

const API = location.origin;

export function initMusicPlayer() {
  const player = document.getElementById("player");
  const cover = document.getElementById("coverImage");

  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");
  const playPauseBtn = document.getElementById("playPauseBtn");

  const seekBackBtn = document.querySelector(".seek-back");
  const seekForwardBtn = document.querySelector(".seek-forward");

  state.preloadPlayer = document.getElementById("preloadPlayer");

  if (!player) {
    console.error("❌ No se encontró #player");
    return;
  }

  console.log("🎵 MusicPlayer listo");

  player.addEventListener("timeupdate", () => {
    if (!state.videoList?.length || !player.duration) return;

    const remaining = player.duration - player.currentTime;

    if (remaining <= 10 && !state.isPrebuffered) {
      console.log("⚡ Prebuffer siguiente audio");
      prebufferNextVideo();
    }
  });

  document.addEventListener("videoSelected", async (e) => {
    console.log("📡 Evento videoSelected recibido:", e.detail);

    player.pause();
    player.removeAttribute("src");
    player.load();

    state.isPrebuffered = false;
    state.videoList = e.detail.list || [e.detail];
    state.currentIndex = e.detail.index ?? 0;

    const video = state.videoList[state.currentIndex];
    await loadAndPlay(video);
  });

  player.addEventListener("ended", async () => {
    if (!state.videoList?.length) return;

    state.currentIndex++;

    if (state.currentIndex >= state.videoList.length) {
      state.currentIndex = 0;
    }

    const video = state.videoList[state.currentIndex];
    await loadAndPlay(video);
  });

  async function loadAndPlay(video) {
    if (!video) {
      console.error("❌ No hay video para reproducir");
      return;
    }

    try {
      if (!video.audioUrl) {
        console.log("🌐 Solicitando directUrl para:", video.title);

        const response = await fetch(
          `${API}/stream?url=${encodeURIComponent(video.url)}`
        );

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();

        if (!data.directUrl) {
          throw new Error("La respuesta no contiene 'directUrl'");
        }

        video.audioUrl = data.directUrl;
      }

      player.src = video.audioUrl;
      player.preload = "auto";
      player.load();

      if (cover) {
        cover.src = video.thumbnail || "";
      }

      updateVideoUI(video);

      try {
        await player.play();
      } catch (playErr) {
        console.error("❌ Error al reproducir:", playErr);
      }

      updatePlayIcon();
      console.log("▶ Reproduciendo:", video.title);

    } catch (err) {
      console.error("❌ Error en loadAndPlay:", err);
    }
  }

  function updatePlayIcon() {
    if (!playPauseBtn) return;

    const icon = playPauseBtn.querySelector("i");
    if (!icon) return;

    if (player.paused) {
      icon.classList.remove("fa-pause");
      icon.classList.add("fa-play");
    } else {
      icon.classList.remove("fa-play");
      icon.classList.add("fa-pause");
    }
  }

  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", async () => {
      try {
        if (player.paused) {
          await player.play();
        } else {
          player.pause();
        }
        updatePlayIcon();
      } catch (err) {
        console.error("❌ Error en play/pause:", err);
      }
    });
  }

  if (seekBackBtn) {
    seekBackBtn.addEventListener("click", () => {
      player.currentTime = Math.max(0, player.currentTime - 10);
    });
  }

  if (seekForwardBtn) {
    seekForwardBtn.addEventListener("click", () => {
      if (!player.duration) return;
      player.currentTime = Math.min(player.duration, player.currentTime + 10);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", async () => {
      if (!state.videoList?.length) return;

      state.currentIndex++;

      if (state.currentIndex >= state.videoList.length) {
        state.currentIndex = 0;
      }

      const video = state.videoList[state.currentIndex];
      await loadAndPlay(video);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", async () => {
      if (!state.videoList?.length) return;

      state.currentIndex--;

      if (state.currentIndex < 0) {
        state.currentIndex = state.videoList.length - 1;
      }

      const video = state.videoList[state.currentIndex];
      await loadAndPlay(video);
    });
  }

  player.addEventListener("play", updatePlayIcon);
  player.addEventListener("pause", updatePlayIcon);
}