# RAG Agent Spec (Current Implementation)

Status: Implemented MVP spec for the Envest review agent.

## Scope Boundary
The RAG agent does not parse or chunk documents.
Upstream sends already-structured analysis, and this agent handles investor review, clause resolution, and output generation.

## Locked Decisions
1. LLM: Gemini (`models/gemini-3-flash-preview` by default).
2. Embeddings: Gemini embeddings (`models/gemini-embedding-001`, 768 dims).
3. Storage: Vector store only for session/analysis/chat state (memory backend supported for demo).
4. Resolution inference: status inferred from investor chat text.
5. Cleanup generation: allowed even when some clauses remain unresolved.
6. Artifacts: revised text + revised PDF + plain-text investor email.
7. Auth: none for MVP.
8. Secrets: environment variables only.
9. Artifact retention: local files retained indefinitely for MVP.

## Canonical Ingestion Schema
Session start payload now uses this schema:

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

Notes:
- `session_id` comes from the path parameter (`/sessions/{session_id}/start`), not request body.
- Each ingested vulnerable clause is internally assigned a deterministic workflow id: `clause_001`, `clause_002`, etc.

## API Surface
- `POST /v1/reviews/sessions/{session_id}/start`
- `GET /v1/reviews/sessions/{session_id}`
- `POST /v1/reviews/sessions/{session_id}/chat`
- `POST /v1/reviews/sessions/{session_id}/cleanup/generate`
- `GET /v1/reviews/sessions/{session_id}/artifacts`
- `GET /health`

## Chat Contract
Chat request:
```json
{
  "conversation_id": "conv_001",
  "clause_id": "clause_001",
  "message": "Please tighten this clause and add deadlines."
}
```

Chat response includes:
- `answer`
- `citations` (currently clause ids)
- `inferred_updates` (`clause_id`, previous/new status, reason)
- `pending_resolution_clause_id`

Clause status lifecycle:
- `open`
- `in_progress`
- `resolved`

## Storage Model (Vector + Memory Backend)
Collections/backing groups used by the app:
1. `review_sessions`
- top-level session state
- trust/syntax/per-goal snapshot
- pending clause pointer
- artifact paths

2. `per_goal_scores`
- goal score records with embeddings

3. `vulnerable_clauses`
- clause text, vulnerability score, notes, similar bad examples
- status + accepted investor instructions

4. `conversation_turns`
- user and assistant turns
- linked clause id, inferred updates, citations

## Runtime Configuration (Env)
- `VECTOR_BACKEND=actian|memory`
- `VECTOR_AUTO_FALLBACK_MEMORY=true|false`
- `VECTOR_COLLECTION_PER_GOAL_SCORES=per_goal_scores`
- `VECTOR_COLLECTION_VULNERABLE_CLAUSES=vulnerable_clauses`
- `VECTOR_COLLECTION_CONVERSATION_TURNS=conversation_turns`
- `VECTOR_COLLECTION_REVIEW_SESSIONS=review_sessions`
- `EMBEDDING_DIM=768`
- `EMBEDDING_MODEL=models/gemini-embedding-001`
- `GEMINI_MODEL=models/gemini-3-flash-preview`
- `GEMINI_API_KEY=<Google AI Studio key>`
- `ARTIFACTS_DIR=be/artifacts`

## Workflow
1. Upstream calls session start with analysis schema.
2. Agent stores session + per-goal + vulnerable clauses.
3. Investor chats per clause (`clause_id`) and gives edits/approval.
4. Agent infers status transitions and persists updates.
5. Investor triggers cleanup generation.
6. Agent writes:
- `be/artifacts/{session_id}/revised_document.txt`
- `be/artifacts/{session_id}/revised_document.pdf`
- `be/artifacts/{session_id}/investor_email.txt`

## Current MVP Behavior
- No hard requirement that all clauses be resolved before cleanup.
- If investor has accepted instructions, cleanup applies those first.
- If no accepted instructions exist, cleanup falls back to unresolved-clause tightening guidance.
- Health endpoint reports vector backend state and Gemini/embedding readiness.
