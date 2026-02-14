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
        vector_ok, vector_detail = await services.vector_store.ping()
        logger.info(
            "Vector preflight: backend=%s ok=%s detail=%s",
            services.vector_store.backend,
            vector_ok,
            vector_detail,
        )
    except Exception as exc:  # pragma: no cover
        logger.warning("Vector store startup check failed: %s", exc)

    if services.embeddings.configured:
        logger.info("Embeddings preflight: configured model=%s", services.embeddings.model)
    else:
        logger.warning("Embeddings preflight: fallback mode (%s)", services.embeddings.last_error)

    if services.gemini_service.configured:
        logger.info("Gemini preflight: configured model=%s", services.gemini_service.model)
    else:
        logger.warning("Gemini preflight: fallback mode (%s)", services.gemini_service.last_error)
    yield
    await services.vector_store.close()


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.include_router(api_router)
