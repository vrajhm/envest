from __future__ import annotations

from fastapi import APIRouter, Response
import httpx

from app.core.config import get_settings

router = APIRouter()
settings = get_settings()


def normalize_air(aq_value: float) -> float:
    """Scale PM2.5 values to 0-1 for map heat intensity."""
    return min(1.0, max(0.0, float(aq_value) / 35.0))


@router.get("/issues")
async def get_issues(response: Response) -> dict:
    response.headers["Cache-Control"] = "public, max-age=60"

    api_key = settings.openaq_api_key
    if not api_key:
        return {"type": "FeatureCollection", "features": []}

    features: list[dict] = []
    url = "https://api.openaq.org/v3/parameters/2/latest"

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(
                url,
                headers={"X-API-Key": api_key},
                params={"limit": 1000},
            )
            if r.status_code != 200:
                return {"type": "FeatureCollection", "features": []}

            payload = r.json()
            for item in payload.get("results", []):
                coords = item.get("coordinates") or {}
                lat = coords.get("latitude")
                lon = coords.get("longitude")
                value = item.get("value")
                if lat is None or lon is None or value is None:
                    continue

                value_float = float(value)
                features.append(
                    {
                        "type": "Feature",
                        "properties": {
                            "category": "PM2.5",
                            "source": "OpenAQ",
                            "severity": normalize_air(value_float),
                            "raw_value": round(value_float, 2),
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [float(lon), float(lat)],
                        },
                    }
                )
    except Exception:
        return {"type": "FeatureCollection", "features": []}

    return {"type": "FeatureCollection", "features": features}
