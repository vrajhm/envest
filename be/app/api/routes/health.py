from fastapi import APIRouter, Request

from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    services = getattr(request.app.state, "services", None)
    if services is None:
        return HealthResponse(status="ok", vector_db="not_initialized")
    vector_store = services.vector_store
    vector_state = "connected" if getattr(vector_store, "_connected", False) else "not_connected"
    return HealthResponse(status="ok", vector_db=vector_state)
