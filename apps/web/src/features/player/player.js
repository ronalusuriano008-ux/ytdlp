import { state } from "./config.js";
import { loadVideo } from "./loader.js";
import { prebufferNextVideo } from "./prebuffer.js";
import { updateVideoUI } from "./playerUI.js";

export function initPlayer() {
  const player = document.getElementById("player");
  const preloadPlayer = document.getElementById("preloadPlayer");
  const downloadContainer = document.getElementById("downloadContainer");
  const videoCard = document.querySelector(".video-card");

  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const seekBackBtn = document.querySelector(".seek-back");
  const seekForwardBtn = document.querySelector(".seek-forward");

  if (!player) {
    console.warn("initPlayer: no se encontró #player");
    return;
  }

  state.preloadPlayer = preloadPlayer || null;

  if (videoCard) {
    videoCard.style.display = "none";
  }

  let isLoading = false;
  let loadToken = 0;
 
  function hasPlaylist() {
    return Array.isArray(state.videoList) && state.videoList.length > 0;
  }

  function getCurrentVideo() {
    if (!hasPlaylist()) return null;
    return state.videoList[state.currentIndex] || null;
  }

  function normalizeIndex(index) {
    if (!hasPlaylist()) return 0;
    const total = state.videoList.length;
    return ((index % total) + total) % total;
  }

  function setCurrentIndex(index) {
    state.currentIndex = normalizeIndex(index);
  }

  function goNext() {
    if (!hasPlaylist()) return;
    setCurrentIndex(state.currentIndex + 1);
  }

  function goPrev() {
    if (!hasPlaylist()) return;
    setCurrentIndex(state.currentIndex - 1);
  }

  function resetPrebufferState() {
    state.isPrebuffered = false;

    if (state.preloadPlayer) {
      try {
        state.preloadPlayer.pause();
        state.preloadPlayer.removeAttribute("src");
        state.preloadPlayer.load();
      } catch (error) {
        console.warn("No se pudo limpiar preloadPlayer:", error);
      }
    }
  }

  function resetMainPlayer() {
    try {
      player.pause();
      player.removeAttribute("src");
      player.load();
    } catch (error) {
      console.warn("No se pudo reiniciar player:", error);
    }
  }

  function updatePlayIcon() {
    if (!playPauseBtn) return;

    const icon = playPauseBtn.querySelector("i");
    if (!icon) return;

    icon.classList.toggle("fa-play", player.paused);
    icon.classList.toggle("fa-pause", !player.paused);
  }

  async function safePlay(targetPlayer) {
    try {
      await targetPlayer.play();
    } catch (error) {
      console.warn("No se pudo iniciar la reproducción:", error);
    }
  }

  async function loadCurrentVideo(options = {}) {
    const { clearPrebuffer = true } = options;

    if (!hasPlaylist()) {
      updatePlayIcon();
      return false;
    }

    const token = ++loadToken;
    isLoading = true;

    try {
      if (clearPrebuffer) {
        resetPrebufferState();
      }

      await loadVideo(player, downloadContainer, videoCard);

      if (token !== loadToken) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error cargando video:", error);
      return false;
    } finally {
      if (token === loadToken) {
        isLoading = false;
        updatePlayIcon();
      }
    }
  }

  async function playPrebufferedCurrentVideo() {
    const currentVideo = getCurrentVideo();

    if (!currentVideo || !state.preloadPlayer?.src) {
      return loadCurrentVideo();
    }

    const token = ++loadToken;
    isLoading = true;

    try {
      player.pause();

      player.src = state.preloadPlayer.src;
      player.load();

      updateVideoUI(currentVideo);

      state.isPrebuffered = false;

      if (token !== loadToken) {
        return false;
      }

      await safePlay(player);
      return true;
    } catch (error) {
      console.error("Error usando video prebufferizado:", error);
      return await loadCurrentVideo();
    } finally {
      if (token === loadToken) {
        isLoading = false;
        updatePlayIcon();
      }
    }
  }

  async function handleNext() {
    if (!hasPlaylist() || isLoading) return;

    goNext();
    await loadCurrentVideo();
  }

  async function handlePrev() {
    if (!hasPlaylist() || isLoading) return;

    goPrev();
    await loadCurrentVideo();
  }

  async function handleEnded() {
    if (!hasPlaylist() || isLoading) return;

    goNext();

    if (state.isPrebuffered && state.preloadPlayer?.src) {
      await playPrebufferedCurrentVideo();
    } else {
      await loadCurrentVideo();
    }
  }

  function handleSeekBack() {
    player.currentTime = Math.max(0, player.currentTime - 10);
  }

  function handleSeekForward() {
    if (!Number.isFinite(player.duration) || player.duration <= 0) return;

    player.currentTime = Math.min(
      player.duration,
      player.currentTime + 10
    );
  }

  async function handlePlayPause() {
    try {
      if (player.paused) {
        await safePlay(player);
      } else {
        player.pause();
      }
    } finally {
      updatePlayIcon();
    }
  }

  function maybePrebufferNext() {
    if (
      !hasPlaylist() ||
      !Number.isFinite(player.duration) ||
      player.duration <= 0 ||
      state.isPrebuffered
    ) {
      return;
    }

    const remaining = player.duration - player.currentTime;

    if (remaining >= 30) {
      try {
        prebufferNextVideo();
      } catch (error) {
        console.error("Error en prebufferNextVideo:", error);
      }
    }
  }

  async function handleVideoSelected(event) {
    const detail = event?.detail;
    if (!detail) return;

    resetMainPlayer();
    resetPrebufferState();

    state.videoList = Array.isArray(detail.list) && detail.list.length
      ? detail.list
      : [detail];

    setCurrentIndex(detail.index ?? 0);

    await loadCurrentVideo({ clearPrebuffer: false });
  }

  player.addEventListener("timeupdate", maybePrebufferNext);
  player.addEventListener("ended", handleEnded);
  player.addEventListener("play", updatePlayIcon);
  player.addEventListener("pause", updatePlayIcon);

  document.addEventListener("videoSelected", handleVideoSelected);

  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", handlePlayPause);
  }

  if (seekBackBtn) {
    seekBackBtn.addEventListener("click", handleSeekBack);
  }

  if (seekForwardBtn) {
    seekForwardBtn.addEventListener("click", handleSeekForward);
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", handleNext);
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", handlePrev);
  }

  updatePlayIcon();
}