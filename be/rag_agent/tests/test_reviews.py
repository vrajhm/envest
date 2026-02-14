from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.api.dependencies import get_session_service
from app.main import app
from app.models.schemas import SessionRecord, SessionStartResponse, TrackedVulnerableClause
from app.services.session_service import SessionNotFoundError


class FakeSessionService:
    async def start_session(self, path_session_id, request, force=False):  # noqa: ANN001
        return SessionStartResponse(
            session_id=path_session_id,
            status="created",
            per_goal_count=len(request.per_goal_scores),
            vulnerable_clause_count=len(request.vulnerable_clauses),
        )

    async def get_session(self, session_id: str) -> SessionRecord:
        if session_id != "sess_001":
            raise SessionNotFoundError("not found")
        now = datetime.now(UTC)
        return SessionRecord(
            session_id="sess_001",
            overall_trust_score=65,
            per_goal_scores=[
                {
                    "goal": "Reduce carbon emissions",
                    "score": 75,
                    "notes": "Scope 3 missing.",
                }
            ],
            syntax_notes="Positive language but missing detail.",
            status="active",
            created_at=now,
            updated_at=now,
            vulnerable_clauses=[
                TrackedVulnerableClause(
                    clause_id="clause_001",
                    clause_text="Net Zero emissions by 2040",
                    vulnerability_score=60,
                    notes="Missing interim steps.",
                    similar_bad_examples=[],
                    status="open",
                    accepted_change_instructions="",
                )
            ],
            artifact_paths={},
        )


def test_start_session_endpoint() -> None:
    app.dependency_overrides[get_session_service] = lambda: FakeSessionService()
    client = TestClient(app)

    response = client.post(
        "/v1/reviews/sessions/sess_001/start",
        json={
            "overall_trust_score": 65,
            "per_goal_scores": [
                {
                    "goal": "Reduce carbon emissions",
                    "score": 75,
                    "notes": "Scope 3 missing.",
                }
            ],
            "syntax_notes": "Positive language but missing detail.",
            "vulnerable_clauses": [
                {
                    "clause_text": "Net Zero emissions by 2040",
                    "vulnerability_score": 60,
                    "notes": "Missing interim steps.",
                    "similar_bad_examples": [],
                }
            ],
        },
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["session_id"] == "sess_001"
    assert response.json()["status"] == "created"


def test_get_session_endpoint() -> None:
    app.dependency_overrides[get_session_service] = lambda: FakeSessionService()
    client = TestClient(app)

    response = client.get("/v1/reviews/sessions/sess_001")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["session_id"] == "sess_001"
