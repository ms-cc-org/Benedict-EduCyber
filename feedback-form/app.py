import os
import uuid
import hashlib
from datetime import datetime, timezone

from flask import Flask, request, jsonify
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from google.cloud import bigquery

app = Flask(__name__)

Project_ID = os.getenv("PROJECT_ID", "ms-cc-benedict-college-chatbot")
Dataset_ID = os.getenv("DATASET_ID", "EduCyber_draft1_logs")
Table_ID = os.getenv("TABLE_ID", "EduCyber_draft1_logs_table")
Frontend_OAuth_Client_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
Allowed_Origins = {
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5500,http://127.0.0.1:5500"
    ).split(",")
    if origin.strip()
}
Pseudonym_Salt = os.getenv("PSEUDONYM_SALT", "dev-only-change-me")

client = bigquery.Client(project=Project_ID)

table_reference = f"{Project_ID}.{Dataset_ID}.{Table_ID}"


def get_request_origin():
    return request.headers.get("Origin", "")


def is_allowed_origin(origin):
    return origin in Allowed_Origins


def apply_cors_headers(response):
    origin = get_request_origin()
    if is_allowed_origin(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"

    response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


def hash_google_subject(subject):
    return hashlib.sha256(f"{subject}:{Pseudonym_Salt}".encode("utf-8")).hexdigest()


def verify_google_identity_token():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise ValueError("Missing bearer token")

    if not Frontend_OAuth_Client_ID:
        raise RuntimeError("GOOGLE_OAUTH_CLIENT_ID is not configured on the server")

    token = auth_header.split(" ", 1)[1].strip()
    token_info = id_token.verify_oauth2_token(
        token,
        google_requests.Request(),
        Frontend_OAuth_Client_ID
    )

    if token_info.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise ValueError("Invalid token issuer")

    if not token_info.get("sub"):
        raise ValueError("Token missing user subject")

    return token_info


@app.after_request
def add_cors_headers(response):
    return apply_cors_headers(response)

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
        if not is_allowed_origin(get_request_origin()):
            return jsonify({"error": "Origin not allowed"}), 403
        return "", 204

    if not is_allowed_origin(get_request_origin()):
        return jsonify({"error": "Origin not allowed"}), 403

    try:
        token_info = verify_google_identity_token()
    except RuntimeError as error:
        return jsonify({"error": str(error)}), 500
    except ValueError as error:
        return jsonify({"error": f"Authentication failed: {error}"}), 401

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
        "form_version": form_version,
        "auth_status": "verified",
        "auth_provider": "google",
        "google_sub_hash": hash_google_subject(token_info["sub"]),
        "user_domain": token_info.get("hd", ""),
        "identity_verified_at": datetime.now(timezone.utc).isoformat()
    }

    errors = client.insert_rows_json(table_reference, [row])
    if errors:
        return jsonify({"error": "Failed to submit feedback, BigQuery insertion failed", "errors": errors}), 500

    return jsonify({"status": "success", "message": "Feedback submitted successfully"}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
