from fastapi.testclient import TestClient

from app.main import app


def test_chat_flow() -> None:
    with TestClient(app) as client:
        payload = {
            "overall_trust_score": 65,
            "per_goal_scores": [{"goal": "Reduce carbon emissions", "score": 75, "notes": "Scope 3 missing."}],
            "syntax_notes": "Missing detail.",
            "vulnerable_clauses": [{"clause_text": "Scope 3: Under evaluation", "vulnerability_score": 90}],
        }
        client.post("/v1/reviews/sessions/sess_chat/start", json=payload)

        r = client.post(
            "/v1/reviews/sessions/sess_chat/chat",
            json={"conversation_id": "conv_1", "clause_id": "clause_001", "message": "Please add strict deadlines"},
        )
        assert r.status_code == 200
        assert r.json()["pending_resolution_clause_id"] == "clause_001"
