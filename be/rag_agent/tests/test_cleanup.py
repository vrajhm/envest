from fastapi.testclient import TestClient

from app.main import app


def test_cleanup_generation() -> None:
    with TestClient(app) as client:
        payload = {
            "overall_trust_score": 65,
            "per_goal_scores": [{"goal": "Reduce carbon emissions", "score": 75, "notes": "Scope 3 missing."}],
            "syntax_notes": "Missing detail.",
            "vulnerable_clauses": [{"clause_text": "Scope 3: Under evaluation", "vulnerability_score": 90}],
        }
        client.post("/v1/reviews/sessions/sess_cleanup/start", json=payload)
        client.post(
            "/v1/reviews/sessions/sess_cleanup/chat",
            json={"conversation_id": "conv_1", "clause_id": "clause_001", "message": "Please add strict deadlines"},
        )

        r = client.post(
            "/v1/reviews/sessions/sess_cleanup/cleanup/generate",
            json={"confirmed": True, "investor_note": "Looks good"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "completed"
        assert "revised_pdf_path" in body["artifact_paths"]
