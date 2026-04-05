import os
import traceback
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.exceptions import HTTPException

from apps.worker.src.downloader import ytdlp_runner
from apps.worker.src.downloader import metadata

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "..", "static")
STATIC_DIR = os.path.abspath(STATIC_DIR)

HOST = os.getenv("WORKER_HOST", "0.0.0.0")
PORT = int(os.getenv("WORKER_PORT", "5000"))
ENV = os.getenv("WORKER_ENV", "development").lower()
DEBUG = ENV == "development"

app = Flask(__name__)


@app.route("/favicon.ico")
def favicon():
    return send_from_directory(STATIC_DIR, "favicon.png")


# ==========================
# HEALTH CHECK 
# ==========================
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "ok": True,
        "service": "worker",
        "env": ENV
    }), 200


# ==========================
# SEARCH VIDEOS
# ==========================
@app.route("/search", methods=["GET", "POST"])
def search():
    query = None

    if request.method == "GET":
        query = request.args.get("q", "").strip()
    else:
        data = request.get_json(silent=True) or {}
        query = str(data.get("query", "")).strip()

    if not query:
        return jsonify({
            "ok": False,
            "error": "No query provided"
        }), 400

    results = ytdlp_runner.search(query)

    return jsonify({
        "ok": True,
        "results": results
    }), 200


# ==========================
# METADATA EXTRACTION
# ==========================
@app.route("/metadata", methods=["POST"])
def meta():
    data = request.get_json(silent=True) or {}
    url = str(data.get("url", "")).strip()

    if not url:
        return jsonify({
            "ok": False,
            "error": "Missing url"
        }), 400

    result = metadata.get_metadata(url)

    return jsonify({
        "ok": True,
        "data": result
    }), 200


# ==========================
# STREAM URL EXTRACTION
# ==========================
@app.route("/stream_url", methods=["POST"])
def stream_url():
    data = request.get_json(silent=True) or {}
    url = str(data.get("url", "")).strip()

    if not url:
        return jsonify({
            "ok": False,
            "error": "Missing url"
        }), 400

    result = ytdlp_runner.stream_url(data)

    return jsonify({
        "ok": True,
        "data": result
    }), 200


# ==========================
# DOWNLOAD VIDEO 
# ==========================
@app.route("/download_video", methods=["POST"])
def download_video():
    data = request.get_json(silent=True) or {}

    if not data:
        return jsonify({
            "ok": False,
            "error": "Missing request body"
        }), 400

    result = ytdlp_runner.download_video(data)

    return jsonify({
        "ok": True,
        "data": result
    }), 200


# ==========================
# DOWNLOAD AUDIO
# ==========================
@app.route("/download_audio", methods=["POST"])
def download_audio():
    data = request.get_json(silent=True) or {}

    if not data:
        return jsonify({
            "ok": False,
            "error": "Missing request body"
        }), 400

    result = ytdlp_runner.download_audio(data)

    return jsonify({
        "ok": True,
        "data": result
    }), 200


# ==========================
# 404 
# ==========================
@app.errorhandler(404)
def not_found(_e):
    return jsonify({
        "ok": False,
        "error": "Route not found"
    }), 404


# ==========================
# GLOBAL ERROR HANDLER
# ==========================
@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        return jsonify({
            "ok": False,
            "error": e.description
        }), e.code

    if DEBUG:
        print(traceback.format_exc())
    else:
        print(f"[WORKER ERROR] {str(e)}")

    return jsonify({
        "ok": False,
        "error": "Internal server error"
    }), 500


# ==========================
# START SERVER 
# ==========================
if __name__ == "__main__":
    print(f"Worker corriendo en {HOST}:{PORT} | env={ENV}")
    app.run(host=HOST, port=PORT, debug=False)