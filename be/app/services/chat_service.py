from __future__ import annotations

from datetime import UTC, datetime
import re
from uuid import uuid4

from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    IssueStatusUpdate,
    NitpickIssueInput,
    SessionRecord,
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
        known_chunk_ids = set(session.chunk_ids)
        now = datetime.now(UTC)

        target_issue_id = self._infer_target_issue_id(session, request)
        updates: list[IssueStatusUpdate] = []

        pending_issue_id = session.pending_resolution_issue_id
        message_l = request.message.lower()
        explicit_confirm = self._has_any(message_l, self._RESOLVE_CONFIRM_PATTERNS)
        soft_resolve = self._has_any(message_l, self._RESOLVE_SOFT_PATTERNS)
        reopen = self._has_any(message_l, self._REOPEN_PATTERNS)
        edit_requested = self._has_any(message_l, self._EDIT_PATTERNS)

        if target_issue_id:
            issue = self._find_issue(session.nitpicks, target_issue_id)
            if issue:
                updates.extend(
                    self._apply_issue_updates(
                        issue=issue,
                        message=request.message.strip(),
                        explicit_confirm=explicit_confirm,
                        soft_resolve=soft_resolve,
                        reopen=reopen,
                        edit_requested=edit_requested,
                        pending_issue_id=pending_issue_id,
                    )
                )
                pending_issue_id = self._next_pending_issue_id(
                    issue=issue,
                    explicit_confirm=explicit_confirm,
                    soft_resolve=soft_resolve,
                    reopen=reopen,
                    edit_requested=edit_requested,
                    current_pending=pending_issue_id,
                )
        elif pending_issue_id and explicit_confirm:
            pending_issue = self._find_issue(session.nitpicks, pending_issue_id)
            if pending_issue:
                updates.extend(
                    self._set_status(
                        pending_issue,
                        "resolved",
                        "Investor confirmed resolution in chat.",
                    )
                )
                pending_issue_id = None

        session.pending_resolution_issue_id = pending_issue_id
        session.updated_at = now
        session.status = "ready_for_cleanup" if all(i.status == "resolved" for i in session.nitpicks) else "active"

        citations = self._response_citations(session, target_issue_id)
        answer = await self._build_response(session, request, target_issue_id, citations)

        # Persist user turn.
        user_turn_id = uuid4().hex
        user_payload = {
            "session_id": session.session_id,
            "conversation_id": request.conversation_id,
            "turn_id": user_turn_id,
            "issue_id": target_issue_id,
            "role": "user",
            "message": request.message,
            "citations": [],
            "inferred_updates": [u.model_dump() for u in updates],
            "created_at": now.isoformat(),
        }
        user_vector = await self._embeddings.embed_text(request.message)
        await self._vector_store.upsert_conversation_turn(session.session_id, user_turn_id, user_vector, user_payload)

        # Persist assistant turn.
        assistant_turn_id = uuid4().hex
        assistant_payload = {
            "session_id": session.session_id,
            "conversation_id": request.conversation_id,
            "turn_id": assistant_turn_id,
            "issue_id": target_issue_id,
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

        # Persist issue state updates and session state.
        for issue in session.nitpicks:
            clean_citations = [c for c in issue.citations if c in known_chunk_ids]
            issue.citations = clean_citations
            payload = {
                "session_id": session.session_id,
                "doc_id": session.doc_id,
                "issue_id": issue.issue_id,
                "title": issue.title,
                "severity": issue.severity,
                "status": issue.status,
                "summary": issue.summary,
                "citations": clean_citations,
                "suggested_changes": issue.suggested_changes,
                "accepted_change_instructions": issue.accepted_change_instructions,
                "updated_at": now.isoformat(),
            }
            vector = await self._embeddings.embed_text(
                f"{issue.title}\n{issue.summary}\n{issue.status}\n{issue.accepted_change_instructions}"
            )
            await self._vector_store.upsert_nitpick_issue(session.session_id, issue.issue_id, vector, payload)

        await self._session_service.save_session(session)

        return ChatResponse(
            answer=answer,
            citations=citations,
            inferred_updates=updates,
            pending_resolution_issue_id=session.pending_resolution_issue_id,
        )

    def _infer_target_issue_id(self, session: SessionRecord, request: ChatRequest) -> str | None:
        if request.issue_id and self._find_issue(session.nitpicks, request.issue_id):
            return request.issue_id

        message_issue_match = re.search(r"(issue_[a-zA-Z0-9_-]+)", request.message)
        if message_issue_match:
            candidate = message_issue_match.group(1)
            if self._find_issue(session.nitpicks, candidate):
                return candidate

        if session.pending_resolution_issue_id and self._find_issue(session.nitpicks, session.pending_resolution_issue_id):
            return session.pending_resolution_issue_id

        unresolved = [i for i in session.nitpicks if i.status != "resolved"]
        if len(unresolved) == 1:
            return unresolved[0].issue_id
        return None

    @staticmethod
    def _find_issue(issues: list[NitpickIssueInput], issue_id: str) -> NitpickIssueInput | None:
        for issue in issues:
            if issue.issue_id == issue_id:
                return issue
        return None

    @staticmethod
    def _has_any(message: str, patterns: tuple[str, ...]) -> bool:
        return any(pattern in message for pattern in patterns)

    def _apply_issue_updates(
        self,
        issue: NitpickIssueInput,
        message: str,
        explicit_confirm: bool,
        soft_resolve: bool,
        reopen: bool,
        edit_requested: bool,
        pending_issue_id: str | None,
    ) -> list[IssueStatusUpdate]:
        updates: list[IssueStatusUpdate] = []

        if reopen:
            updates.extend(self._set_status(issue, "open", "Investor asked to reopen the issue."))

        if explicit_confirm or (soft_resolve and pending_issue_id == issue.issue_id):
            updates.extend(self._set_status(issue, "resolved", "Investor confirmed issue resolution."))
        elif soft_resolve:
            updates.extend(self._set_status(issue, "in_progress", "Investor indicated likely approval; awaiting confirmation."))

        if edit_requested:
            if issue.status == "resolved":
                updates.extend(self._set_status(issue, "in_progress", "Investor requested additional edits after resolution."))
            elif issue.status == "open":
                updates.extend(self._set_status(issue, "in_progress", "Investor requested edits for this issue."))
            issue.accepted_change_instructions = self._append_instruction(
                issue.accepted_change_instructions,
                message,
            )

        return updates

    def _next_pending_issue_id(
        self,
        issue: NitpickIssueInput,
        explicit_confirm: bool,
        soft_resolve: bool,
        reopen: bool,
        edit_requested: bool,
        current_pending: str | None,
    ) -> str | None:
        if issue.status == "resolved":
            return None if current_pending == issue.issue_id else current_pending
        if reopen and issue.status == "open":
            return None if current_pending == issue.issue_id else current_pending
        if edit_requested or soft_resolve or issue.status == "in_progress":
            return issue.issue_id
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
        issue: NitpickIssueInput,
        new_status: str,
        reason: str,
    ) -> list[IssueStatusUpdate]:
        if issue.status == new_status:
            return []
        update = IssueStatusUpdate(
            issue_id=issue.issue_id,
            previous_status=issue.status,
            new_status=new_status,
            reason=reason,
        )
        issue.status = new_status
        return [update]

    @staticmethod
    def _response_citations(session: SessionRecord, issue_id: str | None) -> list[str]:
        known = set(session.chunk_ids)
        if issue_id:
            for issue in session.nitpicks:
                if issue.issue_id == issue_id:
                    return [c for c in issue.citations if c in known]

        for issue in session.nitpicks:
            if issue.status != "resolved":
                citations = [c for c in issue.citations if c in known]
                if citations:
                    return citations
        return []

    async def _build_response(
        self,
        session: SessionRecord,
        request: ChatRequest,
        target_issue_id: str | None,
        citations: list[str],
    ) -> str:
        issue_lines = []
        for issue in session.nitpicks:
            issue_lines.append(
                f"- {issue.issue_id} | {issue.title} | {issue.severity} | {issue.status}"
            )

        focused = "None"
        if target_issue_id:
            issue = self._find_issue(session.nitpicks, target_issue_id)
            if issue:
                focused = (
                    f"Issue {issue.issue_id}: {issue.title}\n"
                    f"Severity: {issue.severity}\nStatus: {issue.status}\n"
                    f"Summary: {issue.summary}\n"
                    f"Suggested changes: {issue.suggested_changes}\n"
                    f"Accepted instructions: {issue.accepted_change_instructions}"
                )

        system_prompt = (
            "You are an investor document review assistant. "
            "Only use provided context, be concise, and keep claims grounded. "
            "If uncertain, state uncertainty explicitly."
        )
        user_prompt = (
            f"Company: {session.company_name}\n"
            f"Document: {session.doc_title} ({session.doc_id})\n"
            f"Green score: {session.green_score}\n"
            f"Focused issue:\n{focused}\n\n"
            f"Issue summary:\n" + "\n".join(issue_lines) + "\n\n"
            f"Investor message: {request.message}\n"
            f"Citations to reference if relevant: {citations}\n"
            "Respond in plain text. Mention concrete next-step edits when useful."
        )
        return await self._gemini.generate(system_prompt=system_prompt, user_prompt=user_prompt)
