# Merge Plan: Parsing Agent + RAG Agent

## Goal
Connect the parsing agent output directly into the RAG agent ingestion flow so that:
1. parsing agent parses + scores a document
2. parsing agent returns normalized JSON
3. RAG agent ingests that JSON as session context
4. investor chats against that context

## Current State

### Parsing agent (`be/parsing_agent/server.py`)
- `POST /parse`:
  - accepts uploaded file (or defaults to local sample)
  - runs LlamaParse
  - stores parsed markdown in process memory (`_last_markdown`)
  - builds in-memory vector index for retrieval
- `GET /score`:
  - pulls investor goals from MongoDB
  - retrieves top-k chunks from in-memory index
  - prompts Gemini
  - returns JSON with shape:
    - `overall_trust_score`
    - `per_goal_scores[]`
    - `syntax_notes`
    - `vulnerable_clauses[]`
  - real observed payload characteristics:
    - many vulnerable clauses (10+)
    - clause text is long-form contractual language
    - `similar_bad_examples` may be empty or populated
    - scores are integer-like (`0-100`)

### RAG agent (`be/rag_agent/...`)
- `POST /v1/reviews/sessions/{session_id}/start`
  - expects body:
    - `overall_trust_score`
    - `per_goal_scores[]`
    - `syntax_notes`
    - `vulnerable_clauses[]`
- assigns internal `clause_001...` ids and persists session context
- chat and cleanup APIs already implemented

## Key Merge Requirement (New)
Use parsing agent's in-memory `_vector_index` during RAG chat for semantic retrieval.

Implication:
- RAG agent should not rely only on `vulnerable_clauses` summaries for grounding.
- RAG chat should fetch top-k semantic chunks from parsing agent per investor question.

## Contract Compatibility
The two agents are already mostly schema-compatible.
Primary integration work is transport/orchestration + retrieval bridging (not schema redesign).

## Integration Architecture (MVP)
Use orchestration from parsing agent into RAG agent over HTTP.

Flow:
1. Client uploads document to parsing agent (`POST /parse`).
2. Client (or parsing agent) requests score JSON (`GET /score`).
3. Parsing agent posts score JSON to RAG start endpoint:
   - `POST {RAG_BASE_URL}/v1/reviews/sessions/{session_id}/start`
4. RAG stores link metadata to parsing session/context id.
5. During chat, RAG calls parsing retrieval endpoint to pull top-k chunks from `_vector_index`.
6. RAG composes grounded answer with:
   - retrieved chunks
   - score JSON context
   - clause workflow state

## New/Updated Endpoints (Planned)

### Parsing agent additions
1. `POST /pipeline/start`
- input:
  - file upload
  - optional `session_id`
- behavior:
  - runs parse + score
  - forwards score JSON to RAG start endpoint
- output:
  - `session_id`
  - parse status
  - score status
  - rag ingestion status

2. `POST /pipeline/ingest`
- input:
  - `session_id`
  - already-produced score JSON
- behavior:
  - forwards directly to RAG start endpoint
- use case:
  - decouple scoring from ingestion for retries/manual testing

3. `POST /retrieve` (required for semantic bridge)
- input:
  - `query` (chat/user text)
  - `top_k` (default 8-15)
  - `session_id` or parse-context id (if multi-session support added)
- behavior:
  - run retriever over `_vector_index`
  - return top-k chunks with rank/score and optional source metadata
- output:
  - `chunks[]` used by RAG as grounding context

### RAG agent (no contract change needed)
Keep existing endpoint as canonical ingest target:
- `POST /v1/reviews/sessions/{session_id}/start`

RAG additions:
- parsing-retrieval client in chat path:
  - `POST {PARSING_BASE_URL}/retrieve`
- fallback behavior if retrieval unavailable:
  - answer from stored clause context only
  - mark response as lower-confidence in metadata

## Environment Config (Planned)

### Parsing agent
Add:
- `RAG_BASE_URL=http://127.0.0.1:8000`
- `RAG_START_TIMEOUT_SECONDS=30`
- `PARSING_RETRIEVE_DEFAULT_TOP_K=12`

Existing keys remain:
- `LLAMA_CLOUD_API_KEY` / `llamaparse_api_key`
- `GOOGLE_API_KEY`
- `MONGO_URI`

### RAG agent
Add:
- `PARSING_BASE_URL=http://127.0.0.1:8001`
- `PARSING_RETRIEVE_TIMEOUT_SECONDS=10`
- `PARSING_RETRIEVE_TOP_K=12`

## Reliability + Error Handling

### Retry policy (MVP)
- Parse failure: return 502 with parse error details.
- Score failure: return 502 with score error details.
- RAG ingest failure:
  - return 502 + include session_id + payload hash
  - do not drop the score payload
- Retrieval failure during chat:
  - do not fail entire chat request
  - fallback to stored score/clause context
  - include retrieval warning in logs

### Score Cache Fallback (Required)
If live `/score` fails, parsing agent should fallback to cached score JSON.

Cache plan:
- cache key: `session_id` (or document hash if session is not provided)
- cache path: `be/parsing_agent/cache/{session_id}.json`
- write cache on every successful `/score` response
- validate cached payload against RAG ingest schema before use

Fallback order:
1. live `/score` response
2. session-specific cached JSON
3. optional static fallback JSON (the approved sample payload) for demo resilience

Pipeline response metadata should include:
- `score_source`: `live|cache|static_fallback`
- `cached_at`: ISO timestamp when cache entry was written
- `cache_key`: session/document cache key used

### Idempotency
- RAG start endpoint already supports session creation semantics.
- For reruns, use `force=true` query param in ingest call when intentional overwrite is needed.

### Observability
Log correlation fields in both agents:
- `session_id`
- `document_name`
- `pipeline_stage` (`parse|score|rag_ingest`)
- latency per stage

## Security and Scope (MVP)
- Internal service-to-service calls on localhost/network only.
- No auth enforced yet (hackathon constraint).
- No persistent document storage in parsing agent yet; current parse context is in-memory.

## Known Gaps to Address After MVP
1. Parsing agent is stateful (`_last_markdown`) and single-document in-memory.
2. `GET /score` currently depends on prior `/parse` in same process.
3. No durable pipeline job store.
4. No per-user isolation/session auth.
5. `_vector_index` currently in-memory; lost on parsing service restart.
6. Score cache invalidation/TTL policy not yet defined (MVP can use no-TTL with overwrite).

## Implementation Steps (No Code Yet)
1. Define `pipeline/start` request/response schema in parsing agent.
2. Add small RAG HTTP client in parsing agent to call `/sessions/{session_id}/start`.
3. Add `POST /retrieve` endpoint in parsing agent backed by `_vector_index`.
4. In RAG chat service, call parsing `/retrieve` with user question and merge chunks into prompt.
5. Implement `pipeline/start` orchestration (parse -> score -> ingest).
6. Add one end-to-end integration test:
   - upload file to parsing agent
   - verify RAG session created and retrievable
   - verify chat calls retrieval and uses returned chunks
7. Add score-cache fallback logic:
   - save cache after successful `/score`
   - load cache when `/score` fails
   - include `score_source` in pipeline response
8. Add short CLI script for local smoke test across both agents.

## Test Plan
1. Happy path:
- parse succeeds
- score JSON valid
- rag start returns 200

2. Parse failure:
- invalid file / API key missing -> proper error

3. Score failure:
- missing Google key / JSON parse failure -> proper error

4. RAG ingest failure:
- RAG down -> parsing pipeline returns actionable error

5. Schema validation:
- ensure score JSON always matches RAG ingest contract

6. Retrieval bridge:
- verify `/retrieve` returns chunks after `/parse`
- verify RAG chat still works when `/retrieve` times out (fallback mode)

7. Score cache fallback:
- force `/score` failure and verify cached payload is used
- verify schema validation rejects corrupted cache entries
- verify `score_source` is correctly returned

## Example End-to-End Payload (Shared Contract)
```json
{
  "overall_trust_score": 65,
  "per_goal_scores": [
    {
      "goal": "Reduce carbon emissions",
      "score": 75,
      "notes": "Reasonable Scope 1 & 2 reduction, but Scope 3 is missing."
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
```

## Decision Summary
- Keep agents separate.
- Merge via HTTP pipeline orchestration.
- Reuse existing RAG ingest schema unchanged.
- Add retrieval bridge so RAG chat uses parsing agent `_vector_index` for semantic search.
- Add parsing-agent orchestration endpoints for one-call pipeline UX.
