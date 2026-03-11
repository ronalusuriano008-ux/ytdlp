import subprocess, json

def get_metadata(url):

    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--skip-download",
        "--extractor-args", "youtube:player_client=web",
        "-J",
        url
    ]

    p = subprocess.run(cmd, capture_output=True, text=True)

    # 🔥 Si yt-dlp falla
    if p.returncode != 0:
        print("yt-dlp error:", p.stderr)
        return {"error": "yt-dlp failed"}

    if not p.stdout:
        return {"error": "Empty response from yt-dlp"}

    data = json.loads(p.stdout)

    formats = []

    for f in data.get("formats", []):
        if f.get("vcodec") != "none":
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