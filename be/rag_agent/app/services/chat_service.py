from __future__ import annotations

from datetime import UTC, datetime

from app.models.schemas import ChatRequest, ChatResponse, ClauseStatusUpdate
from app.services.gemini_service import GeminiService
from app.services.session_service import SessionService


class ChatService:
    def __init__(self, session_service: SessionService, gemini: GeminiService) -> None:
        self._session_service = session_service
        self._gemini = gemini

    async def chat(self, session_id: str, request: ChatRequest) -> ChatResponse:
        session = await self._session_service.get_session(session_id)
        target = request.clause_id or session.pending_resolution_clause_id
        clause = None
        if target:
            clause = next((c for c in session.vulnerable_clauses if c.clause_id == target), None)
        if clause is None and len(session.vulnerable_clauses) == 1:
            clause = session.vulnerable_clauses[0]
            target = clause.clause_id

        updates: list[ClauseStatusUpdate] = []
        msg = request.message.lower()
        if clause is not None:
            if "resolved" in msg and clause.status != "resolved":
                updates.append(
                    ClauseStatusUpdate(
                        clause_id=clause.clause_id,
                        previous_status=clause.status,
                        new_status="resolved",
                        reason="Investor confirmed clause resolution.",
                    )
                )
                clause.status = "resolved"
                session.pending_resolution_clause_id = None
            elif any(x in msg for x in ["change", "add", "update", "revise", "should", "need"]):
                prev = clause.status
                if clause.status == "open":
                    clause.status = "in_progress"
                clause.accepted_change_instructions = (
                    f"{clause.accepted_change_instructions}\n{request.message}".strip()
                    if clause.accepted_change_instructions
                    else request.message
                )
                if prev != clause.status:
                    updates.append(
                        ClauseStatusUpdate(
                            clause_id=clause.clause_id,
                            previous_status=prev,
                            new_status=clause.status,
                            reason="Investor requested edits for this clause.",
                        )
                    )
                session.pending_resolution_clause_id = clause.clause_id

        session.status = "ready_for_cleanup" if all(c.status == "resolved" for c in session.vulnerable_clauses) else "active"
        session.updated_at = datetime.now(UTC)
        await self._session_service.save_session(session)

        focused = clause.clause_text if clause else "No specific clause selected"
        answer = await self._gemini.generate(
            system_prompt="You are an investor review assistant.",
            user_prompt=(
                f"Overall trust score: {session.overall_trust_score}\n"
                f"Syntax notes: {session.syntax_notes}\n"
                f"Focused clause: {focused}\n"
                f"Investor message: {request.message}"
            ),
        )

        return ChatResponse(
            answer=answer,
            citations=[target] if target else [],
            inferred_updates=updates,
            pending_resolution_clause_id=session.pending_resolution_clause_id,
        )
