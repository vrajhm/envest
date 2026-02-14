from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.services.container import build_services

settings = get_settings()
configure_logging(settings.log_level)

app = FastAPI(title=settings.app_name)
app.include_router(api_router)


@app.on_event("startup")
async def on_startup() -> None:
    app.state.services = build_services()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    services = getattr(app.state, "services", None)
    if services:
        await services.vector_store.close()
