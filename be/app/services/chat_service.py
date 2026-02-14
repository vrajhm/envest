from __future__ import annotations

from datetime import UTC, datetime
import re
from uuid import uuid4

from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    ClauseStatusUpdate,
    SessionRecord,
    TrackedVulnerableClause,
)
from app.services.embeddings import EmbeddingsService
from app.services.gemini_service import GeminiService
from app.services.session_service import SessionService
from app.services.vector_store import VectorStoreService


class ChatService:
    _RESOLVE_CONFIRM_PATTERNS = (
        "mark this resolved",
        "mark it resolved",
        "this is resolved",
        "resolved now",
        "approve and resolve",
        "good to go",
        "looks resolved",
    )
    _RESOLVE_SOFT_PATTERNS = (
        "i approve",
        "approved",
        "looks good",
        "good with this",
        "works for me",
        "accept this",
    )
    _REOPEN_PATTERNS = (
        "reopen",
        "not resolved",
        "keep open",
        "needs more changes",
        "open this again",
    )
    _EDIT_PATTERNS = (
        "change",
        "update",
        "modify",
        "revise",
        "add",
        "remove",
        "should",
        "need to",
    )

    def __init__(
        self,
        session_service: SessionService,
        vector_store: VectorStoreService,
        embeddings: EmbeddingsService,
        gemini: GeminiService,
    ) -> None:
        self._session_service = session_service
        self._vector_store = vector_store
        self._embeddings = embeddings
        self._gemini = gemini

    async def chat(self, session_id: str, request: ChatRequest) -> ChatResponse:
        session = await self._session_service.get_session(session_id)
        known_clause_ids = {clause.clause_id for clause in session.vulnerable_clauses}
        now = datetime.now(UTC)

        target_clause_id = self._infer_target_clause_id(session, request)
        updates: list[ClauseStatusUpdate] = []

        pending_clause_id = session.pending_resolution_clause_id
        message_l = request.message.lower()
        explicit_confirm = self._has_any(message_l, self._RESOLVE_CONFIRM_PATTERNS)
        soft_resolve = self._has_any(message_l, self._RESOLVE_SOFT_PATTERNS)
        reopen = self._has_any(message_l, self._REOPEN_PATTERNS)
        edit_requested = self._has_any(message_l, self._EDIT_PATTERNS)

        if target_clause_id:
            clause = self._find_clause(session.vulnerable_clauses, target_clause_id)
            if clause:
                updates.extend(
                    self._apply_clause_updates(
                        clause=clause,
                        message=request.message.strip(),
                        explicit_confirm=explicit_confirm,
                        soft_resolve=soft_resolve,
                        reopen=reopen,
                        edit_requested=edit_requested,
                        pending_clause_id=pending_clause_id,
                    )
                )
                pending_clause_id = self._next_pending_clause_id(
                    clause=clause,
                    explicit_confirm=explicit_confirm,
                    soft_resolve=soft_resolve,
                    reopen=reopen,
                    edit_requested=edit_requested,
                    current_pending=pending_clause_id,
                )
        elif pending_clause_id and explicit_confirm:
            pending_clause = self._find_clause(session.vulnerable_clauses, pending_clause_id)
            if pending_clause:
                updates.extend(
                    self._set_status(
                        pending_clause,
                        "resolved",
                        "Investor confirmed resolution in chat.",
                    )
                )
                pending_clause_id = None

        session.pending_resolution_clause_id = pending_clause_id
        session.updated_at = now
        session.status = "ready_for_cleanup" if all(c.status == "resolved" for c in session.vulnerable_clauses) else "active"

        citations = self._response_citations(session, target_clause_id)
        answer = await self._build_response(session, request, target_clause_id, citations)

        user_turn_id = uuid4().hex
        user_payload = {
            "session_id": session.session_id,
            "conversation_id": request.conversation_id,
            "turn_id": user_turn_id,
            "clause_id": target_clause_id,
            "role": "user",
            "message": request.message,
            "citations": [],
            "inferred_updates": [u.model_dump() for u in updates],
            "created_at": now.isoformat(),
        }
        user_vector = await self._embeddings.embed_text(request.message)
        await self._vector_store.upsert_conversation_turn(session.session_id, user_turn_id, user_vector, user_payload)

        assistant_turn_id = uuid4().hex
        assistant_payload = {
            "session_id": session.session_id,
            "conversation_id": request.conversation_id,
            "turn_id": assistant_turn_id,
            "clause_id": target_clause_id,
            "role": "assistant",
            "message": answer,
            "citations": citations,
            "created_at": now.isoformat(),
        }
        assistant_vector = await self._embeddings.embed_text(answer)
        await self._vector_store.upsert_conversation_turn(
            session.session_id,
            assistant_turn_id,
            assistant_vector,
            assistant_payload,
        )

        for clause in session.vulnerable_clauses:
            if clause.clause_id not in known_clause_ids:
                continue
            payload = {
                "session_id": session.session_id,
                "clause_id": clause.clause_id,
                "clause_text": clause.clause_text,
                "vulnerability_score": clause.vulnerability_score,
                "notes": clause.notes,
                "similar_bad_examples": [e.model_dump() for e in clause.similar_bad_examples],
                "status": clause.status,
                "accepted_change_instructions": clause.accepted_change_instructions,
                "updated_at": now.isoformat(),
            }
            vector = await self._embeddings.embed_text(
                f"{clause.clause_text}\n{clause.vulnerability_score}\n{clause.status}\n{clause.accepted_change_instructions}"
            )
            await self._vector_store.upsert_vulnerable_clause(session.session_id, clause.clause_id, vector, payload)

        await self._session_service.save_session(session)

        return ChatResponse(
            answer=answer,
            citations=citations,
            inferred_updates=updates,
            pending_resolution_clause_id=session.pending_resolution_clause_id,
        )

    def _infer_target_clause_id(self, session: SessionRecord, request: ChatRequest) -> str | None:
        if request.clause_id and self._find_clause(session.vulnerable_clauses, request.clause_id):
            return request.clause_id

        message_clause_match = re.search(r"(clause_[a-zA-Z0-9_-]+)", request.message)
        if message_clause_match:
            candidate = message_clause_match.group(1)
            if self._find_clause(session.vulnerable_clauses, candidate):
                return candidate

        if session.pending_resolution_clause_id and self._find_clause(
            session.vulnerable_clauses,
            session.pending_resolution_clause_id,
        ):
            return session.pending_resolution_clause_id

        unresolved = [c for c in session.vulnerable_clauses if c.status != "resolved"]
        if len(unresolved) == 1:
            return unresolved[0].clause_id
        return None

    @staticmethod
    def _find_clause(clauses: list[TrackedVulnerableClause], clause_id: str) -> TrackedVulnerableClause | None:
        for clause in clauses:
            if clause.clause_id == clause_id:
                return clause
        return None

    @staticmethod
    def _has_any(message: str, patterns: tuple[str, ...]) -> bool:
        return any(pattern in message for pattern in patterns)

    def _apply_clause_updates(
        self,
        clause: TrackedVulnerableClause,
        message: str,
        explicit_confirm: bool,
        soft_resolve: bool,
        reopen: bool,
        edit_requested: bool,
        pending_clause_id: str | None,
    ) -> list[ClauseStatusUpdate]:
        updates: list[ClauseStatusUpdate] = []

        if reopen:
            updates.extend(self._set_status(clause, "open", "Investor asked to reopen the clause."))

        if explicit_confirm or (soft_resolve and pending_clause_id == clause.clause_id):
            updates.extend(self._set_status(clause, "resolved", "Investor confirmed clause resolution."))
        elif soft_resolve:
            updates.extend(
                self._set_status(
                    clause,
                    "in_progress",
                    "Investor indicated likely approval; awaiting confirmation.",
                )
            )

        if edit_requested:
            if clause.status == "resolved":
                updates.extend(
                    self._set_status(
                        clause,
                        "in_progress",
                        "Investor requested additional edits after resolution.",
                    )
                )
            elif clause.status == "open":
                updates.extend(self._set_status(clause, "in_progress", "Investor requested edits for this clause."))
            clause.accepted_change_instructions = self._append_instruction(
                clause.accepted_change_instructions,
                message,
            )

        return updates

    def _next_pending_clause_id(
        self,
        clause: TrackedVulnerableClause,
        explicit_confirm: bool,
        soft_resolve: bool,
        reopen: bool,
        edit_requested: bool,
        current_pending: str | None,
    ) -> str | None:
        if clause.status == "resolved":
            return None if current_pending == clause.clause_id else current_pending
        if reopen and clause.status == "open":
            return None if current_pending == clause.clause_id else current_pending
        if edit_requested or soft_resolve or clause.status == "in_progress":
            return clause.clause_id
        return current_pending

    @staticmethod
    def _append_instruction(current: str, new_text: str) -> str:
        line = new_text.strip()
        if not line:
            return current
        if not current:
            return line
        if line in current:
            return current
        return f"{current}\n{line}"

    @staticmethod
    def _set_status(
        clause: TrackedVulnerableClause,
        new_status: str,
        reason: str,
    ) -> list[ClauseStatusUpdate]:
        if clause.status == new_status:
            return []
        update = ClauseStatusUpdate(
            clause_id=clause.clause_id,
            previous_status=clause.status,
            new_status=new_status,
            reason=reason,
        )
        clause.status = new_status
        return [update]

    @staticmethod
    def _response_citations(session: SessionRecord, clause_id: str | None) -> list[str]:
        if clause_id:
            return [clause_id]

        for clause in session.vulnerable_clauses:
            if clause.status != "resolved":
                return [clause.clause_id]
        return []

    async def _build_response(
        self,
        session: SessionRecord,
        request: ChatRequest,
        target_clause_id: str | None,
        citations: list[str],
    ) -> str:
        clause_lines = []
        for clause in session.vulnerable_clauses:
            clause_lines.append(
                f"- {clause.clause_id} | score={clause.vulnerability_score} | {clause.status} | {clause.clause_text}"
            )

        focused = "None"
        if target_clause_id:
            clause = self._find_clause(session.vulnerable_clauses, target_clause_id)
            if clause:
                examples = "\n".join(
                    [f"  - {e.example_clause} (source: {e.source})" for e in clause.similar_bad_examples]
                )
                focused = (
                    f"Clause {clause.clause_id}: {clause.clause_text}\n"
                    f"Vulnerability score: {clause.vulnerability_score}\n"
                    f"Status: {clause.status}\n"
                    f"Notes: {clause.notes or 'None'}\n"
                    f"Similar bad examples:\n{examples or '  - None'}\n"
                    f"Accepted instructions: {clause.accepted_change_instructions or 'None'}"
                )

        system_prompt = (
            "You are an investor document review assistant. "
            "Only use provided context, be concise, and keep claims grounded. "
            "If uncertain, state uncertainty explicitly."
        )
        goals_block = "\n".join([f"- {g.goal}: {g.score} ({g.notes})" for g in session.per_goal_scores])
        user_prompt = (
            f"Overall trust score: {session.overall_trust_score}\n"
            f"Syntax notes: {session.syntax_notes}\n"
            f"Per-goal scores:\n{goals_block or '- None'}\n\n"
            f"Focused clause:\n{focused}\n\n"
            f"Vulnerable clauses summary:\n" + "\n".join(clause_lines) + "\n\n"
            f"Investor message: {request.message}\n"
            f"Citations to reference if relevant: {citations}\n"
            "Respond in plain text. Mention concrete next-step edits when useful."
        )
        return await self._gemini.generate(system_prompt=system_prompt, user_prompt=user_prompt)
