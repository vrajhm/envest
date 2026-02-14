from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


class DocumentChunkInput(BaseModel):
    chunk_id: str
    text: str
    source_name: str
    citations: list[str] = Field(default_factory=list)


class NitpickIssueInput(BaseModel):
    issue_id: str
    title: str
    severity: Literal["high", "medium", "low"]
    status: Literal["open", "in_progress", "resolved"] = "open"
    summary: str
    citations: list[str] = Field(default_factory=list)
    suggested_changes: list[str] = Field(default_factory=list)
    accepted_change_instructions: str = ""


class SessionStartRequest(BaseModel):
    session_id: str
    company_name: str
    doc_id: str
    doc_title: str
    full_document_text: str
    green_score: float = Field(ge=0, le=100)
    document_chunks: list[DocumentChunkInput]
    nitpicks: list[NitpickIssueInput]


class SessionStartResponse(BaseModel):
    session_id: str
    status: Literal["created", "overwritten"]
    chunk_count: int
    nitpick_count: int
    dropped_citation_count: int


class SessionRecord(BaseModel):
    session_id: str
    company_name: str
    doc_id: str
    doc_title: str
    full_document_text: str
    green_score: float
    status: Literal["active", "ready_for_cleanup", "completed"]
    created_at: datetime
    updated_at: datetime
    chunk_ids: list[str]
    nitpicks: list[NitpickIssueInput]
    artifact_paths: dict[str, str] = Field(default_factory=dict)
    pending_resolution_issue_id: str | None = None


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
    issue_id: str | None = None


class IssueStatusUpdate(BaseModel):
    issue_id: str
    previous_status: Literal["open", "in_progress", "resolved"]
    new_status: Literal["open", "in_progress", "resolved"]
    reason: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[str] = Field(default_factory=list)
    inferred_updates: list[IssueStatusUpdate] = Field(default_factory=list)
    pending_resolution_issue_id: str | None = None


class CleanupGenerateRequest(BaseModel):
    confirmed: bool = True
    investor_note: str | None = None


class CleanupGenerateResponse(BaseModel):
    session_id: str
    status: Literal["completed"]
    artifact_paths: dict[str, str]
    unresolved_issue_ids: list[str] = Field(default_factory=list)
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
