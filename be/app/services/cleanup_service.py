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
from app.services.session_service import SessionNotFoundError, SessionService


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

        unresolved_issue_ids = [issue.issue_id for issue in session.nitpicks if issue.status != "resolved"]
        accepted_changes = [
            f"{issue.issue_id}: {issue.accepted_change_instructions.strip()}"
            for issue in session.nitpicks
            if issue.accepted_change_instructions.strip()
        ]

        if not accepted_changes:
            accepted_changes = [
                f"{issue.issue_id}: {issue.title} -> {issue.suggested_changes[0]}"
                for issue in session.nitpicks
                if issue.suggested_changes
            ]

        revised_text = await self._generate_revised_document_text(
            company_name=session.company_name,
            doc_title=session.doc_title,
            full_text=session.full_document_text,
            accepted_changes=accepted_changes,
            investor_note=request.investor_note,
        )

        email_text = await self._generate_email_text(
            company_name=session.company_name,
            doc_title=session.doc_title,
            accepted_changes=accepted_changes,
            unresolved_issue_ids=unresolved_issue_ids,
        )

        change_log = [f"Applied: {change}" for change in accepted_changes]
        if unresolved_issue_ids:
            change_log.append(
                "Unresolved issues intentionally left open by investor: "
                + ", ".join(unresolved_issue_ids)
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
            unresolved_issue_ids=unresolved_issue_ids,
            change_log=change_log,
        )

    async def get_artifacts(self, session_id: str) -> SessionArtifactsResponse:
        session = await self._session_service.get_session(session_id)
        return SessionArtifactsResponse.from_paths(session.session_id, session.artifact_paths)

    async def _generate_revised_document_text(
        self,
        company_name: str,
        doc_title: str,
        full_text: str,
        accepted_changes: list[str],
        investor_note: str | None,
    ) -> str:
        system_prompt = (
            "You are a contract editing assistant. Produce a cleaned-up revised version of the document "
            "based only on requested changes. Keep structure and tone professional."
        )
        user_prompt = (
            f"Company: {company_name}\n"
            f"Document: {doc_title}\n"
            f"Investor note: {investor_note or 'None'}\n\n"
            f"Requested changes:\n- "
            + "\n- ".join(accepted_changes)
            + "\n\nOriginal document:\n"
            + full_text
        )
        generated = await self._gemini.generate(system_prompt=system_prompt, user_prompt=user_prompt)

        if generated.strip():
            return generated.strip()

        fallback_header = (
            f"Revised Draft for {company_name} - {doc_title}\n"
            "(Gemini fallback mode: preserving original text and requested changes.)\n\n"
            "Requested changes:\n- "
            + "\n- ".join(accepted_changes)
            + "\n\n"
        )
        return fallback_header + full_text

    async def _generate_email_text(
        self,
        company_name: str,
        doc_title: str,
        accepted_changes: list[str],
        unresolved_issue_ids: list[str],
    ) -> str:
        system_prompt = (
            "You are drafting a concise investor follow-up email. "
            "Return plain text only, no markdown."
        )
        user_prompt = (
            f"Company: {company_name}\n"
            f"Document: {doc_title}\n"
            f"Requested changes:\n- "
            + "\n- ".join(accepted_changes)
            + "\n\n"
            f"Unresolved issues: {', '.join(unresolved_issue_ids) if unresolved_issue_ids else 'None'}\n"
            "Draft a professional email asking for these updates before investment proceeds."
        )
        generated = await self._gemini.generate(system_prompt=system_prompt, user_prompt=user_prompt)

        if generated.strip():
            return generated.strip()

        lines = [
            f"Subject: Requested Revisions to {doc_title}",
            "",
            f"Hello {company_name} team,",
            "",
            "Thank you for sharing the latest document. Before proceeding with investment, we request the following changes:",
            "",
        ]
        lines.extend([f"- {change}" for change in accepted_changes])
        if unresolved_issue_ids:
            lines.extend(
                [
                    "",
                    "The following items remain open but are acknowledged for now:",
                    f"- {', '.join(unresolved_issue_ids)}",
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
