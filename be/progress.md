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

## Step 3 Completed: Runtime Preflight and Readiness Visibility

Implemented:
- Added explicit preflight/readiness metadata to `GET /health`:
  - `vector_client_installed`
  - `gemini_configured`
  - `gemini_model`
  - `details` (last known vector/gemini errors)
- Added VectorDB runtime checks in `VectorStoreService`:
  - client install detection
  - connection/error tracking (`last_error`)
  - `ping()` health probe support
- Added Gemini readiness tracking in `GeminiService`:
  - configured/fallback status
  - last-error diagnostics
- Updated app startup logs (`lifespan`) to emit preflight status for:
  - VectorDB connectivity/collection readiness
  - Gemini configured vs fallback mode
- Updated health endpoint test assertions for the expanded response payload.

Validation:
- Compile checks passed.
- Test suite passed (`4 passed`) after preflight changes.

## Step 4 Completed: Cleanup Generation + Artifact Retrieval

Implemented:
- Added cleanup generation service in `be/app/services/cleanup_service.py`.
- Added cleanup endpoint:
  - `POST /v1/reviews/sessions/{session_id}/cleanup/generate`
- Added artifact retrieval endpoint:
  - `GET /v1/reviews/sessions/{session_id}/artifacts`
- Added cleanup/artifact schemas:
  - `CleanupGenerateRequest`
  - `CleanupGenerateResponse`
  - `SessionArtifactsResponse`
- Cleanup flow now:
  - loads session state
  - uses accepted issue instructions (fallback to suggested changes when needed)
  - generates revised document text via Gemini (with fallback behavior)
  - generates plain-text investor email via Gemini (with fallback behavior)
  - saves artifacts locally under `be/artifacts/{session_id}/`:
    - `revised_document.txt`
    - `revised_document.pdf`
    - `investor_email.txt`
  - persists artifact paths in `review_sessions`
  - marks session status as `completed`
- Added PDF generation using `reportlab` with simple line wrapping/pagination.
- Wired `CleanupService` into dependency container and API dependency injection.
- Updated `be/README.md` endpoint list for cleanup/artifacts.
- Added endpoint tests:
  - `be/tests/test_cleanup.py`

Validation:
- Compile checks passed.
- Test suite passed with cleanup endpoints included (`6 passed`).

## Step 5 Completed: Real Embedding Provider + Demo Runbook

Implemented:
- Replaced deterministic-only embedding flow with Google AI Studio embedding integration in `be/app/services/embeddings.py`.
- Added real embedding call path using:
  - model from env (`EMBEDDING_MODEL`, default `text-embedding-004`)
  - output dimensionality from env (`EMBEDDING_DIM`, default `768`)
- Kept deterministic fallback behavior when:
  - `google-genai` is unavailable
  - `GEMINI_API_KEY` is missing
  - provider request fails
- Added embedding readiness metadata to `GET /health`:
  - `embedding_configured`
  - `embedding_model`
  - `details.embedding_last_error`
- Added startup preflight log line for embedding provider status.
- Added service-level integration test for local artifact generation:
  - `be/tests/test_cleanup_service_integration.py`
  - validates PDF/text/email files are created under local artifacts directory
  - validates session artifact paths/status are persisted
- Expanded `be/README.md` with a full cURL demo flow:
  - preflight health check
  - session start
  - chat edit loop
  - cleanup generation
  - artifact retrieval

Validation:
- Compile checks passed.
- Test suite passed with integration test included (`7 passed`).

## Step 6 Attempted: Live End-to-End Run Against Real Services

Implemented/Executed:
- Installed Actian client wheel into project venv.
- Ran API with real `be/.env` configuration.
- Executed live endpoint sequence:
  - `GET /health`
  - `POST /v1/reviews/sessions/{session_id}/start`
  - `POST /v1/reviews/sessions/{session_id}/chat`
  - `POST /v1/reviews/sessions/{session_id}/cleanup/generate`
  - `GET /v1/reviews/sessions/{session_id}/artifacts`
- Captured transcript in:
  - `be/demo_transcript.md`

Observed result:
- `/health` responds and reports:
  - vector client installed
  - embeddings configured
  - gemini configured
  - `vector_db: unreachable`
- All stateful endpoints currently fail with `500` because VectorDB gRPC calls fail with:
  - `AioRpcError`
  - `StatusCode.UNAVAILABLE`
  - `ipv4:127.0.0.1:50051: FD shutdown`

Status:
- API implementation is complete for the planned flow.
- Live E2E is blocked by current VectorDB runtime instability in this environment.

## Current Implemented API Surface

- `GET /health`
- `POST /v1/reviews/sessions/{session_id}/start`
- `GET /v1/reviews/sessions/{session_id}`
- `POST /v1/reviews/sessions/{session_id}/chat`
- `POST /v1/reviews/sessions/{session_id}/cleanup/generate`
- `GET /v1/reviews/sessions/{session_id}/artifacts`

## Notes

- Embeddings use Google AI Studio when configured, with deterministic fallback when unavailable.
- Gemini service falls back to a local response if API key/client is unavailable.
- VectorDB runtime requires the Actian client wheel to be installed:
  - `pip install ./actiancortex-0.1.0b1-py3-none-any.whl`

## Next Planned Step

- Stabilize/replace VectorDB runtime so gRPC operations (`health_check`, `get`, `upsert`) succeed.
- Re-run live transcript to validate full success path (start -> chat -> cleanup -> artifacts).
- Optional: add manual PATCH endpoint for issue status override (`/nitpicks/{issue_id}`) if needed for UI controls.
