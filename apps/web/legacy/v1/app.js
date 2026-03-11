document.addEventListener("DOMContentLoaded", () => {

  const API = "";
  const ws = new WebSocket(`ws://${location.hostname}:3000`);

  let currentVideo = null;

  // ===== WebSocket progreso =====
  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.progress) {
      const bar = document.getElementById("progressBar");
      if (bar) bar.style.width = data.progress + "%";
    }
  };

  function showSkeletons() {
    const container = document.getElementById("results");
    if (!container) return;

    container.innerHTML = "";

    for (let i = 0; i < 6; i++) {
      const card = document.createElement("div");
      card.className = "card skeleton-card";

      card.innerHTML = `
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text" style="width:60%"></div>
    `;

      container.appendChild(card);
    }
  }

  function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }


  // ===== Buscar =====
  let dotsInterval;

  function startDotsAnimation() {
    const dots = document.getElementById('dots');
    let count = 0;

    if (dotsInterval) clearInterval(dotsInterval);

    dotsInterval = setInterval(() => {
      count = (count + 1) % 4; // 0,1,2,3 puntos
      dots.textContent = '.'.repeat(count);
    }, 500);
  }

  function stopDotsAnimation() {
    if (dotsInterval) clearInterval(dotsInterval);
    document.getElementById('dots').textContent = '';
  }

  // ===== Buscar =====
  async function search() {
    const status = document.getElementById("searchStatus");
    const input = document.getElementById("searchInput");
    if (!input || !status) return;

    const q = input.value.trim();
    if (!q) {
      status.style.display = "none";
      return;
    }

    showSkeletons();
    status.style.display = "block";
    status.innerHTML = `
  <i class="fas fa-spinner fa-spin" style="margin-right:8px; font-size:1.5em;"></i>
  <span style="font-size:1.5em; font-weight:bold;">Buscando resultados</span>
  <span id="dots" style="font-size:1.5em;"></span>
`;
    startDotsAnimation();

    try {
      const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("No se pudo cargar");

      const data = await res.json();
      const container = document.getElementById("results");
      if (!container) return;
      container.innerHTML = "";

      data.results.forEach((v) => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
        <img src="${v.thumbnail}" width="100%">
        <h4>${v.title}</h4>
        <h5>${v.uploader} - ${formatDuration(v.duration)}</h5>
      `;
        card.onclick = () => selectVideo(v);
        container.appendChild(card);
      });

      stopDotsAnimation();
      status.innerHTML = `
  <span style="font-size:1.5em; font-weight:bold;">Resultados encontrados</span>
`;
      setTimeout(() => { status.style.display = "none"; }, 800);

    } catch (err) {
      console.error(err);
      stopDotsAnimation();
      status.textContent = "❌ Error en la búsqueda";
      setTimeout(() => { status.style.display = "none"; }, 1500);
    }
  }

  // ===== Seleccionar video =====
  async function selectVideo(video) {
    currentVideo = video;

    const player = document.getElementById("player");
    const downloadVideoBtn = document.getElementById("downloadVideoBtn");
    const downloadAudioBtn = document.getElementById("downloadAudioBtn");

    if (!player) return;

    player.style.display = "block";

    if (downloadVideoBtn) downloadVideoBtn.style.display = "none";
    if (downloadAudioBtn) downloadAudioBtn.style.display = "none";

    player.src = `${API}/stream?url=${encodeURIComponent(video.url)}`;
    player.load();

    player.oncanplay = () => {
      if (downloadVideoBtn) downloadVideoBtn.style.display = "inline-block";
      if (downloadAudioBtn) downloadAudioBtn.style.display = "inline-block";
    };
  }

  // ===== Descargar video =====
  function downloadVideo() {
    if (!currentVideo) return;

    const url = `${API}/download/video?url=${encodeURIComponent(currentVideo.url)}`;
    window.location.href = url;
  }

  // ===== Descargar audio =====
  async function downloadAudio() {
    if (!currentVideo) return;

    try {
      const response = await fetch(`${API}/download/audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: currentVideo.url
        }),
      });

      if (!response.ok) throw new Error("Error descargando audio");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentVideo.title}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
    }
  }

  // ===== Eventos =====
  const searchBtn = document.getElementById("searchBtn");
  const downloadVideoBtn = document.getElementById("downloadVideoBtn");
  const downloadAudioBtn = document.getElementById("downloadAudioBtn");
  const searchInput = document.getElementById("searchInput");
  const voiceBtn = document.getElementById("voiceBtn");

  if (searchBtn) searchBtn.onclick = search;
  if (downloadVideoBtn) downloadVideoBtn.onclick = downloadVideo;
  if (downloadAudioBtn) downloadAudioBtn.onclick = downloadAudio;

  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") search();
    });
  }

  if (voiceBtn) {

    let mediaRecorder;
    let audioChunks = [];

    voiceBtn.addEventListener("click", async () => {

      const status = document.getElementById("searchStatus");

      try {

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {

          const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

          const formData = new FormData();
          formData.append("audio", audioBlob);

          status.innerHTML = `
          <span style="font-size:1.5em; font-weight:bold;">
            🔄 Procesando voz...
          </span>
        `;

          const response = await fetch(`${API}/voice`, {
            method: "POST",
            body: formData
          });

          const result = await response.json();

          if (result.text) {
            searchInput.value = result.text;
            search();
          } else {
            status.textContent = "❌ No se reconoció voz";
            setTimeout(() => status.style.display = "none", 1500);
          }
        };

        status.style.display = "block";
        status.innerHTML = `
        <span style="font-size:1.5em; font-weight:bold;">
          🎤 Grabando...
        </span>
      `;

        mediaRecorder.start();

        // Graba 4 segundos (puedes cambiarlo)
        setTimeout(() => {
          mediaRecorder.stop();
        }, 4000);

      } catch (err) {
        console.error(err);
        status.textContent = "❌ Error de micrófono";
        setTimeout(() => status.style.display = "none", 1500);
      }

    });
  }

});
