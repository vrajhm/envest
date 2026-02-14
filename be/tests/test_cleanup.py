from fastapi.testclient import TestClient

from app.api.dependencies import get_cleanup_service
from app.main import app
from app.models.schemas import CleanupGenerateResponse, SessionArtifactsResponse
from app.services.session_service import SessionNotFoundError


class FakeCleanupService:
    async def generate_cleanup(self, session_id: str, request):  # noqa: ANN001
        if session_id == "missing":
            raise SessionNotFoundError("not found")
        if not request.confirmed:
            raise ValueError("Cleanup generation requires explicit confirmation.")
        return CleanupGenerateResponse(
            session_id=session_id,
            status="completed",
            artifact_paths={
                "revised_pdf_path": f"be/artifacts/{session_id}/revised_document.pdf",
                "investor_email_path": f"be/artifacts/{session_id}/investor_email.txt",
                "revised_text_path": f"be/artifacts/{session_id}/revised_document.txt",
            },
            unresolved_issue_ids=["issue_009"],
            change_log=["Applied: issue_001 -> add annual disclosure clause"],
        )

    async def get_artifacts(self, session_id: str):  # noqa: ANN001
        if session_id == "missing":
            raise SessionNotFoundError("not found")
        return SessionArtifactsResponse(
            session_id=session_id,
            artifact_paths={
                "revised_pdf_path": f"be/artifacts/{session_id}/revised_document.pdf",
                "investor_email_path": f"be/artifacts/{session_id}/investor_email.txt",
            },
            existing_artifacts={
                "revised_pdf_path": True,
                "investor_email_path": True,
            },
        )


def test_generate_cleanup_endpoint() -> None:
    app.dependency_overrides[get_cleanup_service] = lambda: FakeCleanupService()
    client = TestClient(app)

    response = client.post(
        "/v1/reviews/sessions/sess_001/cleanup/generate",
        json={"confirmed": True, "investor_note": "Please prioritize the audit clause."},
    )

    app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    assert "revised_pdf_path" in payload["artifact_paths"]


def test_get_artifacts_endpoint() -> None:
    app.dependency_overrides[get_cleanup_service] = lambda: FakeCleanupService()
    client = TestClient(app)

    response = client.get("/v1/reviews/sessions/sess_001/artifacts")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["session_id"] == "sess_001"
    assert payload["existing_artifacts"]["revised_pdf_path"] is True
