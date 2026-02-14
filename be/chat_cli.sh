#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
SESSION_ID="${SESSION_ID:-sess_cli_001}"
CONVERSATION_ID="${CONVERSATION_ID:-conv_cli_001}"
CLAUSE_ID="${CLAUSE_ID:-clause_001}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required. Install with: brew install jq"
  exit 1
fi

health() {
  curl -s "${BASE_URL}/health" | jq .
}

start_mock_session() {
  local payload
  payload="$(cat <<'JSON'
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
  "syntax_notes": "The report uses positive language but lacks detail in key areas like Scope 3 emissions and offset project specifics.",
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
)"

  local response
  response="$(curl -s -w '\n%{http_code}' -X POST \
    "${BASE_URL}/v1/reviews/sessions/${SESSION_ID}/start" \
    -H "Content-Type: application/json" \
    -d "${payload}")"

  local code
  code="$(echo "${response}" | tail -n1)"
  local body
  body="$(echo "${response}" | sed '$d')"

  if [[ "${code}" == "200" ]]; then
    echo "${body}" | jq .
    return
  fi

  if [[ "${code}" == "409" ]]; then
    echo "Session already exists: ${SESSION_ID}"
    return
  fi

  echo "Failed to start session (HTTP ${code}):"
  echo "${body}" | jq . 2>/dev/null || echo "${body}"
  exit 1
}

show_session() {
  curl -s "${BASE_URL}/v1/reviews/sessions/${SESSION_ID}" | jq .
}

send_message() {
  local message="$1"
  curl -s -X POST "${BASE_URL}/v1/reviews/sessions/${SESSION_ID}/chat" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg conversation_id "${CONVERSATION_ID}" \
      --arg clause_id "${CLAUSE_ID}" \
      --arg message "${message}" \
      '{conversation_id: $conversation_id, clause_id: $clause_id, message: $message}')" | jq .
}

generate_cleanup() {
  curl -s -X POST "${BASE_URL}/v1/reviews/sessions/${SESSION_ID}/cleanup/generate" \
    -H "Content-Type: application/json" \
    -d '{"confirmed": true, "investor_note": "Approved for demo."}' | jq .
}

show_artifacts() {
  curl -s "${BASE_URL}/v1/reviews/sessions/${SESSION_ID}/artifacts" | jq .
}

print_help() {
  cat <<EOF
Commands:
  /help                 Show commands
  /health               Show backend health
  /status               Show full session state
  /clause <clause_id>   Set active clause id (current: ${CLAUSE_ID})
  /resolve              Send "Mark this resolved."
  /cleanup              Generate revised text/pdf + investor email
  /artifacts            Show artifact paths and existence
  /exit                 Exit CLI

Any other text is sent as a chat message.
EOF
}

echo "== Envest Chat CLI =="
echo "BASE_URL=${BASE_URL}"
echo "SESSION_ID=${SESSION_ID}"
echo "CONVERSATION_ID=${CONVERSATION_ID}"
echo "CLAUSE_ID=${CLAUSE_ID}"
echo

echo "Checking health..."
health
echo

echo "Bootstrapping mock session..."
start_mock_session
echo

print_help
echo

while true; do
  printf "you> "
  if ! IFS= read -r line; then
    echo
    break
  fi

  case "${line}" in
    "/help")
      print_help
      ;;
    "/health")
      health
      ;;
    "/status")
      show_session
      ;;
    "/resolve")
      send_message "Mark this resolved."
      ;;
    "/cleanup")
      generate_cleanup
      ;;
    "/artifacts")
      show_artifacts
      ;;
    "/exit")
      break
      ;;
    /clause\ *)
      next_clause="$(echo "${line}" | cut -d' ' -f2-)"
      if [[ -z "${next_clause}" ]]; then
        echo "Usage: /clause <clause_id>"
      else
        CLAUSE_ID="${next_clause}"
        echo "Active clause_id set to: ${CLAUSE_ID}"
      fi
      ;;
    "")
      ;;
    *)
      send_message "${line}"
      ;;
  esac
done

echo "Goodbye."
