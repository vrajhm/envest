from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
import textwrap

from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

from app.core.config import get_settings
from app.models.schemas import CleanupGenerateRequest, CleanupGenerateResponse, SessionArtifactsResponse
from app.services.gemini_service import GeminiService
from app.services.session_service import SessionService


class CleanupService:
    def __init__(self, session_service: SessionService, gemini: GeminiService) -> None:
        self._session_service = session_service
        self._gemini = gemini
        self._artifacts_dir = Path(get_settings().artifacts_dir)

    async def generate_cleanup(self, session_id: str, request: CleanupGenerateRequest) -> CleanupGenerateResponse:
        if not request.confirmed:
            raise ValueError("Cleanup generation requires explicit confirmation.")

        session = await self._session_service.get_session(session_id)

        unresolved = [c.clause_id for c in session.vulnerable_clauses if c.status != "resolved"]
        accepted = [
            f"{c.clause_id}: {c.accepted_change_instructions.strip()}"
            for c in session.vulnerable_clauses
            if c.accepted_change_instructions.strip()
        ]
        if not accepted:
            accepted = [f"{c.clause_id}: tighten language for '{c.clause_text}'" for c in session.vulnerable_clauses]

        revised = await self._gemini.generate(
            system_prompt="Generate a revised plain-text draft.",
            user_prompt=(
                f"Trust score: {session.overall_trust_score}\n"
                f"Syntax notes: {session.syntax_notes}\n"
                "Changes:\n- " + "\n- ".join(accepted)
            ),
        )
        email = await self._gemini.generate(
            system_prompt="Draft a plain-text investor email.",
            user_prompt="Changes:\n- " + "\n- ".join(accepted),
        )

        session_dir = self._artifacts_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        txt = session_dir / "revised_document.txt"
        pdf = session_dir / "revised_document.pdf"
        eml = session_dir / "investor_email.txt"

        txt.write_text(revised, encoding="utf-8")
        eml.write_text(email, encoding="utf-8")
        self._write_pdf(revised, pdf)

        session.artifact_paths = {
            "revised_text_path": str(txt),
            "revised_pdf_path": str(pdf),
            "investor_email_path": str(eml),
        }
        session.status = "completed"
        session.updated_at = datetime.now(UTC)
        await self._session_service.save_session(session)

        return CleanupGenerateResponse(
            session_id=session_id,
            status="completed",
            artifact_paths=session.artifact_paths,
            unresolved_clause_ids=unresolved,
            change_log=[f"Applied: {x}" for x in accepted],
        )

    async def get_artifacts(self, session_id: str) -> SessionArtifactsResponse:
        session = await self._session_service.get_session(session_id)
        return SessionArtifactsResponse.from_paths(session_id, session.artifact_paths)

    @staticmethod
    def _write_pdf(text: str, output_path: Path) -> None:
        pdf = canvas.Canvas(str(output_path), pagesize=LETTER)
        _, height = LETTER
        y = height - 50
        for para in text.split("\n"):
            lines = textwrap.wrap(para, width=95) or [""]
            for line in lines:
                if y < 50:
                    pdf.showPage()
                    y = height - 50
                pdf.drawString(40, y, line)
                y -= 14
            y -= 4
        pdf.save()
