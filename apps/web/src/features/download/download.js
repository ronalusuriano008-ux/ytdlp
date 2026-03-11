import { setCurrentVideo } from "./downloadState.js";
import { downloadVideo } from "./downloadVideo.js";
import { downloadAudio } from "./downloadAudio.js";

export function initDownload() {

  const downloadVideoBtn = document.getElementById("downloadVideoBtn");
  const downloadAudioBtn = document.getElementById("downloadAudioBtn");

  if (downloadVideoBtn) {
    downloadVideoBtn.addEventListener("click", downloadVideo);
  }

  if (downloadAudioBtn) {
    downloadAudioBtn.addEventListener("click", downloadAudio);
  }

  document.addEventListener("videoChanged", (e) => {
    const video = e.detail;
    if (!video || !video.url) {
      setCurrentVideo(null);
      return;
    }
    setCurrentVideo(video);
  });
}