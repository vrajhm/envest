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
from app.services.chat_service import ChatService
from app.services.cleanup_service import CleanupService
from app.services.session_service import SessionConflictError, SessionNotFoundError, SessionService

router = APIRouter()
ACTIVE_SESSION_ID = "active"


@router.post("/context/load", response_model=SessionStartResponse)
async def load_context(
    request: SessionStartRequest,
    force: bool = Query(default=True),
    session_service: SessionService = Depends(get_session_service),
) -> SessionStartResponse:
    try:
        return await session_service.start_session(path_session_id=ACTIVE_SESSION_ID, request=request, force=force)
    except SessionConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/context", response_model=SessionRecord)
async def get_context(session_service: SessionService = Depends(get_session_service)) -> SessionRecord:
    try:
        return await session_service.get_session(ACTIVE_SESSION_ID)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="No active context loaded. Call POST /v1/context/load first.") from exc


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    try:
        return await chat_service.chat(session_id=ACTIVE_SESSION_ID, request=request)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="No active context loaded. Call POST /v1/context/load first.") from exc


@router.post("/cleanup/generate", response_model=CleanupGenerateResponse)
async def generate_cleanup(
    request: CleanupGenerateRequest,
    cleanup_service: CleanupService = Depends(get_cleanup_service),
) -> CleanupGenerateResponse:
    try:
        return await cleanup_service.generate_cleanup(session_id=ACTIVE_SESSION_ID, request=request)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="No active context loaded. Call POST /v1/context/load first.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/artifacts", response_model=SessionArtifactsResponse)
async def get_artifacts(cleanup_service: CleanupService = Depends(get_cleanup_service)) -> SessionArtifactsResponse:
    try:
        return await cleanup_service.get_artifacts(session_id=ACTIVE_SESSION_ID)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="No active context loaded. Call POST /v1/context/load first.") from exc
