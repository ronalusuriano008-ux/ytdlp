import { API, currentVideo } from "./downloadState.js";
import { showStatus } from "./downloadStatus.js";
import { saveDownload } from "../downloads/downloadsPage.js";

export async function downloadVideo() {
  if (!currentVideo) return;

  const stopStatus = showStatus([
    "Descargando video...",
    "Espere...",
    "Procesando archivo..."
  ]);

  try {
    const response = await fetch(
      `${API}/download/video?url=${encodeURIComponent(currentVideo.url)}`
    );

    if (!response.ok) {
      throw new Error("Error descargando video");
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `${currentVideo.title}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(objectUrl);

    await saveDownload(currentVideo.title, currentVideo.url, "video");
  } catch (err) {
    console.error("Error en downloadVideo:", err);
  } finally {
    stopStatus();
  }
}