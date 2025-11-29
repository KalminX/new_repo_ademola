from flask import Flask, render_template, request, jsonify
import docker
import os

app = Flask(__name__)

# ----------------------------------------------------
# Config
# ----------------------------------------------------
CONTAINER_NAME = os.getenv("CONTAINER_NAME", "centron-bot")
docker_client = docker.from_env()

# ----------------------------------------------------
# Helpers
# ----------------------------------------------------
def get_docker_logs(container_name, lines=50):
    try:
        container = docker_client.containers.get(container_name)
        logs = container.logs(tail=lines).decode("utf-8").strip().splitlines()
        return logs
    except docker.errors.NotFound:
        return [f"❌ Container '{container_name}' not found."]
    except Exception as e:
        return [f"⚠️ Error fetching logs: {str(e)}"]

@app.before_request
def show_request_info():
    print("👉 Request path:", request.path)

# ----------------------------------------------------
# Routes
# ----------------------------------------------------
@app.route("/logs/")
def logs_page():
    """Render the logs viewer page."""
    limit = request.args.get("limit", 50, type=int)
    logs = get_docker_logs(CONTAINER_NAME, limit)
    return render_template("logs.html", logs=logs, limit=limit, container=CONTAINER_NAME)

@app.route("/logs/api")
def logs_api():
    """Return JSON logs for AJAX auto-refresh."""
    limit = request.args.get("limit", 50, type=int)
    logs = get_docker_logs(CONTAINER_NAME, limit)
    return jsonify({"logs": logs})

# ----------------------------------------------------
# Main entry
# ----------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

