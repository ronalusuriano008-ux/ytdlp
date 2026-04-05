import os
import sys
import time
import uuid
import shutil
import subprocess
import requests

# ========================
# RUTAS
# ========================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))              # apps/worker/src/downloader
WORKER_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))   # apps/worker
SRC_DIR = os.path.join(WORKER_DIR, "src")

STORAGE_VIDEO = os.path.join(WORKER_DIR, "storage", "videos")
STORAGE_AUDIO = os.path.join(WORKER_DIR, "storage", "audio")
COOKIE_PATH = os.path.join(SRC_DIR, "cookies.txt")

os.makedirs(STORAGE_VIDEO, exist_ok=True)
os.makedirs(STORAGE_AUDIO, exist_ok=True)

# ========================
# CACHE 
# ========================

STREAM_CACHE = {}
STREAM_CACHE_TTL = 900  # 15 min

SEARCH_CACHE = {}
SEARCH_CACHE_TTL = 300  # 5 min
SEARCH_CACHE_MAX = 100

# ========================
# CONFIG BASE yt-dlp  
# ========================

COMMON = [
    "--force-ipv4",
    "--retries", "10",
    "--restrict-filenames"
]

if os.path.exists(COOKIE_PATH):
    COMMON = ["--cookies", COOKIE_PATH, *COMMON]

# ========================
# CONFIG YOUTUBEI 
# ========================

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
# HELPERS  GENERALES
# ========================

def log(*args):
    print("[ytdlp_runner]", *args, flush=True)


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


def ensure_url(data):
    url = str((data or {}).get("url", "")).strip()
    if not url:
        raise ValueError("Missing url")
    return url


def build_output_template(storage_dir, prefix):
    unique_id = uuid.uuid4().hex[:12]
    return os.path.join(storage_dir, f"{prefix}_{unique_id}.%(ext)s")


def find_generated_file(storage_dir, prefix):
    matches = [
        os.path.join(storage_dir, name)
        for name in os.listdir(storage_dir)
        if name.startswith(prefix + "_")
    ]

    if not matches:
        raise FileNotFoundError("No se generó ningún archivo")

    return max(matches, key=os.path.getctime)


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


def prune_stream_cache():
    now = time.time()
    expired_keys = [
        key for key, item in STREAM_CACHE.items()
        if now - item["time"] > STREAM_CACHE_TTL
    ]

    for key in expired_keys:
        STREAM_CACHE.pop(key, None)


# ========================
# HELPERS EJECUTABLES
# ========================

def get_ytdlp_cmd():
    return [sys.executable, "-m", "yt_dlp"]


def get_ffmpeg_path():
    return shutil.which("ffmpeg")


def get_ffprobe_path():
    return shutil.which("ffprobe")


def get_ffmpeg_location():
    ffmpeg_path = get_ffmpeg_path()
    if not ffmpeg_path:
        return None
    return os.path.dirname(ffmpeg_path)


def build_base_ytdlp_command():
    return [
        *get_ytdlp_cmd(),
        *COMMON,
        "--no-warnings",
        "--no-check-certificates"
    ]


def run_command(cmd, cwd=None, timeout=None):
    log("PYTHON:", sys.executable)
    log("FFMPEG:", get_ffmpeg_path())
    log("FFPROBE:", get_ffprobe_path())
    log("CMD:", cmd)
    log("CWD:", cwd)

    if cwd and not os.path.exists(cwd):
        raise FileNotFoundError(f"El directorio de trabajo no existe: {cwd}")

    process = subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout
    )

    log("RETURN CODE:", process.returncode)

    if process.stdout:
        log("STDOUT:", process.stdout[:4000])

    if process.stderr:
        log("STDERR:", process.stderr[:4000])

    return process


def raise_process_error(process, fallback_message):
    stderr = (process.stderr or "").strip()
    stdout = (process.stdout or "").strip()
    message = stderr or stdout or fallback_message
    raise Exception(message)


# ========================
# HELPERS SEARCH
# ========================

def parse_video_renderer(video):
    if not isinstance(video, dict):
        return None

    video_id = video.get("videoId")
    if not video_id:
        return None

    title = get_text(video.get("title")) or get_text(video.get("headline"))
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
        get_text(
            safe_get(
                video,
                "thumbnailOverlays",
                0,
                "thumbnailOverlayTimeStatusRenderer",
                "text"
            )
        ) or
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

        if "videoRenderer" in item:
            parsed = parse_video_renderer(item["videoRenderer"])
            if parsed:
                results.append(parsed)

        rich_video = safe_get(item, "richItemRenderer", "content", "videoRenderer")
        if isinstance(rich_video, dict):
            parsed = parse_video_renderer(rich_video)
            if parsed:
                results.append(parsed)

        nested_item_section = safe_get(item, "itemSectionRenderer", "contents", default=[])
        if isinstance(nested_item_section, list):
            extract_items_from_section_list(nested_item_section, results)

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
# SEARCH
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
# STREAM URL
# ========================

def stream_url(data):
    url = ensure_url(data)
    prune_stream_cache()

    cached = STREAM_CACHE.get(url)
    if cached and (time.time() - cached["time"] <= STREAM_CACHE_TTL):
        return {"directUrl": cached["value"]}

    cmd = [
        *build_base_ytdlp_command(),
        "--no-call-home",
        "--extractor-args", "youtube:player_client=android",
        "-f", "best",
        "-g",
        url
    ]

    process = run_command(cmd)

    if process.returncode != 0:
        raise_process_error(process, "No se pudo obtener directUrl")

    lines = [line.strip() for line in process.stdout.splitlines() if line.strip()]
    if not lines:
        raise Exception("yt-dlp no devolvió ninguna URL directa")

    direct_url = lines[0]

    STREAM_CACHE[url] = {
        "time": time.time(),
        "value": direct_url
    }

    return {
        "directUrl": direct_url
    }


# ========================
# DOWNLOAD VIDEO
# ========================

def download_video(data):
    url = ensure_url(data)
    prefix = f"video_{uuid.uuid4().hex[:10]}"
    output_template = build_output_template(STORAGE_VIDEO, prefix)

    cmd = [
        *build_base_ytdlp_command(),
        "--no-call-home",
        "--concurrent-fragments", "16",
        "--extractor-args", "youtube:player_client=android",
        "--merge-output-format", "mp4",
        "--remux-video", "mp4",
        "-f", "bv*+ba/bestvideo+bestaudio/best",
        "-o", output_template,
        url
    ]

    ffmpeg_location = get_ffmpeg_location()
    if ffmpeg_location:
        cmd.extend(["--ffmpeg-location", ffmpeg_location])
    else:
        log("Aviso: ffmpeg no encontrado. La mezcla/remux puede fallar.")

    process = run_command(cmd)

    if process.returncode != 0:
        raise_process_error(process, "No se pudo descargar el video")

    final_file = find_generated_file(STORAGE_VIDEO, prefix)

    return {
        "filePath": final_file,
        "filename": os.path.basename(final_file)
    }


# ========================
# DOWNLOAD AUDIO
# ========================

def download_audio(data):
    url = ensure_url(data)
    prefix = f"audio_{uuid.uuid4().hex[:10]}"
    output_template = build_output_template(STORAGE_AUDIO, prefix)

    ffmpeg_location = get_ffmpeg_location()
    if not ffmpeg_location:
        raise FileNotFoundError(
            "ffmpeg no está instalado o no está en PATH. Es necesario para convertir el audio a mp3."
        )

    cmd = [
        *build_base_ytdlp_command(),
        "--concurrent-fragments", "16",
        "--ffmpeg-location", ffmpeg_location,
        "-f", "bestaudio/best",
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "-o", output_template,
        url
    ]

    process = run_command(cmd)

    if process.returncode != 0:
        raise_process_error(process, "No se pudo descargar el audio")

    final_file = find_generated_file(STORAGE_AUDIO, prefix)

    return {
        "filePath": final_file,
        "filename": os.path.basename(final_file)
    }