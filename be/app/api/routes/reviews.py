from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_chat_service, get_cleanup_service, get_session_service
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    CleanupGenerateRequest,
    CleanupGenerateResponse,
    SessionArtifactsResponse,
    SessionRecord,
    SessionStartRequest,
    SessionStartResponse,
)
from app.services.cleanup_service import CleanupService
from app.services.chat_service import ChatService
from app.services.session_service import SessionConflictError, SessionNotFoundError, SessionService

router = APIRouter()


@router.post("/sessions/{session_id}/start", response_model=SessionStartResponse)
async def start_session(
    session_id: str,
    request: SessionStartRequest,
    force: bool = Query(default=False),
    session_service: SessionService = Depends(get_session_service),
) -> SessionStartResponse:
    try:
        return await session_service.start_session(path_session_id=session_id, request=request, force=force)
    except SessionConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/sessions/{session_id}", response_model=SessionRecord)
async def get_session(
    session_id: str,
    session_service: SessionService = Depends(get_session_service),
) -> SessionRecord:
    try:
        return await session_service.get_session(session_id)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/chat", response_model=ChatResponse)
async def chat_in_session(
    session_id: str,
    request: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    try:
        return await chat_service.chat(session_id=session_id, request=request)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/cleanup/generate", response_model=CleanupGenerateResponse)
async def generate_cleanup(
    session_id: str,
    request: CleanupGenerateRequest,
    cleanup_service: CleanupService = Depends(get_cleanup_service),
) -> CleanupGenerateResponse:
    try:
        return await cleanup_service.generate_cleanup(session_id=session_id, request=request)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/sessions/{session_id}/artifacts", response_model=SessionArtifactsResponse)
async def get_artifacts(
    session_id: str,
    cleanup_service: CleanupService = Depends(get_cleanup_service),
) -> SessionArtifactsResponse:
    try:
        return await cleanup_service.get_artifacts(session_id=session_id)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
