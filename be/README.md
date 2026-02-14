# Envest Backend (MVP Scaffold)

Backend scaffold for a document + conversation RAG system using Actian VectorAI DB.

## Quick Start

1. Create a virtual env and install deps:
   ```bash
   python3.11 -m venv .venv
   .venv/bin/pip install -r be/requirements.txt
   .venv/bin/pip install ./actiancortex-0.1.0b1-py3-none-any.whl
   ```
2. Copy env file:
   ```bash
   cp be/.env.example be/.env
   ```
3. Start API:
   ```bash
   uvicorn app.main:app --reload --app-dir be
   ```

## Initial Endpoints

- `GET /health`
- `POST /v1/documents/upload` (stub)
- `POST /v1/chat` (stub)

## Folder Map

- `app/core`: settings + app logging
- `app/api`: route registration and handlers
- `app/services`: vector store / parser / embeddings / RAG orchestration
- `app/db`: SQLAlchemy base/session/models
- `app/models`: request/response schemas
- `tests`: backend tests
