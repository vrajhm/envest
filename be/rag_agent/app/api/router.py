from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.issues import router as issues_router
from app.api.routes.reviews import router as reviews_router
from app.api.routes.simple import router as simple_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(issues_router, tags=["issues"])
api_router.include_router(simple_router, prefix="/v1", tags=["simple"])
api_router.include_router(reviews_router, prefix="/v1/reviews", tags=["reviews"])
