import subprocess
import json
import os
import glob
import re
import requests

# ========================
# 📂 RUTAS
# ========================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))

STORAGE_VIDEO = os.path.join(ROOT_DIR, "storage", "videos")
STORAGE_AUDIO = os.path.join(ROOT_DIR, "storage", "audio")

COOKIE_PATH = os.path.join(BASE_DIR, "../cookies.txt")

os.makedirs(STORAGE_VIDEO, exist_ok=True)
os.makedirs(STORAGE_AUDIO, exist_ok=True)

# ========================
# ⚡ CACHE STREAM
# ========================

STREAM_CACHE = {}
SEARCH_CACHE = {}

# ========================
# OPCIONES BASE yt-dlp 
# ========================

COMMON = [
    "--cookies", COOKIE_PATH,
    "--force-ipv4",
    "--retries", "10",
]

SEARCH_COMMON = [
    "--skip-download",
    "--flat-playlist",
    "--quiet",
    "--no-warnings"
]

# ========================
# 🌐 HEADERS YOUTUBE 
# ========================

YOUTUBE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/145.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-PE,es;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}

# ========================
# 🧩 HELPERS SEARCH 
# ========================

def safe_get(dct, *keys, default=None):
    current = dct
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key)
        elif isinstance(current, list) and isinstance(key, int) and 0 <= key < len(current):
            current = current[key]
        else:
            return default
        if current is None:
            return default
    return current


def get_text(node):
    if not node:
        return None

    if isinstance(node, str):
        return node.strip()

    if isinstance(node, dict):
        simple = node.get("simpleText")
        if isinstance(simple, str):
            return simple.strip()

        runs = node.get("runs")
        if isinstance(runs, list):
            text = "".join(
                run.get("text", "")
                for run in runs
                if isinstance(run, dict)
            ).strip()
            return text or None

    return None


def parse_duration_to_seconds(text):
    if not text or not isinstance(text, str):
        return 0

    parts = text.strip().split(":")
    try:
        parts = [int(p) for p in parts]
    except ValueError:
        return 0

    if len(parts) == 3:
        h, m, s = parts
        return h * 3600 + m * 60 + s

    if len(parts) == 2:
        m, s = parts
        return m * 60 + s

    if len(parts) == 1:
        return parts[0]

    return 0


def get_best_thumbnail(video_id, thumbnails):
    if isinstance(thumbnails, list) and thumbnails:
        last = thumbnails[-1]
        if isinstance(last, dict):
            url = last.get("url")
            if url:
                return url

    if video_id:
        return f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

    return None


def extract_yt_initial_data(html):
    patterns = [
        r'var ytInitialData\s*=\s*(\{.*?\})\s*;\s*</script>',
        r'window\["ytInitialData"\]\s*=\s*(\{.*?\})\s*;\s*</script>',
        r'ytInitialData\s*=\s*(\{.*?\})\s*;'
    ]

    for pattern in patterns:
        match = re.search(pattern, html, re.DOTALL)
        if not match:
            continue

        raw_json = match.group(1)

        try:
            return json.loads(raw_json)
        except json.JSONDecodeError:
            continue

    return None


def parse_video_renderer(video):
    if not isinstance(video, dict):
        return None

    video_id = video.get("videoId")
    if not video_id:
        return None

    title = (
        get_text(video.get("title")) or
        get_text(video.get("headline"))
    )
    if not title:
        return None

    uploader = (
        get_text(video.get("ownerText")) or
        get_text(video.get("longBylineText")) or
        get_text(video.get("shortBylineText")) or
        "Desconocido"
    )

    duration_text = get_text(video.get("lengthText")) or "0:00"
    duration = parse_duration_to_seconds(duration_text)

    thumbnails = safe_get(video, "thumbnail", "thumbnails", default=[])
    thumbnail = get_best_thumbnail(video_id, thumbnails)

    return {
        "title": title,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "thumbnail": thumbnail,
        "duration": duration,
        "uploader": uploader
    }


def collect_videos(items, results):
    if not isinstance(items, list):
        return

    for item in items:
        if not isinstance(item, dict):
            continue

        if "videoRenderer" in item:
            parsed = parse_video_renderer(item["videoRenderer"])
            if parsed:
                results.append(parsed)

        rich_video = safe_get(item, "richItemRenderer", "content", "videoRenderer")
        if isinstance(rich_video, dict):
            parsed = parse_video_renderer(rich_video)
            if parsed:
                results.append(parsed)

        nested_lists = [
            safe_get(item, "itemSectionRenderer", "contents", default=[]),
            safe_get(item, "sectionListRenderer", "contents", default=[]),
            safe_get(item, "richGridRenderer", "contents", default=[]),
            safe_get(item, "shelfRenderer", "content", "verticalListRenderer", "items", default=[]),
        ]

        for nested in nested_lists:
            if isinstance(nested, list):
                collect_videos(nested, results)


# ========================
# 🔎 SEARCH SIN yt-dlp
# ========================

def search(query):
    query = (query or "").strip()

    if not query:
        return {"results": []}

    # ⚡ CACHE
    if query in SEARCH_CACHE:
        return {"results": SEARCH_CACHE[query]}

    url = "https://www.youtube.com/results"
    params = {
        "search_query": query
    }

    response = requests.get(
        url,
        params=params,
        headers=YOUTUBE_HEADERS,
        timeout=8
    )
    response.raise_for_status()

    html = response.text
    data = extract_yt_initial_data(html)

    if not data:
        raise Exception("No se pudo extraer ytInitialData")

    primary_contents = safe_get(
        data,
        "contents",
        "twoColumnSearchResultsRenderer",
        "primaryContents",
        default={}
    )

    contents = (
        safe_get(primary_contents, "sectionListRenderer", "contents", default=[]) or
        safe_get(primary_contents, "richGridRenderer", "contents", default=[]) or
        []
    )

    results = []
    collect_videos(contents, results)

    # quitar duplicados por url
    unique = []
    seen = set()

    for item in results:
        video_url = item.get("url")
        if not video_url or video_url in seen:
            continue
        seen.add(video_url)
        unique.append(item)

    unique = unique[:20]

    SEARCH_CACHE[query] = unique

    return {"results": unique}


# ========================
# 🔴 STREAM URL (rápido)
# ========================

def stream_url(data):

    url = data["url"]

    # ⚡ CACHE
    if url in STREAM_CACHE:
        return {"directUrl": STREAM_CACHE[url]}

    cmd = [
        "yt-dlp",
        "--no-warnings",
        "--no-call-home",
        "--no-check-certificates",
        "--extractor-args", "youtube:player_client=android",
        "-f", "best",
        "-g",
        url
    ]

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    stdout, stderr = process.communicate()

    if process.returncode != 0:
        raise Exception(stderr)

    direct_url = stdout.strip().splitlines()[0]

    STREAM_CACHE[url] = direct_url

    return {
        "directUrl": direct_url
    }


# ========================
# 🎬 DOWNLOAD VIDEO
# ========================

def download_video(data):

    url = data["url"]

    output_template = os.path.join(STORAGE_VIDEO, "%(title)s.%(ext)s")

    cmd = [
        "yt-dlp",
        *COMMON,
        "--no-warnings",
        "--no-call-home",
        "--no-check-certificates",
        "--concurrent-fragments", "16",
        "--extractor-args", "youtube:player_client=android",
        "--merge-output-format", "mp4",
        "--remux-video", "mp4",
        "-f", "bv*+ba/bestvideo+bestaudio/best",
        url,
        "-o", output_template
    ]

    process = subprocess.run(cmd, capture_output=True, text=True)

    if process.returncode != 0:
        raise Exception(process.stderr)

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

    cmd = [
        "yt-dlp",
        *COMMON,
        "--no-warnings",
        "--no-call-home",
        "--no-check-certificates",
        "--concurrent-fragments", "16",
        "--extractor-args", "youtube:player_client=android",
        "-f", "bestaudio",
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        url,
        "-o", output_template
    ]

    process = subprocess.run(cmd, capture_output=True, text=True)

    if process.returncode != 0:
        raise Exception(process.stderr)

    files = glob.glob(os.path.join(STORAGE_AUDIO, "*.mp3"))

    if not files:
        raise Exception("No se generó ningún audio")

    latest_file = max(files, key=os.path.getctime)

    return {
        "filePath": latest_file
    }