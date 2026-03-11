from flask import Flask, request, jsonify, send_from_directory
from apps.worker.src.downloader import ytdlp_runner
from apps.worker.src.downloader import metadata
import traceback

app = Flask(__name__)

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static', 'favicon.png')

# ==========================
# ❌ ERROR HANDLER GLOBAL
# ==========================
@app.errorhandler(Exception)
def handle_exception(e):
    print(traceback.format_exc())
    return jsonify({"error": "Internal server error"}), 500


# ==========================
# 🔎 SEARCH
# ==========================
@app.route("/search", methods=["GET", "POST"])
def search():
    if request.method == "GET":
        query = request.args.get("q")
    else:
        query = request.json.get("query")

    if not query:
        return jsonify({"error": "No query"}), 400

    results = ytdlp_runner.search(query)
    return jsonify(results)


# ==========================
# 🎬 METADATA
# ==========================
@app.route("/metadata", methods=["POST"])
def meta():
    return jsonify(metadata.get_metadata(request.json["url"]))


# ==========================
# 🎬 STREAM URL
# ==========================
@app.route("/stream_url", methods=["POST"])
def stream_url():
    data = request.get_json()

    if not data or "url" not in data:
        return jsonify({"error": "Missing url"}), 400

    result = ytdlp_runner.stream_url(data)
    return jsonify(result)


# ==========================
# 🎥 DOWNLOAD VIDEO
# ==========================
@app.route("/download_video", methods=["POST"])
def download_video():
    result = ytdlp_runner.download_video(request.json)
    return jsonify(result)


# ==========================
# 🎵 DOWNLOAD AUDIO
# ==========================
@app.route("/download_audio", methods=["POST"])
def download_audio():
    result = ytdlp_runner.download_audio(request.json)
    return jsonify(result)


# ==========================
# 🚀 START SERVER
# ==========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)