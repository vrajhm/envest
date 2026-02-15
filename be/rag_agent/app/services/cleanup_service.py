from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

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

        raw_email = await self._gemini.generate(
            system_prompt=(
                "You are an investor drafting a concise clause-resolution email to a startup point of contact. "
                "Focus on resolved/rectified clauses, keep tone professional and direct, and return plain text only."
            ),
            user_prompt=(
                "Context:\n"
                f"- Trust score: {session.overall_trust_score}\n"
                f"- Syntax notes: {session.syntax_notes}\n"
                "Accepted clause updates:\n- " + "\n- ".join(accepted) + "\n\n"
                "Instruction: this is a draft preview only; do not claim this email has been sent.\n"
                "Output format (plain text, concise):\n"
                "Subject: <single line>\n"
                "Email:\n"
                "<greeting>\n"
                "<3-6 short lines covering key clause concerns, requested fixes, and next step>\n"
                "<sign-off>"
            ),
        )
        email = (raw_email or "").strip()

        session_dir = self._artifacts_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        eml = session_dir / "investor_email.txt"

        eml.write_text(email, encoding="utf-8")

        session.artifact_paths = {
            "investor_email_path": str(eml),
        }
        session.status = "completed"
        session.updated_at = datetime.now(UTC)
        await self._session_service.save_session(session)

        return CleanupGenerateResponse(
            session_id=session_id,
            status="completed",
            artifact_paths=session.artifact_paths,
            investor_email_draft=email,
            unresolved_clause_ids=unresolved,
            change_log=[f"Applied: {x}" for x in accepted],
        )

    async def get_artifacts(self, session_id: str) -> SessionArtifactsResponse:
        session = await self._session_service.get_session(session_id)
        return SessionArtifactsResponse.from_paths(session_id, session.artifact_paths)
