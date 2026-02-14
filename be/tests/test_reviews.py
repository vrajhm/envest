from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.api.dependencies import get_session_service
from app.main import app
from app.models.schemas import NitpickIssueInput, SessionRecord, SessionStartResponse
from app.services.session_service import SessionNotFoundError


class FakeSessionService:
    async def start_session(self, path_session_id, request, force=False):  # noqa: ANN001
        return SessionStartResponse(
            session_id=path_session_id,
            status="created",
            chunk_count=len(request.document_chunks),
            nitpick_count=len(request.nitpicks),
            dropped_citation_count=0,
        )

    async def get_session(self, session_id: str) -> SessionRecord:
        if session_id != "sess_001":
            raise SessionNotFoundError("not found")
        now = datetime.now(UTC)
        return SessionRecord(
            session_id="sess_001",
            company_name="Acme",
            doc_id="doc_001",
            doc_title="Doc",
            full_document_text="full",
            green_score=72.0,
            status="active",
            created_at=now,
            updated_at=now,
            chunk_ids=["doc_001:c001"],
            nitpicks=[
                NitpickIssueInput(
                    issue_id="issue_001",
                    title="Issue",
                    severity="high",
                    status="open",
                    summary="summary",
                    citations=["doc_001:c001"],
                    suggested_changes=["change"],
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
            "session_id": "sess_001",
            "company_name": "Acme Climate Tech",
            "doc_id": "doc_001",
            "doc_title": "Climate Contract v3",
            "full_document_text": "full text",
            "green_score": 72.5,
            "document_chunks": [
                {
                    "chunk_id": "doc_001:c001",
                    "text": "Supplier emissions reporting is annual...",
                    "source_name": "Climate Contract v3",
                    "citations": ["p12"],
                }
            ],
            "nitpicks": [
                {
                    "issue_id": "issue_001",
                    "title": "No annual scope-3 audit clause",
                    "severity": "high",
                    "status": "open",
                    "summary": "Contract lacks mandatory third-party scope-3 audit language.",
                    "citations": ["doc_001:c001"],
                    "suggested_changes": ["Add annual third-party scope-3 audit requirement."],
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
