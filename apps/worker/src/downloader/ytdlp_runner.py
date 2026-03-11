import subprocess
import json
import os
import glob
import requests
import time

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
# ⚡ CACHE
# ========================

STREAM_CACHE = {}

SEARCH_CACHE = {}
SEARCH_CACHE_TTL = 300
SEARCH_CACHE_MAX = 100

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
# 🌐 CONFIG YOUTUBEI
# ========================

# Este client suele funcionar bien para búsquedas.
# Si algún día cambia, normalmente bastará ajustar clientVersion.
YOUTUBEI_SEARCH_URL = "https://www.youtube.com/youtubei/v1/search"

YOUTUBE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/145.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-PE,es;q=0.9,en;q=0.8",
    "Content-Type": "application/json",
    "Origin": "https://www.youtube.com",
    "Referer": "https://www.youtube.com/",
    "X-Youtube-Client-Name": "1",
    "X-Youtube-Client-Version": "2.20260225.01.00",
}

YOUTUBEI_PAYLOAD_CONTEXT = {
    "client": {
        "clientName": "WEB",
        "clientVersion": "2.20260225.01.00",
        "hl": "es",
        "gl": "PE"
    }
}

# ========================
# 🧩 HELPERS GENERALES
# ========================

def safe_get(data, *keys, default=None):
    current = data
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key)
        elif isinstance(current, list) and isinstance(key, int):
            if 0 <= key < len(current):
                current = current[key]
            else:
                return default
        else:
            return default

        if current is None:
            return default

    return current


def get_text(node):
    if not node:
        return None

    if isinstance(node, str):
        text = node.strip()
        return text or None

    if isinstance(node, dict):
        simple = node.get("simpleText")
        if isinstance(simple, str):
            text = simple.strip()
            return text or None

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


def prune_search_cache():
    now = time.time()

    expired_keys = [
        key for key, item in SEARCH_CACHE.items()
        if now - item["time"] > SEARCH_CACHE_TTL
    ]

    for key in expired_keys:
        SEARCH_CACHE.pop(key, None)

    while len(SEARCH_CACHE) > SEARCH_CACHE_MAX:
        oldest_key = next(iter(SEARCH_CACHE))
        SEARCH_CACHE.pop(oldest_key, None)


# ========================
# 🧩 HELPERS SEARCH youtubei
# ========================

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

    duration_text = (
        get_text(video.get("lengthText")) or
        get_text(video.get("thumbnailOverlays", [{}])[0].get("thumbnailOverlayTimeStatusRenderer", {}).get("text")) or
        "0:00"
    )

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


def extract_items_from_section_list(contents, results):
    if not isinstance(contents, list):
        return

    for item in contents:
        if not isinstance(item, dict):
            continue

        # Resultado normal
        if "videoRenderer" in item:
            parsed = parse_video_renderer(item["videoRenderer"])
            if parsed:
                results.append(parsed)

        # Rich renderer
        rich_video = safe_get(item, "richItemRenderer", "content", "videoRenderer")
        if isinstance(rich_video, dict):
            parsed = parse_video_renderer(rich_video)
            if parsed:
                results.append(parsed)

        # Item section
        nested_item_section = safe_get(item, "itemSectionRenderer", "contents", default=[])
        if isinstance(nested_item_section, list):
            extract_items_from_section_list(nested_item_section, results)

        # Shelf / listas verticales
        nested_shelf_items = safe_get(
            item,
            "shelfRenderer",
            "content",
            "verticalListRenderer",
            "items",
            default=[]
        )
        if isinstance(nested_shelf_items, list):
            extract_items_from_section_list(nested_shelf_items, results)

        # Secciones más profundas
        nested_section_list = safe_get(item, "sectionListRenderer", "contents", default=[])
        if isinstance(nested_section_list, list):
            extract_items_from_section_list(nested_section_list, results)


def extract_search_contents(data):
    return (
        safe_get(
            data,
            "contents",
            "twoColumnSearchResultsRenderer",
            "primaryContents",
            "sectionListRenderer",
            "contents",
            default=[]
        )
        or safe_get(
            data,
            "contents",
            "sectionListRenderer",
            "contents",
            default=[]
        )
        or []
    )


def build_youtubei_search_payload(query):
    return {
        "query": query,
        "context": YOUTUBEI_PAYLOAD_CONTEXT,
        "params": "EgIQAQ%3D%3D"
    }


def do_youtubei_search(query):
    payload = build_youtubei_search_payload(query)

    response = requests.post(
        YOUTUBEI_SEARCH_URL,
        headers=YOUTUBE_HEADERS,
        json=payload,
        timeout=8
    )

    response.raise_for_status()
    return response.json()


# ========================
# 🔎 SEARCH con youtubei/v1/search
# ========================

def search(query):
    query = (query or "").strip()

    if not query:
        return {"results": []}

    prune_search_cache()

    cached = SEARCH_CACHE.get(query)
    if cached and (time.time() - cached["time"] <= SEARCH_CACHE_TTL):
        return {"results": cached["results"]}

    data = do_youtubei_search(query)

    contents = extract_search_contents(data)

    results = []
    extract_items_from_section_list(contents, results)

    unique = []
    seen = set()

    for item in results:
        video_url = item.get("url")
        if not video_url or video_url in seen:
            continue
        seen.add(video_url)
        unique.append(item)

    unique = unique[:20]

    SEARCH_CACHE[query] = {
        "time": time.time(),
        "results": unique
    }

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
    import os, glob, traceback

    try:
        print("\n ===== INICIO download_audio =====")
        print("DATA:", data)
        print("STORAGE_AUDIO:", STORAGE_AUDIO)

        url = data.get("url")
        if not url:
            raise Exception("Falta url")

        output_template = os.path.join(STORAGE_AUDIO, "%(title)s.%(ext)s")

        cmd = [
            "yt-dlp",
            *COMMON,
            "--no-warnings",
            "--no-check-certificates",
            "--concurrent-fragments", "16",
            "-f", "bestaudio/best",
            "-x",
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "-o", output_template,
            url
        ]

        print("CMD:", " ".join(cmd))

        process = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )

        print("RETURNCODE:", process.returncode)
        print("STDOUT:\n", process.stdout or "(vacío)")
        print("STDERR:\n", process.stderr or "(vacío)")

        if process.returncode != 0:
            raise Exception(process.stderr.strip() or process.stdout.strip() or "yt-dlp falló sin detalle")

        files = glob.glob(os.path.join(STORAGE_AUDIO, "*.mp3"))
        print("MP3 encontrados:", files)

        if not files:
            raise Exception("No se generó ningún audio mp3 en STORAGE_AUDIO")

        latest_file = max(files, key=os.path.getctime)
        print("Archivo final:", latest_file)

        return {
            "filePath": latest_file
        }

    except Exception as e:
        print(" ERROR EN download_audio:")
        print(str(e))
        print(traceback.format_exc())
        raise