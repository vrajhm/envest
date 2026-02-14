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

## Session start payload (new schema)

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
  "syntax_notes": "Positive language but missing detail in critical areas.",
  "vulnerable_clauses": [
    {
      "clause_text": "Scope 3: Under evaluation",
      "vulnerability_score": 90,
      "notes": "Major omission.",
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

## Demo flow

```bash
bash be/rag_agent/run_demo_flow.sh
```

Artifacts are saved to:
- `be/rag_agent/artifacts/{session_id}/revised_document.txt`
- `be/rag_agent/artifacts/{session_id}/revised_document.pdf`
- `be/rag_agent/artifacts/{session_id}/investor_email.txt`
