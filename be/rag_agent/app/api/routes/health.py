from fastapi import APIRouter, Request

from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    services = request.app.state.services
    ok, detail = await services.vector_store.ping()
    return HealthResponse(
        status="ok",
        vector_backend=services.vector_store.backend,
        vector_db="connected" if ok else "unreachable",
        vector_client_installed=services.vector_store.client_installed,
        embedding_configured=services.embeddings.configured,
        embedding_model=services.embeddings.model,
        gemini_configured=services.gemini_service.configured,
        gemini_model=services.gemini_service.model,
        details={
            "vector_last_error": services.vector_store.last_error,
            "embedding_last_error": services.embeddings.last_error,
            "gemini_last_error": services.gemini_service.last_error,
            "vector_ping": detail,
        },
    )
