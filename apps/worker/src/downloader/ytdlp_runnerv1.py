import subprocess
import json
import os
import glob

# 📂 Ruta absoluta del proyecto
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))

STORAGE_VIDEO = os.path.join(ROOT_DIR, "storage", "videos")
STORAGE_AUDIO = os.path.join(ROOT_DIR, "storage", "audio")

COOKIE_PATH = os.path.join(BASE_DIR, "../cookies.txt")

COMMON = [
    "--cookies", COOKIE_PATH,
    "--js-runtimes", "node",
    "--remote-components", "ejs:github",
    "--extractor-args", "youtube:player_client=web",
    "--force-ipv4",
    "--http-chunk-size", "10M",
    "--retries", "10",
    "--fragment-retries", "10"
]

SEARCH_COMMON = [
    "--skip-download",
    "--no-playlist",
    "--flat-playlist",
    "--quiet"
]


# ========================
# 🔎 SEARCH
# ========================
def search(query):

    cmd = [
        "yt-dlp",
        *COMMON,
        *SEARCH_COMMON,
        f"ytsearch20:{query}",
        "--dump-json"
    ]

    p = subprocess.run(cmd, capture_output=True, text=True)

    results = []

    for line in p.stdout.splitlines():
        data = json.loads(line)
        video_id = data.get("id")

        results.append({
            "title": data.get("title"),
            "url": data.get("webpage_url") or f"https://www.youtube.com/watch?v={video_id}",
            "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg" if video_id else None,
            "duration": data.get("duration"),
            "uploader": data.get("uploader")
        })

    return {"results": results}


# ========================
# 🔴 STREAM URL (direct link)
# ========================
def stream_url(data):

    url = data["url"]

    cmd = [
        "yt-dlp",
        *COMMON,
        "--no-warnings",
        "--no-call-home",
        "--no-check-certificates",
        "--concurrent-fragments", "16",
        "-g",
        url
    ]

    p = subprocess.run(cmd, capture_output=True, text=True)

    if p.returncode != 0:
        raise Exception(p.stderr)

    direct_url = p.stdout.strip().splitlines()[0]

    return {
        "directUrl": direct_url
    }

# ========================
# 🎬 DOWNLOAD VIDEO
# ========================
def download_video(data):

    url = data["url"]
    format_id = data.get("format")

    output_template = os.path.join(STORAGE_VIDEO, "%(title)s.%(ext)s")

    subprocess.run([
    "yt-dlp",
    *COMMON,
    "--no-warnings",
    "--no-call-home",
    "--no-check-certificates",
    "--concurrent-fragments", "16",
    "--merge-output-format", "mp4",
    "--remux-video", "mp4",
    "--extractor-args", "youtube:player_client=android",
    "-f", "bv*+ba/bestvideo+bestaudio/best",
    url,
    "-o", output_template
], check=True)

    # Buscar archivo más reciente
    files = glob.glob(os.path.join(STORAGE_VIDEO, "*.mp4"))
    if not files:
        raise Exception("No se generó ningún video")

    latest_file = max(files, key=os.path.getctime)

    return {
        "filePath": latest_file
    }


# ========================
# 🎵 DOWNLOAD AUDIO
# ========================
def download_audio(data):

    url = data["url"]

    output_template = os.path.join(STORAGE_AUDIO, "%(title)s.%(ext)s")

    subprocess.run([
    "yt-dlp",
    *COMMON,
    "--no-warnings",
    "--no-call-home",
    "--no-check-certificates",
    "--concurrent-fragments", "16",
    "--extractor-args", "youtube:player_client=android",
    url,
    "-f", "bestaudio",
    "-x",
    "--audio-format", "mp3",
    "--audio-quality", "0",
    "-o", output_template
], check=True)

    files = glob.glob(os.path.join(STORAGE_AUDIO, "*.mp3"))
    if not files:
        raise Exception("No se generó ningún audio")

    latest_file = max(files, key=os.path.getctime)

    return {
        "filePath": latest_file
    }