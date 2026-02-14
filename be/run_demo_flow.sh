#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
SESSION_ID="${SESSION_ID:-sess_manual_001}"
CONV_ID="${CONV_ID:-conv_001}"

TMP_JSON="/tmp/envest_session_${SESSION_ID}.json"

echo "== Health =="
curl -s "${BASE_URL}/health" | jq .

echo "== Build Session Payload =="
cat > "${TMP_JSON}" <<JSON
{
  "session_id": "${SESSION_ID}",
  "company_name": "Acme Climate Tech",
  "doc_id": "doc_001",
  "doc_title": "Climate Contract v3",
  "full_document_text": "Original contract text for demo purposes.",
  "green_score": 72.5,
  "document_chunks": [
    {
      "chunk_id": "doc_001:c001",
      "text": "Supplier emissions reporting is annual and should include third-party verification.",
      "source_name": "Climate Contract v3",
      "citations": ["p12", "sec_4.2"]
    }
  ],
  "nitpicks": [
    {
      "issue_id": "issue_001",
      "title": "No annual scope-3 audit clause",
      "severity": "high",
      "status": "open",
      "summary": "Contract lacks mandatory third-party scope-3 audit language.",
      "citations": ["doc_001:c001"],
      "suggested_changes": ["Add annual third-party scope-3 audit requirement."]
    }
  ]
}
JSON

echo "== Start Session =="
curl -s -X POST "${BASE_URL}/v1/reviews/sessions/${SESSION_ID}/start" \
  -H "Content-Type: application/json" \
  --data @"${TMP_JSON}" | jq .

echo "== Chat: Request Changes =="
curl -s -X POST "${BASE_URL}/v1/reviews/sessions/${SESSION_ID}/chat" \
  -H "Content-Type: application/json" \
  -d "{\"conversation_id\":\"${CONV_ID}\",\"issue_id\":\"issue_001\",\"message\":\"Please add stricter annual scope-3 audit language with a due date.\"}" | jq .

echo "== Chat: Resolve =="
curl -s -X POST "${BASE_URL}/v1/reviews/sessions/${SESSION_ID}/chat" \
  -H "Content-Type: application/json" \
  -d "{\"conversation_id\":\"${CONV_ID}\",\"issue_id\":\"issue_001\",\"message\":\"Mark this resolved.\"}" | jq .

echo "== Generate Cleanup Artifacts =="
curl -s -X POST "${BASE_URL}/v1/reviews/sessions/${SESSION_ID}/cleanup/generate" \
  -H "Content-Type: application/json" \
  -d '{"confirmed":true,"investor_note":"Proceed with requested edits."}' | jq .

echo "== Get Artifacts =="
ARTIFACTS_JSON=$(curl -s "${BASE_URL}/v1/reviews/sessions/${SESSION_ID}/artifacts")
echo "${ARTIFACTS_JSON}" | jq .

echo "== Local Files =="
PDF_PATH=$(echo "${ARTIFACTS_JSON}" | jq -r '.artifact_paths.revised_pdf_path // empty')
TXT_PATH=$(echo "${ARTIFACTS_JSON}" | jq -r '.artifact_paths.revised_text_path // empty')
EMAIL_PATH=$(echo "${ARTIFACTS_JSON}" | jq -r '.artifact_paths.investor_email_path // empty')

for p in "$PDF_PATH" "$TXT_PATH" "$EMAIL_PATH"; do
  if [[ -n "$p" ]]; then
    if [[ -f "$p" ]]; then
      echo "OK: $p"
    else
      echo "MISSING: $p"
    fi
  fi
done

echo "Demo flow complete for session: ${SESSION_ID}"
