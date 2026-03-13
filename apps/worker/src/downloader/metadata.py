import json
import subprocess


def get_metadata(url):
    url = str(url or "").strip()

    if not url:
        raise ValueError("Missing url")

    cmd = [
        "yt-dlp",
        "--skip-download",
        "--no-playlist",
        "--no-warnings",
        "--no-call-home",
        "--extractor-args", "youtube:player_client=android",
        "-J",
        url
    ]

    process = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace"
    )

    if process.returncode != 0:
        raise Exception(process.stderr.strip() or "yt-dlp failed")

    if not process.stdout.strip():
        raise Exception("Empty response from yt-dlp")

    try:
        data = json.loads(process.stdout)
    except json.JSONDecodeError as err:
        raise Exception("Invalid JSON from yt-dlp") from err

    formats = []

    for f in data.get("formats", []):
        if not isinstance(f, dict):
            continue

        vcodec = f.get("vcodec")
        acodec = f.get("acodec")

        # Ignorar formatos sin video
        if vcodec == "none":
            continue

        formats.append({
            "format_id": f.get("format_id"),
            "format_note": f.get("format_note"),
            "ext": f.get("ext"),
            "resolution": f.get("resolution"),
            "height": f.get("height"),
            "width": f.get("width"),
            "fps": f.get("fps"),
            "filesize": f.get("filesize") or f.get("filesize_approx"),
            "video_codec": vcodec,
            "audio_codec": acodec,
            "has_audio": acodec not in (None, "none"),
            "has_video": vcodec not in (None, "none")
        })

    return {
        "id": data.get("id"),
        "title": data.get("title"),
        "webpage_url": data.get("webpage_url") or url,
        "duration": data.get("duration"),
        "thumbnail": data.get("thumbnail"),
        "uploader": data.get("uploader"),
        "channel": data.get("channel"),
        "ext": data.get("ext"),
        "formats": formats
    }