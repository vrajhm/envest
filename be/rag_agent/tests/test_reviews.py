from fastapi.testclient import TestClient

from app.main import app


def test_start_and_get_session() -> None:
    with TestClient(app) as client:
        payload = {
            "overall_trust_score": 65,
            "per_goal_scores": [{"goal": "Reduce carbon emissions", "score": 75, "notes": "Scope 3 missing."}],
            "syntax_notes": "Missing detail.",
            "vulnerable_clauses": [{"clause_text": "Scope 3: Under evaluation", "vulnerability_score": 90}],
        }

        r1 = client.post("/v1/reviews/sessions/sess_001/start", json=payload)
        assert r1.status_code == 200
        assert r1.json()["vulnerable_clause_count"] == 1

        r2 = client.get("/v1/reviews/sessions/sess_001")
        assert r2.status_code == 200
        assert r2.json()["session_id"] == "sess_001"
        assert r2.json()["vulnerable_clauses"][0]["clause_id"] == "clause_001"
