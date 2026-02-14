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
3. Run API:
   ```bash
   uvicorn app.main:app --reload --app-dir be
   ```

## Current endpoints

- `GET /health`
- `POST /v1/reviews/sessions/{session_id}/start`
- `GET /v1/reviews/sessions/{session_id}`
- `POST /v1/reviews/sessions/{session_id}/chat`
