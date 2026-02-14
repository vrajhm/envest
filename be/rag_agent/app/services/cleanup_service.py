from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
import textwrap

from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

from app.core.config import get_settings
from app.models.schemas import (
    CleanupGenerateRequest,
    CleanupGenerateResponse,
    SessionArtifactsResponse,
)
from app.services.gemini_service import GeminiService
from app.services.session_service import SessionService


class CleanupService:
    def __init__(self, session_service: SessionService, gemini: GeminiService) -> None:
        self._session_service = session_service
        self._gemini = gemini
        self._artifacts_dir = Path(get_settings().artifacts_dir)

    async def generate_cleanup(
        self,
        session_id: str,
        request: CleanupGenerateRequest,
    ) -> CleanupGenerateResponse:
        if not request.confirmed:
            raise ValueError("Cleanup generation requires explicit confirmation.")

        session = await self._session_service.get_session(session_id)
        now = datetime.now(UTC)

        unresolved_clause_ids = [clause.clause_id for clause in session.vulnerable_clauses if clause.status != "resolved"]
        accepted_changes = [
            f"{clause.clause_id}: {clause.accepted_change_instructions.strip()}"
            for clause in session.vulnerable_clauses
            if clause.accepted_change_instructions.strip()
        ]

        if not accepted_changes:
            accepted_changes = [
                f"{clause.clause_id}: tighten language for '{clause.clause_text}'"
                for clause in session.vulnerable_clauses
                if clause.status != "resolved"
            ]

        revised_text = await self._generate_revised_document_text(
            overall_trust_score=session.overall_trust_score,
            syntax_notes=session.syntax_notes,
            per_goal_lines=[f"{goal.goal}: {goal.score} ({goal.notes})" for goal in session.per_goal_scores],
            accepted_changes=accepted_changes,
            investor_note=request.investor_note,
        )

        email_text = await self._generate_email_text(
            accepted_changes=accepted_changes,
            unresolved_clause_ids=unresolved_clause_ids,
        )

        change_log = [f"Applied: {change}" for change in accepted_changes]
        if unresolved_clause_ids:
            change_log.append(
                "Unresolved clauses intentionally left open by investor: "
                + ", ".join(unresolved_clause_ids)
            )

        session_dir = self._artifacts_dir / session.session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        revised_text_path = session_dir / "revised_document.txt"
        revised_pdf_path = session_dir / "revised_document.pdf"
        email_path = session_dir / "investor_email.txt"

        revised_text_path.write_text(revised_text, encoding="utf-8")
        email_path.write_text(email_text, encoding="utf-8")
        self._write_pdf(revised_text, revised_pdf_path)

        session.artifact_paths = {
            "revised_text_path": str(revised_text_path),
            "revised_pdf_path": str(revised_pdf_path),
            "investor_email_path": str(email_path),
        }
        session.status = "completed"
        session.updated_at = now

        await self._session_service.save_session(session)

        return CleanupGenerateResponse(
            session_id=session.session_id,
            status="completed",
            artifact_paths=session.artifact_paths,
            unresolved_clause_ids=unresolved_clause_ids,
            change_log=change_log,
        )

    async def get_artifacts(self, session_id: str) -> SessionArtifactsResponse:
        session = await self._session_service.get_session(session_id)
        return SessionArtifactsResponse.from_paths(session.session_id, session.artifact_paths)

    async def _generate_revised_document_text(
        self,
        overall_trust_score: int,
        syntax_notes: str,
        per_goal_lines: list[str],
        accepted_changes: list[str],
        investor_note: str | None,
    ) -> str:
        system_prompt = (
            "You are a climate contract editing assistant. Produce a cleaned-up revised draft summary "
            "based only on provided analysis and requested changes."
        )
        user_prompt = (
            f"Overall trust score: {overall_trust_score}\n"
            f"Syntax notes: {syntax_notes}\n"
            "Per-goal scores:\n- "
            + "\n- ".join(per_goal_lines)
            + "\n\nInvestor note: "
            + (investor_note or "None")
            + "\n\nRequested changes:\n- "
            + "\n- ".join(accepted_changes)
            + "\n\nReturn a plain-text revised draft section list."
        )
        generated = await self._gemini.generate(system_prompt=system_prompt, user_prompt=user_prompt)

        if generated.strip():
            return generated.strip()

        fallback = [
            "Revised Draft (Fallback)",
            "",
            f"Overall trust score: {overall_trust_score}",
            f"Syntax notes: {syntax_notes}",
            "",
            "Per-goal scores:",
        ]
        fallback.extend([f"- {line}" for line in per_goal_lines])
        fallback.extend(["", "Requested changes:"])
        fallback.extend([f"- {change}" for change in accepted_changes])
        return "\n".join(fallback)

    async def _generate_email_text(
        self,
        accepted_changes: list[str],
        unresolved_clause_ids: list[str],
    ) -> str:
        system_prompt = (
            "You are drafting a concise investor follow-up email. "
            "Return plain text only, no markdown."
        )
        user_prompt = (
            "Requested changes:\n- "
            + "\n- ".join(accepted_changes)
            + "\n\n"
            f"Unresolved clauses: {', '.join(unresolved_clause_ids) if unresolved_clause_ids else 'None'}\n"
            "Draft a professional email asking for these updates before investment proceeds."
        )
        generated = await self._gemini.generate(system_prompt=system_prompt, user_prompt=user_prompt)

        if generated.strip():
            return generated.strip()

        lines = [
            "Subject: Requested Revisions Before Investment",
            "",
            "Hello team,",
            "",
            "Thank you for sharing the document. Before proceeding with investment, we request these changes:",
            "",
        ]
        lines.extend([f"- {change}" for change in accepted_changes])
        if unresolved_clause_ids:
            lines.extend(
                [
                    "",
                    "The following clauses remain open but are acknowledged for now:",
                    f"- {', '.join(unresolved_clause_ids)}",
                ]
            )
        lines.extend(
            [
                "",
                "Please send back an updated document reflecting these edits.",
                "",
                "Best,",
                "Investor",
            ]
        )
        return "\n".join(lines)

    @staticmethod
    def _write_pdf(text: str, output_path: Path) -> None:
        pdf = canvas.Canvas(str(output_path), pagesize=LETTER)
        width, height = LETTER
        y = height - 50

        for paragraph in text.split("\n"):
            wrapped_lines = textwrap.wrap(paragraph, width=95) or [""]
            for line in wrapped_lines:
                if y < 50:
                    pdf.showPage()
                    y = height - 50
                pdf.drawString(40, y, line)
                y -= 14
            y -= 4

        pdf.save()
