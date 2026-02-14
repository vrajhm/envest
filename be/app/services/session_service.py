from __future__ import annotations

from datetime import UTC, datetime

from app.models.schemas import NitpickIssueInput, SessionRecord, SessionStartRequest, SessionStartResponse
from app.services.embeddings import EmbeddingsService
from app.services.vector_store import VectorStoreService


class SessionConflictError(Exception):
    pass


class SessionNotFoundError(Exception):
    pass


class SessionService:
    def __init__(self, vector_store: VectorStoreService, embeddings: EmbeddingsService) -> None:
        self._vector_store = vector_store
        self._embeddings = embeddings

    async def start_session(
        self,
        path_session_id: str,
        request: SessionStartRequest,
        force: bool = False,
    ) -> SessionStartResponse:
        if path_session_id != request.session_id:
            raise ValueError("Path session_id must match request.session_id")

        existing = await self._vector_store.get_review_session(request.session_id)
        if existing and not force:
            raise SessionConflictError(f"session_id '{request.session_id}' already exists")

        now = datetime.now(UTC)
        known_chunk_ids = {chunk.chunk_id for chunk in request.document_chunks}

        chunk_payloads: list[dict] = []
        chunk_vectors: list[list[float]] = []
        for chunk in request.document_chunks:
            chunk_payloads.append(
                {
                    "session_id": request.session_id,
                    "doc_id": request.doc_id,
                    "chunk_id": chunk.chunk_id,
                    "text": chunk.text,
                    "source_name": chunk.source_name,
                    "citations": chunk.citations,
                    "created_at": now.isoformat(),
                }
            )
            chunk_vectors.append(await self._embeddings.embed_text(chunk.text))

        dropped_citations = 0
        sanitized_nitpicks: list[NitpickIssueInput] = []
        nitpick_payloads: list[dict] = []
        nitpick_vectors: list[list[float]] = []

        for issue in request.nitpicks:
            valid_citations = [c for c in issue.citations if c in known_chunk_ids]
            dropped_citations += len(issue.citations) - len(valid_citations)

            cleaned_issue = issue.model_copy(update={"citations": valid_citations})
            sanitized_nitpicks.append(cleaned_issue)

            nitpick_payloads.append(
                {
                    "session_id": request.session_id,
                    "doc_id": request.doc_id,
                    "issue_id": cleaned_issue.issue_id,
                    "title": cleaned_issue.title,
                    "severity": cleaned_issue.severity,
                    "status": cleaned_issue.status,
                    "summary": cleaned_issue.summary,
                    "citations": valid_citations,
                    "suggested_changes": cleaned_issue.suggested_changes,
                    "accepted_change_instructions": cleaned_issue.accepted_change_instructions,
                    "updated_at": now.isoformat(),
                }
            )
            nitpick_vectors.append(
                await self._embeddings.embed_text(
                    f"{cleaned_issue.title}\n{cleaned_issue.summary}\n{cleaned_issue.severity}"
                )
            )

        session_payload = {
            "session_id": request.session_id,
            "company_name": request.company_name,
            "doc_id": request.doc_id,
            "doc_title": request.doc_title,
            "full_document_text": request.full_document_text,
            "green_score": request.green_score,
            "status": "active",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "chunk_ids": [chunk.chunk_id for chunk in request.document_chunks],
            "nitpicks": [n.model_dump() for n in sanitized_nitpicks],
            "artifact_paths": {},
            "pending_resolution_issue_id": None,
        }

        session_vector = await self._embeddings.embed_text(
            f"{request.company_name}\n{request.doc_title}\n{request.doc_id}"
        )

        await self._vector_store.upsert_review_session(request.session_id, session_vector, session_payload)
        await self._vector_store.batch_upsert_document_chunks(
            request.session_id,
            [chunk.chunk_id for chunk in request.document_chunks],
            chunk_vectors,
            chunk_payloads,
        )
        await self._vector_store.batch_upsert_nitpick_issues(
            request.session_id,
            [issue.issue_id for issue in sanitized_nitpicks],
            nitpick_vectors,
            nitpick_payloads,
        )

        return SessionStartResponse(
            session_id=request.session_id,
            status="overwritten" if existing else "created",
            chunk_count=len(request.document_chunks),
            nitpick_count=len(request.nitpicks),
            dropped_citation_count=dropped_citations,
        )

    async def get_session(self, session_id: str) -> SessionRecord:
        payload = await self._vector_store.get_review_session(session_id)
        if not payload:
            raise SessionNotFoundError(f"session_id '{session_id}' not found")
        return SessionRecord.model_validate(payload)

    async def save_session(self, session: SessionRecord) -> None:
        payload = session.model_dump(mode="json")
        session_vector = await self._embeddings.embed_text(
            f"{session.company_name}\n{session.doc_title}\n{session.doc_id}"
        )
        await self._vector_store.upsert_review_session(session.session_id, session_vector, payload)
