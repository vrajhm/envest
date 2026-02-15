from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from typing import Any

import httpx
from app.core.config import get_settings
from app.models.schemas import ChatRequest, ChatResponse, ClauseStatusUpdate
from app.services.gemini_service import GeminiService
from app.services.session_service import SessionService


class ChatService:
    def __init__(self, session_service: SessionService, gemini: GeminiService) -> None:
        self._session_service = session_service
        self._gemini = gemini
        settings = get_settings()
        self._retrieve_url = settings.parsing_retrieve_url
        self._retrieve_top_k = settings.chat_retrieval_top_k
        self._retrieve_timeout_seconds = settings.chat_retrieval_timeout_seconds
        self._chunk_char_limit = settings.chat_retrieval_chunk_chars

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
        is_manual_resolve = request.message.strip().lower() in {"mark this resolved.", "mark this resolved", "resolved"}
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

        # Fast path for manual resolve actions from the UI: avoid retrieval + LLM call.
        if is_manual_resolve and clause is not None:
            return ChatResponse(
                answer=f"{clause.clause_id} marked as resolved.",
                citations=[target] if target else [],
                inferred_updates=updates,
                pending_resolution_clause_id=session.pending_resolution_clause_id,
            )

        focused = clause.clause_text if clause else "No specific clause selected"
        include_replacement_clause = request.include_replacement_clause
        semantic_chunks = await self._get_semantic_chunks(
            focused_clause=focused,
            syntax_notes=session.syntax_notes,
            user_message=request.message,
        )
        chunks_text = (
            "\n".join(f"- {chunk}" for chunk in semantic_chunks)
            if semantic_chunks
            else "(none)"
        )
        if include_replacement_clause:
            raw_answer = await self._gemini.generate(
                system_prompt=(
                    "You resolve vulnerable ESG clauses. Keep outputs concise. "
                    'Return only valid JSON with keys: "rectified_clause" and "why".'
                ),
                user_prompt=(
                    "Task: generate a rectified clause for the selected vulnerable clause.\n"
                    f"Focused clause: {focused}\n"
                    f"Syntax notes: {session.syntax_notes}\n"
                    f"Investor message: {request.message}\n"
                    f"Retrieved excerpts:\n{chunks_text}\n"
                    "Output format (strict JSON):\n"
                    '{"rectified_clause":"...","why":"..."}'
                ),
            )
            answer = self._parse_replacement_answer(raw_answer)
        else:
            raw_answer = await self._gemini.generate(
                system_prompt=(
                    "You are an ESG clause resolution assistant. Keep responses concise and practical for fast chat."
                ),
                user_prompt=(
                    "Task: help resolve the selected vulnerable clause.\n"
                    f"Focused clause: {focused}\n"
                    f"Syntax notes: {session.syntax_notes}\n"
                    f"Investor message: {request.message}\n"
                    f"Retrieved excerpts:\n{chunks_text}\n"
                    "Output format:\n"
                    "- Issue: <one short sentence>\n"
                    "- Fix: <one short sentence>\n"
                    "- Next step: <one short sentence>"
                ),
            )
            answer = self._normalize_answer(raw_answer)

        return ChatResponse(
            answer=answer,
            citations=[target] if target else [],
            inferred_updates=updates,
            pending_resolution_clause_id=session.pending_resolution_clause_id,
        )

    def _truncate_chunk(self, text: str) -> str:
        if len(text) <= self._chunk_char_limit:
            return text
        return text[: self._chunk_char_limit].rstrip() + "..."

    async def _get_semantic_chunks(
        self,
        focused_clause: str,
        syntax_notes: str,
        user_message: str,
    ) -> list[str]:
        query = (
            "Find passages useful to resolve this vulnerable ESG clause. "
            f"Clause: {focused_clause}. "
            f"Issue context: {syntax_notes}. "
            f"Investor request: {user_message}."
        )
        payload = {"query": query, "top_k": self._retrieve_top_k}
        try:
            async with httpx.AsyncClient(timeout=self._retrieve_timeout_seconds) as client:
                resp = await client.post(self._retrieve_url, json=payload)
                if resp.status_code >= 400:
                    return []
                body: dict[str, Any] = resp.json()
        except Exception:
            return []

        raw_chunks = body.get("chunks", [])
        if not isinstance(raw_chunks, list):
            return []
        chunks = [chunk for chunk in raw_chunks if isinstance(chunk, str) and chunk.strip()]
        return [self._truncate_chunk(chunk.strip()) for chunk in chunks]

    def _normalize_answer(self, text: str) -> str:
        return re.sub(r"\n{3,}", "\n\n", (text or "").strip())

    def _parse_replacement_answer(self, raw: str) -> str:
        cleaned = (raw or "").strip()
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
        if match:
            cleaned = match.group(1).strip()
        try:
            parsed = json.loads(cleaned)
            clause = str(parsed.get("rectified_clause", "")).strip()
            why = str(parsed.get("why", "")).strip()
            if clause:
                if why:
                    return f"Rectified Clause:\n{clause}\n\nWhy:\n{why}"
                return f"Rectified Clause:\n{clause}"
        except Exception:
            pass
        return self._normalize_answer(raw)
