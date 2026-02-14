# RAG Agent Plan (Investor Review Stage Only)

Status: Finalized planning doc (no implementation yet).

## Scope Boundary
The RAG agent does **not** perform:
- document parsing
- chunking
- nitpick generation
- green score computation

These are completed upstream before the agent starts.

## Locked Decisions
1. LLM provider/model: **Gemini 3 Flash**.
2. State store for MVP: **VectorDB only** (no relational DB).
3. Issue resolution: infer from investor chat text (no mandatory explicit resolve button).
4. Cleanup generation gate: investor can generate even if some issues remain unresolved.
5. Output artifacts after investor confirmation:
   - updated document as PDF
   - plain-text sample email to startup/company
6. Auth: not required for hackathon MVP.
7. Gemini access mode: **Google AI Studio API key**.
8. Embedding dimension for MVP: **768**.
9. Request/input payload size limits: **none for MVP**.
10. Secrets and runtime config: environment variables only (no hardcoded keys/tokens).
11. Artifact retention: local artifacts persist indefinitely for MVP.

## Agent Input (Precomputed)
The agent receives precomputed context and only runs review + resolution workflow.
An upstream parsing/analysis agent sends this data into the review system.

### Required Upstream Ingestion Endpoint
The backend must expose:
- `POST /v1/reviews/sessions/{session_id}/start`

This endpoint is the integration point where the upstream agent provides:
1. document data (`doc_id`, `doc_title`, `full_document_text`, `document_chunks`)
2. precomputed `green_score`
3. pre-formulated `nitpicks`

This endpoint should be called first before any review chat operations.

### Canonical Input JSON Shape
This is the approved request contract for session start.

```json
{
  "session_id": "sess_001",
  "company_name": "Acme Climate Tech",
  "doc_id": "doc_001",
  "doc_title": "Climate Contract v3",
  "full_document_text": "Full upstream-provided document text goes here...",
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
      "citations": ["doc_001:c001", "doc_001:c004"],
      "suggested_changes": [
        "Add annual third-party scope-3 audit requirement."
      ]
    }
  ]
}
```

## Objective
Present precomputed findings to the investor, help them review and resolve nitpicks via chat, and ask whether to generate a cleaned-up document when they are satisfied.

## Collection Design (VectorDB Only)

### 1) `review_sessions`
Purpose:
- one record per review session
- fast load of top-level context and workflow state

Stores:
- session/company/doc metadata
- `green_score`
- session status (`active|ready_for_cleanup|completed`)
- high-level counters/flags

### 2) `document_chunks`
Purpose:
- retrieval evidence for grounded responses

Stores:
- chunk text + metadata + citations
- embeddings for semantic retrieval

### 3) `nitpick_issues`
Purpose:
- issue workflow state per nitpick

Stores:
- title, severity, summary, citations, suggested changes
- status (`open|resolved`)
- accepted investor instructions

### 4) `conversation_turns`
Purpose:
- chat memory + investor intent history

Stores:
- user/assistant turns
- linked issue (optional)
- inferred resolution actions and citations

## LLM Usage
Gemini 3 Flash is used for:
- citation-grounded investor chat responses
- suggestion/edit drafting for nitpick resolution
- cleaned-up document drafting
- plain-text investor email drafting
Gemini API authentication is provided via Google AI Studio API key from environment variables.

## Workflow

### Step 1: Session Start
Show investor:
- company/document
- precomputed `green_score`
- nitpicks with severity/status
- evidence references

### Step 2: Review Loop (Chat)
Investor can:
- approve suggestions
- reject suggestions
- provide custom edits
- ask follow-ups
- indicate they are fine leaving some issues unresolved

Agent behavior:
- infer issue status changes from investor text
- update issue states and accepted instructions
- maintain running resolved/unresolved summary

### Step 3: Satisfaction Check
When investor signals they are done, ask:
- "Do you want me to generate a cleaned-up version of the document with the accepted changes?"

Important:
- do **not** enforce all issues as resolved
- investor decision is final gate for generation

### Step 4: Generate Artifacts
If investor confirms:
1. produce cleaned-up document text from accepted changes
2. export/save cleaned-up document as PDF
3. generate plain-text sample email summarizing requested changes before investment
4. return change log (nitpick -> applied update)

If investor declines:
- keep session as reviewed without artifact generation

## Minimal State Fields

### Review Session
- `session_id`
- `company_name`
- `doc_id`
- `green_score`
- `status` (`active|ready_for_cleanup|completed`)

### Nitpick Issue
- `issue_id`
- `session_id`
- `title`
- `severity` (`high|medium|low`)
- `status` (`open|resolved`)
- `summary`
- `citations[]`
- `suggested_changes[]`
- `accepted_change_instructions`

### Conversation Turn
- `turn_id`
- `session_id`
- `issue_id` (optional)
- `role` (`user|assistant`)
- `message`
- `citations[]`

## Rules
1. Always ground responses in provided context and citations.
2. Do not recalculate `green_score` (upstream-owned).
3. Infer issue status from investor language, but keep a clear audit trail in chat turns.
4. Allow cleanup generation on investor confirmation, even with unresolved issues.
5. Persist both artifacts: revised PDF + plain-text email.

## API Surface (Review-Only MVP)
- `POST /v1/reviews/sessions/{session_id}/start`
- `GET /v1/reviews/sessions/{session_id}`
- `POST /v1/reviews/sessions/{session_id}/chat`
- `PATCH /v1/reviews/sessions/{session_id}/nitpicks/{issue_id}` (optional manual override)
- `POST /v1/reviews/sessions/{session_id}/cleanup/generate`
- `GET /v1/reviews/sessions/{session_id}/artifacts`

## Implementation Defaults
1. Session start idempotency:
   - if `session_id` exists and `force` is not set, return `409`
   - if `force=true`, overwrite session payload
2. Embeddings:
   - upstream sends text/chunks only
   - this service computes embeddings internally
3. Document scope:
   - one `doc_id` per session for MVP
4. Resolution inference safety:
   - mark likely resolve intent as `in_progress` first
   - mark `resolved` after explicit confirming intent in same or next turn
5. Reopen policy:
   - allow `resolved -> open` via chat inference or manual PATCH
6. Cleanup source:
   - require `full_document_text` in session start payload
   - do not reconstruct full doc from chunks
7. Artifact storage:
   - local storage only for MVP
   - save outputs under `be/artifacts/{session_id}/`
   - persist local artifact paths in `review_sessions`
   - keep artifacts indefinitely (no TTL cleanup job in MVP)
8. Citation validation:
   - strict validation against known `chunk_id` values in session
   - drop unknown citations and log warning
9. Cleanup execution mode:
   - synchronous endpoint by default
   - if generation exceeds timeout, return `202` with retry token
10. Email style:
   - plain-text template structure
   - Gemini writes the change-summary section
11. Request sizing:
   - no request size limit enforcement in MVP
12. Runtime configuration defaults (env-driven, no hardcoded secrets):
   - `VECTOR_COLLECTION_DOCUMENT_CHUNKS=document_chunks`
   - `VECTOR_COLLECTION_NITPICK_ISSUES=nitpick_issues`
   - `VECTOR_COLLECTION_CONVERSATION_TURNS=conversation_turns`
   - `VECTOR_COLLECTION_REVIEW_SESSIONS=review_sessions`
   - `VECTOR_DISTANCE_METRIC=COSINE`
   - `VECTOR_HNSW_M=16`
   - `VECTOR_HNSW_EF_CONSTRUCT=200`
   - `VECTOR_HNSW_EF_SEARCH=50`
   - `EMBEDDING_DIM=768`
   - `GEMINI_MODEL=gemini-3-flash`
   - `GEMINI_API_KEY=<from Google AI Studio>`

## Implementation Order
1. Session start/read endpoints using precomputed input JSON.
2. Persist/load precomputed chunks + nitpicks + session state in VectorDB.
3. Chat endpoint with Gemini 3 Flash + citation-grounded responses.
4. Status inference from chat and nitpick state updates.
5. Cleanup generation endpoint (no all-resolved enforcement).
6. PDF + plain-text email artifact generation and retrieval.
