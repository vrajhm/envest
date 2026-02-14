# Envest BE Progress Log

Purpose: track what has been implemented so far for the RAG review backend.

## Step 1 Completed: Core Scaffold + Session Ingestion

Implemented:
- Recreated a minimal backend scaffold under `be/app`.
- Added environment-driven config and secrets setup.
- Added `be/.env.example` with required keys/settings:
  - VectorDB connection and collection names
  - Gemini model + API key placeholders
  - Embedding and artifact settings
- Added base app startup/shutdown wiring with lifespan in `be/app/main.py`.
- Added health endpoint:
  - `GET /health`
- Added session ingestion/start endpoint (upstream integration point):
  - `POST /v1/reviews/sessions/{session_id}/start`
- Added session retrieval endpoint:
  - `GET /v1/reviews/sessions/{session_id}`
- Added request/response schemas for precomputed input contract:
  - includes `full_document_text`, `green_score`, `document_chunks`, and `nitpicks`
- Added VectorDB service wrapper with:
  - collection ensure/bootstrap
  - review session upsert/get
  - batch upsert for document chunks
  - batch upsert for nitpick issues
- Added deterministic embedding placeholder service for MVP plumbing.
- Added session service with:
  - `session_id` path/body consistency checks
  - idempotency behavior (`409` unless `force=true`)
  - citation sanitization against known chunk IDs
  - persistence of session/chunk/nitpick records
- Updated `.gitignore` for artifacts/cache paths.
- Added test suite for Step 1 endpoints:
  - `be/tests/test_health.py`
  - `be/tests/test_reviews.py`

Validation:
- Compile checks passed for `be/app` and `be/tests`.
- Tests passed for health/start/get session flows.

## Step 2 Completed: Chat Loop + Status Inference + Turn Persistence

Implemented:
- Added chat endpoint:
  - `POST /v1/reviews/sessions/{session_id}/chat`
- Added Gemini service wrapper in `be/app/services/gemini_service.py`.
- Added chat orchestration service in `be/app/services/chat_service.py`.
- Added chat models:
  - `ChatRequest`
  - `ChatResponse`
  - `IssueStatusUpdate`
- Expanded nitpick status model to support:
  - `open`
  - `in_progress`
  - `resolved`
- Implemented status inference behavior from investor chat text:
  - soft approval/edit intent -> `in_progress`
  - explicit confirmation intent -> `resolved`
  - reopen/edit-after-resolve intent -> reopens issue (`open`/`in_progress`)
- Added `pending_resolution_issue_id` tracking in session state.
- Extended VectorDB service with:
  - single issue upsert
  - conversation turn upsert
- Persisted chat artifacts on each turn:
  - user turn in `conversation_turns`
  - assistant turn in `conversation_turns`
  - updated issue payloads in `nitpick_issues`
  - updated session record in `review_sessions`
- Added chat endpoint test:
  - `be/tests/test_chat.py`
- Updated `be/README.md` endpoint list to include chat.

Validation:
- Compile checks passed.
- Test suite passed with chat included (`4 passed`).

## Current Implemented API Surface

- `GET /health`
- `POST /v1/reviews/sessions/{session_id}/start`
- `GET /v1/reviews/sessions/{session_id}`
- `POST /v1/reviews/sessions/{session_id}/chat`

## Notes

- Embeddings currently use a deterministic placeholder implementation for plumbing.
- Gemini service falls back to a local response if API key/client is unavailable.
- VectorDB runtime requires the Actian client wheel to be installed:
  - `pip install ./actiancortex-0.1.0b1-py3-none-any.whl`

## Next Planned Step

- Implement cleanup generation endpoint and artifacts:
  - `POST /v1/reviews/sessions/{session_id}/cleanup/generate`
  - `GET /v1/reviews/sessions/{session_id}/artifacts`
- Generate and persist:
  - revised document PDF under `be/artifacts/{session_id}/`
  - plain-text investor email summary
