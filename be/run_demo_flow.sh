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
  "overall_trust_score": 65,
  "per_goal_scores": [
    {
      "goal": "Reduce carbon emissions",
      "score": 75,
      "notes": "Reasonable Scope 1 & 2 reduction, but Scope 3 is missing."
    },
    {
      "goal": "No deforestation",
      "score": 50,
      "notes": "Relies on carbon offsets, which may involve deforestation risks."
    }
  ],
  "syntax_notes": "The report uses positive language but lacks detail in key areas.",
  "vulnerable_clauses": [
    {
      "clause_text": "Scope 3: Under evaluation",
      "vulnerability_score": 90,
      "notes": "Lack of Scope 3 data is a major omission.",
      "similar_bad_examples": [
        {
          "example_clause": "Scope 3 emissions are being assessed.",
          "source": "Numerous company ESG reports"
        }
      ]
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
  -d "{\"conversation_id\":\"${CONV_ID}\",\"clause_id\":\"clause_001\",\"message\":\"Please add specific Scope 3 reporting requirements with deadlines.\"}" | jq .

echo "== Chat: Resolve =="
curl -s -X POST "${BASE_URL}/v1/reviews/sessions/${SESSION_ID}/chat" \
  -H "Content-Type: application/json" \
  -d "{\"conversation_id\":\"${CONV_ID}\",\"clause_id\":\"clause_001\",\"message\":\"Mark this resolved.\"}" | jq .

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
