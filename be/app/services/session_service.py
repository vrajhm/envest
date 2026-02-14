from __future__ import annotations

from datetime import UTC, datetime

from app.models.schemas import (
    SessionRecord,
    SessionStartRequest,
    SessionStartResponse,
    TrackedVulnerableClause,
)
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
        existing = await self._vector_store.get_review_session(path_session_id)
        if existing and not force:
            raise SessionConflictError(f"session_id '{path_session_id}' already exists")

        now = datetime.now(UTC)

        per_goal_payloads: list[dict] = []
        per_goal_vectors: list[list[float]] = []
        per_goal_ids: list[str] = []
        for idx, goal in enumerate(request.per_goal_scores, start=1):
            goal_id = f"goal_{idx:03d}"
            per_goal_ids.append(goal_id)
            per_goal_payloads.append(
                {
                    "session_id": path_session_id,
                    "goal_id": goal_id,
                    "goal": goal.goal,
                    "score": goal.score,
                    "notes": goal.notes,
                    "created_at": now.isoformat(),
                }
            )
            per_goal_vectors.append(await self._embeddings.embed_text(f"{goal.goal}\n{goal.score}\n{goal.notes}"))

        tracked_clauses: list[TrackedVulnerableClause] = []
        clause_payloads: list[dict] = []
        clause_vectors: list[list[float]] = []
        clause_ids: list[str] = []

        for idx, clause in enumerate(request.vulnerable_clauses, start=1):
            clause_id = f"clause_{idx:03d}"
            clause_ids.append(clause_id)
            tracked = TrackedVulnerableClause(
                clause_id=clause_id,
                clause_text=clause.clause_text,
                vulnerability_score=clause.vulnerability_score,
                notes=clause.notes,
                similar_bad_examples=clause.similar_bad_examples,
                status="open",
                accepted_change_instructions="",
            )
            tracked_clauses.append(tracked)

            clause_payloads.append(
                {
                    "session_id": path_session_id,
                    "clause_id": clause_id,
                    "clause_text": tracked.clause_text,
                    "vulnerability_score": tracked.vulnerability_score,
                    "notes": tracked.notes,
                    "similar_bad_examples": [e.model_dump() for e in tracked.similar_bad_examples],
                    "status": tracked.status,
                    "accepted_change_instructions": tracked.accepted_change_instructions,
                    "updated_at": now.isoformat(),
                }
            )
            clause_vectors.append(
                await self._embeddings.embed_text(
                    f"{tracked.clause_text}\n{tracked.notes or ''}\n{tracked.vulnerability_score}"
                )
            )

        session_payload = {
            "session_id": path_session_id,
            "overall_trust_score": request.overall_trust_score,
            "per_goal_scores": [g.model_dump() for g in request.per_goal_scores],
            "syntax_notes": request.syntax_notes,
            "status": "active",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "vulnerable_clauses": [c.model_dump() for c in tracked_clauses],
            "artifact_paths": {},
            "pending_resolution_clause_id": None,
        }

        session_vector = await self._embeddings.embed_text(
            f"Trust score: {request.overall_trust_score}\n"
            f"Syntax notes: {request.syntax_notes}\n"
            + "\n".join([f"{g.goal}: {g.score}" for g in request.per_goal_scores])
        )

        await self._vector_store.upsert_review_session(path_session_id, session_vector, session_payload)
        await self._vector_store.batch_upsert_per_goal_scores(
            path_session_id,
            per_goal_ids,
            per_goal_vectors,
            per_goal_payloads,
        )
        await self._vector_store.batch_upsert_vulnerable_clauses(
            path_session_id,
            clause_ids,
            clause_vectors,
            clause_payloads,
        )

        return SessionStartResponse(
            session_id=path_session_id,
            status="overwritten" if existing else "created",
            per_goal_count=len(request.per_goal_scores),
            vulnerable_clause_count=len(request.vulnerable_clauses),
        )

    async def get_session(self, session_id: str) -> SessionRecord:
        payload = await self._vector_store.get_review_session(session_id)
        if not payload:
            raise SessionNotFoundError(f"session_id '{session_id}' not found")
        return SessionRecord.model_validate(payload)

    async def save_session(self, session: SessionRecord) -> None:
        payload = session.model_dump(mode="json")
        session_vector = await self._embeddings.embed_text(
            f"Trust score: {session.overall_trust_score}\n"
            f"Syntax notes: {session.syntax_notes}\n"
            + "\n".join([f"{g.goal}: {g.score}" for g in session.per_goal_scores])
        )
        await self._vector_store.upsert_review_session(session.session_id, session_vector, payload)
