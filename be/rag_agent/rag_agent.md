# RAG Agent Spec

Input schema:
- `overall_trust_score` (0-100)
- `per_goal_scores[]` with `{goal, score, notes}`
- `syntax_notes`
- `vulnerable_clauses[]` with `{clause_text, vulnerability_score, notes?, similar_bad_examples[]}`

Workflow:
1. Start session via `POST /v1/reviews/sessions/{session_id}/start`.
2. Backend assigns `clause_001..` ids and tracks clause status (`open|in_progress|resolved`).
3. Investor chats via `POST /v1/reviews/sessions/{session_id}/chat`.
4. Generate artifacts via `POST /v1/reviews/sessions/{session_id}/cleanup/generate`.
5. Retrieve paths via `GET /v1/reviews/sessions/{session_id}/artifacts`.

Artifacts (local storage):
- `be/rag_agent/artifacts/{session_id}/investor_email.txt`
