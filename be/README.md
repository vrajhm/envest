# Envest RAG Backend (MVP)

## Setup

1. Create environment and install dependencies:
   ```bash
   python3.11 -m venv .venv
   .venv/bin/pip install -r be/requirements.txt
   .venv/bin/pip install ./actiancortex-0.1.0b1-py3-none-any.whl
   ```
2. Configure env:
   ```bash
   cp be/.env.example be/.env
   ```
   Set `GEMINI_API_KEY` in `be/.env`.
   If Actian gRPC is unstable on your machine, set:
   - `VECTOR_BACKEND=memory`
   - or keep `VECTOR_BACKEND=actian` with `VECTOR_AUTO_FALLBACK_MEMORY=true`
3. Run API:
   ```bash
   uvicorn app.main:app --reload --app-dir be
   ```

## Current endpoints

- `GET /health`
- `POST /v1/reviews/sessions/{session_id}/start`
- `GET /v1/reviews/sessions/{session_id}`
- `POST /v1/reviews/sessions/{session_id}/chat`
- `POST /v1/reviews/sessions/{session_id}/cleanup/generate`
- `GET /v1/reviews/sessions/{session_id}/artifacts`

## Preflight Check

```bash
curl -s http://127.0.0.1:8000/health | jq
```

Look for:
- `vector_backend` (`actian` or `memory`)
- `vector_db` not `client_missing`
- `embedding_configured: true` (or fallback mode for local testing)
- `gemini_configured: true` (or fallback mode for local testing)

## End-to-End Demo Flow

### 1) Start session with precomputed input

```bash
cat > /tmp/envest_session.json <<'EOF'
{
  "session_id": "sess_demo_001",
  "company_name": "Acme Climate Tech",
  "doc_id": "doc_001",
  "doc_title": "Climate Contract v3",
  "full_document_text": "This is the original contract text. Emissions reporting is annual.",
  "green_score": 72.5,
  "document_chunks": [
    {
      "chunk_id": "doc_001:c001",
      "text": "Supplier emissions reporting is annual...",
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
EOF

curl -s -X POST "http://127.0.0.1:8000/v1/reviews/sessions/sess_demo_001/start" \
  -H "Content-Type: application/json" \
  --data @/tmp/envest_session.json | jq
```

### 2) Chat and request edits

```bash
curl -s -X POST "http://127.0.0.1:8000/v1/reviews/sessions/sess_demo_001/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "conv_001",
    "issue_id": "issue_001",
    "message": "Please add stricter annual scope-3 audit language with a due date."
  }' | jq
```

### 3) Confirm and resolve in chat

```bash
curl -s -X POST "http://127.0.0.1:8000/v1/reviews/sessions/sess_demo_001/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "conv_001",
    "issue_id": "issue_001",
    "message": "Mark this resolved."
  }' | jq
```

### 4) Generate cleanup artifacts

```bash
curl -s -X POST "http://127.0.0.1:8000/v1/reviews/sessions/sess_demo_001/cleanup/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmed": true,
    "investor_note": "Proceed with requested language updates."
  }' | jq
```

### 5) Retrieve artifact paths

```bash
curl -s "http://127.0.0.1:8000/v1/reviews/sessions/sess_demo_001/artifacts" | jq
```

Artifacts are saved to:
- `be/artifacts/sess_demo_001/revised_document.txt`
- `be/artifacts/sess_demo_001/revised_document.pdf`
- `be/artifacts/sess_demo_001/investor_email.txt`
