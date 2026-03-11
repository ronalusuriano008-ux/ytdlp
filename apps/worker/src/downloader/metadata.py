import subprocess
import json


def get_metadata(url):

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

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    stdout, stderr = process.communicate()

    # 🔴 Error yt-dlp
    if process.returncode != 0:
        print("yt-dlp error:", stderr)
        return {"error": "yt-dlp failed"}

    if not stdout:
        return {"error": "Empty response from yt-dlp"}

    try:
        data = json.loads(stdout)
    except json.JSONDecodeError:
        return {"error": "Invalid JSON from yt-dlp"}

    formats = []

    for f in data.get("formats", []):

        # solo video
        if f.get("vcodec") == "none":
            continue

        formats.append({
            "format_id": f.get("format_id"),
            "format_note": f.get("format_note"),
            "ext": f.get("ext"),
            "url": f.get("url")
        })

    return {
        "title": data.get("title"),
        "formats": formats
    }