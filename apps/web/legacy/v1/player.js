const API = location.origin;

let videoList = [];
let currentIndex = 0;
let currentRequestId = 0;
let statusInterval = null;

let preloadPlayer = null;
let isPrebuffered = false;

function showStatus(messages) {
  const el = document.getElementById("videoLoading");
  if (!el) return () => {};

  let index = 0;

  el.classList.remove("hidden");
  el.textContent = messages[index];

  if (statusInterval) clearInterval(statusInterval);

  statusInterval = setInterval(() => {
    index = (index + 1) % messages.length;
    el.textContent = messages[index];
  }, 900);

  return () => {
    clearInterval(statusInterval);
    statusInterval = null;
    el.classList.add("hidden");
  };
}

export function initPlayer() {
  const player = document.getElementById("player");
  const downloadContainer = document.getElementById("downloadContainer");
  const videoCard = document.querySelector(".video-card");
  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");
  const playBtn = document.getElementById("playBtn");

  if (!player) return;

  preloadPlayer = document.getElementById("preloadPlayer");

  if (videoCard) {
    videoCard.style.display = "none";
  }

  player.addEventListener("timeupdate", () => {
    if (!videoList.length || !player.duration) return;

    const remaining = player.duration - player.currentTime;

    if (remaining <= 10 && !isPrebuffered) {
      prebufferNextVideo();
    }
  });

  document.addEventListener("videoSelected", async (e) => {
    player.pause();
    player.removeAttribute("src");
    player.load();

    isPrebuffered = false;

    videoList = e.detail.list || [e.detail];
    currentIndex = e.detail.index ?? 0;

    await loadVideo(player, downloadContainer, videoCard);
  });

  player.addEventListener("ended", async () => {
    if (!videoList.length) return;

    currentIndex++;
    if (currentIndex >= videoList.length) currentIndex = 0;

    if (isPrebuffered && preloadPlayer?.src) {
      const video = videoList[currentIndex];

      player.src = preloadPlayer.src;
      player.load();
      player.play();

      updateVideoUI(video);

      isPrebuffered = false;
    } else {
      await loadVideo(player, downloadContainer, videoCard);
    }
  });

  if (nextBtn) {
    nextBtn.addEventListener("click", async () => {
      if (!videoList.length) return;

      currentIndex++;
      if (currentIndex >= videoList.length) currentIndex = 0;

      isPrebuffered = false;
      await loadVideo(player, downloadContainer, videoCard);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", async () => {
      if (!videoList.length) return;

      currentIndex--;
      if (currentIndex < 0) currentIndex = videoList.length - 1;

      isPrebuffered = false;
      await loadVideo(player, downloadContainer, videoCard);
    });
  }
}

async function loadVideo(player, downloadContainer, videoCard) {
  const requestId = ++currentRequestId;
  const video = videoList[currentIndex];
  if (!video) return;

  const mainTitle = document.getElementById("videoMainTitle");
  const subTitle = document.getElementById("videoSubTitle");

  if (videoCard) videoCard.style.display = "block";
  if (mainTitle) mainTitle.textContent = video.title;
  if (subTitle) subTitle.textContent = video.uploader;

  document.title = `${video.title} - Mi Player`;

  if (downloadContainer) {
    downloadContainer.classList.add("hidden");
  }

  isPrebuffered = false;

  const stopStatus = showStatus([
    "Cargando video...",
    "Conectando...",
    "Preparando reproducción...",
    "Espere..."
  ]);

  try {
    const response = await fetch(
      `${API}/stream?url=${encodeURIComponent(video.url)}`
    );

    const data = await response.json();

    if (requestId !== currentRequestId) return;

    player.src = data.directUrl;
    player.preload = "auto";
    player.load();

    player.onplaying = () => {
      stopStatus();

      if (downloadContainer) {
        downloadContainer.classList.remove("hidden");
      }

      document.dispatchEvent(
        new CustomEvent("videoChanged", { detail: video })
      );
    };

  } catch (err) {
    console.error("Error cargando video:", err);
    stopStatus();
  }
}

function updateVideoUI(video) {
  const mainTitle = document.getElementById("videoMainTitle");
  const subTitle = document.getElementById("videoSubTitle");

  if (mainTitle) mainTitle.textContent = video.title;
  if (subTitle) subTitle.textContent = video.uploader;

  document.title = `${video.title} - Mi Player`;

  document.dispatchEvent(
    new CustomEvent("videoChanged", { detail: video })
  );
}

let isPrebuffering = false;

async function prebufferNextVideo() {
  if (!videoList.length || !preloadPlayer) return;
  if (isPrebuffering || isPrebuffered) return;

  isPrebuffering = true;

  let nextIndex = currentIndex + 1;
  if (nextIndex >= videoList.length) nextIndex = 0;

  const nextVideo = videoList[nextIndex];
  if (!nextVideo) {
    isPrebuffering = false;
    return;
  }

  try {
    const response = await fetch(
      `${API}/stream?url=${encodeURIComponent(nextVideo.url)}`
    );

    const data = await response.json();

    preloadPlayer.src = data.directUrl;
    preloadPlayer.preload = "auto";
    preloadPlayer.load();

    isPrebuffered = true;

  } catch (err) {
    console.error("Error prebuffer:", err);
  }

  isPrebuffering = false;
}