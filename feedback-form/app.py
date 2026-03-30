import os
import uuid
from datetime import datetime, timezone

from flask import Flask, request, jsonify
from google.cloud import bigquery

app = Flask(__name__)

Project_ID = os.getenv("PROJECT_ID", "ms-cc-benedict-college-chatbot")
Dataset_ID = os.getenv("DATASET_ID", "EduCyber_draft1_logs")
Table_ID = os.getenv("TABLE_ID", "EduCyber_draft1_logs_table")

client = bigquery.Client(project=Project_ID)

table_reference = f"{Project_ID}.{Dataset_ID}.{Table_ID}"


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response

@app.get("/health")
def health():
    return {
        "status": "ok",
        "time": datetime.now(timezone.utc).isoformat()
    }, 200

@app.route('/', methods=['GET'])
def home():
    return {"status": "API is running"}

@app.route("/submit-feedback", methods=["POST", "OPTIONS"])
def submit_feedback():
    if request.method == "OPTIONS":
        return "", 204

    data = request.get_json(silent=True) or {}
    
    helpfulness_score = data.get("helpfulness_score", data.get("helpfulnessScore"))
    guidance_style = data.get("guidance_style", data.get("guidanceStyle"))
    comment = data.get("comment")
    session_id = data.get("session_id", data.get("sessionId"))
    page_url = data.get("page_url", "")
    form_version = data.get("form_version", data.get("form_verision", "v1"))

    print("ENV VARS:", Project_ID, Dataset_ID, Table_ID, flush=True)
    print("TABLE REFERENCE BEING USED:", table_reference, flush=True)

    if session_id is None or helpfulness_score is None or guidance_style is None:
        return jsonify({"error": "Required fields are missing"}), 400
    
    helpfulness_score = int(helpfulness_score)
    if helpfulness_score < 1 or helpfulness_score > 5:
        return jsonify({"error": "Helpfulness score must be between 1 and 5"}), 400
    
    if isinstance(guidance_style, str) and guidance_style.lower() == "neutral":
        guidance_style = "neutral"

    if guidance_style not in ["Yes", "No", "neutral"]:
        return jsonify({"error": "Guidance style must be 'Yes', 'No', or 'neutral'"}), 400
    
    row = {
        "feedback_id": str(uuid.uuid4()),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "session_id": session_id,
        "helpfulness_score": helpfulness_score,
        "guidance_style": guidance_style,
        "comment": comment,
        "page_url": page_url,
        "form_version": form_version
    }

    errors = client.insert_rows_json(table_reference, [row])
    if errors:
        return jsonify({"error": "Failed to submit feedback, BigQuery insertion failed", "errors": errors}), 500

    return jsonify({"status": "success", "message": "Feedback submitted successfully"}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
