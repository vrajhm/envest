from fastapi import APIRouter, Request

from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    services = getattr(request.app.state, "services", None)
    if services is None:
        return HealthResponse(
            status="ok",
            vector_backend="unknown",
            vector_db="not_initialized",
            vector_client_installed=False,
            embedding_configured=False,
            embedding_model="unknown",
            gemini_configured=False,
            gemini_model="unknown",
            details={},
        )
    vector_store = services.vector_store
    embeddings = services.embeddings
    gemini = services.gemini_service

    reachable, _ = await vector_store.ping()
    if vector_store.backend == "memory":
        vector_state = "connected"
    elif not vector_store.client_installed:
        vector_state = "client_missing"
    elif not vector_store.connected:
        vector_state = "not_connected"
    elif reachable:
        vector_state = "connected"
    else:
        vector_state = "unreachable"

    return HealthResponse(
        status="ok",
        vector_backend=vector_store.backend,
        vector_db=vector_state,
        vector_client_installed=vector_store.client_installed,
        embedding_configured=embeddings.configured,
        embedding_model=embeddings.model,
        gemini_configured=gemini.configured,
        gemini_model=gemini.model,
        details={
            "vector_last_error": vector_store.last_error or "",
            "embedding_last_error": embeddings.last_error or "",
            "gemini_last_error": gemini.last_error or "",
        },
    )
