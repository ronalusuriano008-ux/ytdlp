import { API, currentVideo } from "./downloadState.js";
import { showStatus } from "./downloadStatus.js";
import { saveDownload } from "../downloads/downloadsPage.js";

export async function downloadAudio() {
  if (!currentVideo) return;

  const stopStatus = showStatus([
    "Descargando audio...",
    "Espere...",
    "Procesando archivo...",
    "Conectando a ffmpeg...",
    "Convirtiendo a mp3...",
    "Enviando archivo..."
  ]);

  try {
    const response = await fetch(`${API}/download/audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentVideo.url }),
    });

    if (!response.ok) {
      throw new Error("Error descargando audio");
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `${currentVideo.title}.mp3`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(objectUrl);

    await saveDownload(currentVideo.title, currentVideo.url, "audio");
  } catch (err) {
    console.error("Error en downloadAudio:", err);
  } finally {
    stopStatus();
  }
}