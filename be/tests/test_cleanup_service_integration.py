from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import get_settings
from app.models.schemas import CleanupGenerateRequest, NitpickIssueInput, SessionRecord
from app.services.cleanup_service import CleanupService


class FakeSessionService:
    def __init__(self, session: SessionRecord) -> None:
        self._session = session
        self.saved: SessionRecord | None = None

    async def get_session(self, session_id: str) -> SessionRecord:
        assert session_id == self._session.session_id
        return self._session

    async def save_session(self, session: SessionRecord) -> None:
        self.saved = session
        self._session = session


class FakeGeminiService:
    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        if "contract editing assistant" in system_prompt:
            return "Revised document output"
        return "Subject: Requested Revisions\n\nPlease implement the listed changes."


def test_cleanup_service_creates_local_artifacts(tmp_path, monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.setenv("ARTIFACTS_DIR", str(tmp_path / "artifacts"))
    get_settings.cache_clear()

    now = datetime.now(UTC)
    session = SessionRecord(
        session_id="sess_local_001",
        company_name="Acme Climate Tech",
        doc_id="doc_001",
        doc_title="Climate Contract",
        full_document_text="Original contract text.",
        green_score=71.2,
        status="active",
        created_at=now,
        updated_at=now,
        chunk_ids=["doc_001:c001"],
        nitpicks=[
            NitpickIssueInput(
                issue_id="issue_001",
                title="Missing annual audit clause",
                severity="high",
                status="in_progress",
                summary="No annual audit language.",
                citations=["doc_001:c001"],
                suggested_changes=["Add annual third-party audit requirement."],
                accepted_change_instructions="Add annual third-party audit requirement with due date.",
            )
        ],
        artifact_paths={},
    )

    fake_sessions = FakeSessionService(session)
    cleanup = CleanupService(session_service=fake_sessions, gemini=FakeGeminiService())

    result = asyncio.run(
        cleanup.generate_cleanup(
            session_id="sess_local_001",
            request=CleanupGenerateRequest(confirmed=True, investor_note="Prioritize audit language."),
        )
    )

    revised_pdf_path = Path(result.artifact_paths["revised_pdf_path"])
    revised_text_path = Path(result.artifact_paths["revised_text_path"])
    investor_email_path = Path(result.artifact_paths["investor_email_path"])

    assert result.status == "completed"
    assert revised_pdf_path.exists()
    assert revised_text_path.exists()
    assert investor_email_path.exists()

    assert "Revised document output" in revised_text_path.read_text(encoding="utf-8")
    assert "Requested Revisions" in investor_email_path.read_text(encoding="utf-8")

    assert fake_sessions.saved is not None
    assert fake_sessions.saved.status == "completed"
    assert fake_sessions.saved.artifact_paths["revised_pdf_path"] == str(revised_pdf_path)

    # Reset settings cache for other tests.
    get_settings.cache_clear()
