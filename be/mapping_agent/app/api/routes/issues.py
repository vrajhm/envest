from fastapi import APIRouter, Response

from app.core.config import get_settings
from app.services.openaq_service import fetch_openaq_geojson

router = APIRouter()
settings = get_settings()


@router.get("/issues")
async def get_issues(response: Response) -> dict:
    response.headers["Cache-Control"] = "public, max-age=60"
    return await fetch_openaq_geojson(settings.openaq_api_key)
