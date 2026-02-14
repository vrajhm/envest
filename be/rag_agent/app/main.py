from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.services.container import build_services

settings = get_settings()
configure_logging(settings.log_level)


@asynccontextmanager
async def lifespan(app: FastAPI):
    services = build_services()
    app.state.services = services
    await services.vector_store.connect()
    await services.vector_store.ensure_collections()
    yield
    await services.vector_store.close()


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.include_router(api_router)
