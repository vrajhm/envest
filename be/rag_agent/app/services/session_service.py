from __future__ import annotations

from datetime import UTC, datetime

from app.models.schemas import SessionRecord, SessionStartRequest, SessionStartResponse, TrackedVulnerableClause
from app.services.vector_store import VectorStoreService


class SessionConflictError(Exception):
    pass


class SessionNotFoundError(Exception):
    pass


class SessionService:
    def __init__(self, vector_store: VectorStoreService) -> None:
        self._vector_store = vector_store

    async def start_session(self, path_session_id: str, request: SessionStartRequest, force: bool = False) -> SessionStartResponse:
        existing = await self._vector_store.get_review_session(path_session_id)
        if existing and not force:
            raise SessionConflictError(f"session_id '{path_session_id}' already exists")

        now = datetime.now(UTC)
        tracked: list[TrackedVulnerableClause] = []
        for idx, clause in enumerate(request.vulnerable_clauses, start=1):
            tracked.append(
                TrackedVulnerableClause(
                    clause_id=f"clause_{idx:03d}",
                    clause_text=clause.clause_text,
                    vulnerability_score=clause.vulnerability_score,
                    notes=clause.notes,
                    similar_bad_examples=clause.similar_bad_examples,
                    status="open",
                    accepted_change_instructions="",
                )
            )

        record = SessionRecord(
            session_id=path_session_id,
            overall_trust_score=request.overall_trust_score,
            per_goal_scores=request.per_goal_scores,
            syntax_notes=request.syntax_notes,
            status="active",
            created_at=now,
            updated_at=now,
            vulnerable_clauses=tracked,
            artifact_paths={},
            pending_resolution_clause_id=None,
        )
        await self._vector_store.upsert_review_session(path_session_id, record.model_dump(mode="json"))

        return SessionStartResponse(
            session_id=path_session_id,
            status="overwritten" if existing else "created",
            per_goal_count=len(request.per_goal_scores),
            vulnerable_clause_count=len(request.vulnerable_clauses),
        )

    async def get_session(self, session_id: str) -> SessionRecord:
        payload = await self._vector_store.get_review_session(session_id)
        if payload is None:
            raise SessionNotFoundError(f"session_id '{session_id}' not found")
        return SessionRecord.model_validate(payload)

    async def save_session(self, session: SessionRecord) -> None:
        await self._vector_store.upsert_review_session(session.session_id, session.model_dump(mode="json"))
