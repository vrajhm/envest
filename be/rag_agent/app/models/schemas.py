from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


class PerGoalScoreInput(BaseModel):
    goal: str = Field(min_length=1)
    score: int = Field(ge=0, le=100)
    notes: str = Field(min_length=1)


class SimilarBadExampleInput(BaseModel):
    example_clause: str = Field(min_length=1)
    source: str = Field(min_length=1)


class VulnerableClauseInput(BaseModel):
    clause_text: str = Field(min_length=1)
    vulnerability_score: int = Field(ge=0, le=100)
    notes: str | None = None
    similar_bad_examples: list[SimilarBadExampleInput] = Field(default_factory=list)


class TrackedVulnerableClause(VulnerableClauseInput):
    clause_id: str
    status: Literal["open", "in_progress", "resolved"] = "open"
    accepted_change_instructions: str = ""


class SessionStartRequest(BaseModel):
    overall_trust_score: int = Field(ge=0, le=100)
    per_goal_scores: list[PerGoalScoreInput] = Field(default_factory=list)
    syntax_notes: str = Field(min_length=1)
    vulnerable_clauses: list[VulnerableClauseInput] = Field(default_factory=list)


class SessionStartResponse(BaseModel):
    session_id: str
    status: Literal["created", "overwritten"]
    per_goal_count: int
    vulnerable_clause_count: int


class SessionRecord(BaseModel):
    session_id: str
    overall_trust_score: int = Field(ge=0, le=100)
    per_goal_scores: list[PerGoalScoreInput] = Field(default_factory=list)
    syntax_notes: str
    status: Literal["active", "ready_for_cleanup", "completed"]
    created_at: datetime
    updated_at: datetime
    vulnerable_clauses: list[TrackedVulnerableClause] = Field(default_factory=list)
    artifact_paths: dict[str, str] = Field(default_factory=dict)
    pending_resolution_clause_id: str | None = None


class HealthResponse(BaseModel):
    status: str
    vector_backend: str
    vector_db: str
    vector_client_installed: bool
    embedding_configured: bool
    embedding_model: str
    gemini_configured: bool
    gemini_model: str
    details: dict[str, str] = Field(default_factory=dict)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    conversation_id: str = "default"
    clause_id: str | None = None
    include_replacement_clause: bool = False


class ClauseStatusUpdate(BaseModel):
    clause_id: str
    previous_status: Literal["open", "in_progress", "resolved"]
    new_status: Literal["open", "in_progress", "resolved"]
    reason: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[str] = Field(default_factory=list)
    inferred_updates: list[ClauseStatusUpdate] = Field(default_factory=list)
    pending_resolution_clause_id: str | None = None


class CleanupGenerateRequest(BaseModel):
    confirmed: bool = True
    investor_note: str | None = None


class CleanupGenerateResponse(BaseModel):
    session_id: str
    status: Literal["completed"]
    artifact_paths: dict[str, str]
    investor_email_draft: str
    unresolved_clause_ids: list[str] = Field(default_factory=list)
    change_log: list[str] = Field(default_factory=list)


class SessionArtifactsResponse(BaseModel):
    session_id: str
    artifact_paths: dict[str, str]
    existing_artifacts: dict[str, bool]

    @classmethod
    def from_paths(cls, session_id: str, paths: dict[str, str]) -> "SessionArtifactsResponse":
        return cls(
            session_id=session_id,
            artifact_paths=paths,
            existing_artifacts={name: Path(path).exists() for name, path in paths.items()},
        )
