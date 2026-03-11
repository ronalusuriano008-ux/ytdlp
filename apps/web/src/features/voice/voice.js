export function initVoice() {
  const voiceBtn = document.getElementById("voiceBtn");
  const searchInput = document.getElementById("searchInput");
  const status = document.getElementById("searchStatus");

  if (!voiceBtn || !searchInput || !status) return;

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    status.style.display = "block";
    status.textContent = "❌ Navegador no compatible con voz";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "es-ES";
  recognition.continuous = false;
  recognition.interimResults = false;

  let isRecording = false;
  let startY = 0;
  let cancelled = false;

  // 🔥 INICIAR GRABACIÓN
  const startRecording = (e) => {
    e.preventDefault();

    cancelled = false;
    isRecording = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;

    status.style.display = "block";
    status.innerHTML = "Escuchando... <br><small>Desliza hacia arriba para cancelar</small>";

    recognition.start();
    voiceBtn.classList.add("recording");
  };

  // 🔥 DETECTAR DESLIZAR PARA CANCELAR
  const moveRecording = (e) => {
    if (!isRecording) return;

    const currentY = e.touches ? e.touches[0].clientY : e.clientY;

    if (startY - currentY > 60) {
      cancelled = true;
      isRecording = false;

      status.innerHTML = "❌ Cancelado";
      voiceBtn.classList.remove("recording");

      recognition.stop();

      // 🔥 Ocultar mensaje después de 1.5 segundos
      setTimeout(() => {
        status.style.display = "none";
      }, 1500);
    }
  };

  // 🔥 FINALIZAR
  const stopRecording = () => {
    if (!isRecording) return;

    isRecording = false;
    voiceBtn.classList.remove("recording");

    if (!cancelled) {
      recognition.stop();
    }
  };

  // Eventos táctiles (móvil)
  voiceBtn.addEventListener("touchstart", startRecording);
  voiceBtn.addEventListener("touchmove", moveRecording);
  voiceBtn.addEventListener("touchend", stopRecording);

  // Eventos mouse (PC)
  voiceBtn.addEventListener("mousedown", startRecording);
  voiceBtn.addEventListener("mousemove", moveRecording);
  voiceBtn.addEventListener("mouseup", stopRecording);
  voiceBtn.addEventListener("mouseleave", stopRecording);

  // Resultado
  recognition.onresult = (event) => {
    if (cancelled) return;

    const transcript = event.results[0][0].transcript;

    searchInput.value = transcript;

    document.dispatchEvent(
      new CustomEvent("voiceRecognized", { detail: transcript })
    );

    status.style.display = "none";
  };

  recognition.onerror = (event) => {
    console.log(event.error);

    if (!cancelled) {
      status.textContent = "❌ Error: " + event.error;
      setTimeout(() => (status.style.display = "none"), 2000);
    }
  };

  recognition.onend = () => {
    if (!cancelled) {
      status.style.display = "none";
    }
  };
}