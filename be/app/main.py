from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.services.container import build_services

settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    services = build_services()
    app.state.services = services
    try:
        await services.vector_store.connect()
        await services.vector_store.ensure_collections()
    except Exception as exc:  # pragma: no cover
        logger.warning("Vector store startup check failed: %s", exc)
    yield
    await services.vector_store.close()


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.include_router(api_router)
