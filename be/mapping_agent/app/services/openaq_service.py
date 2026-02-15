from __future__ import annotations

import httpx


def normalize_air(aq_value: float) -> float:
    return min(1.0, max(0.0, float(aq_value) / 35.0))


async def fetch_openaq_geojson(openaq_api_key: str) -> dict:
    if not openaq_api_key:
        return {"type": "FeatureCollection", "features": []}

    url = "https://api.openaq.org/v3/parameters/2/latest"
    features: list[dict] = []

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(
                url,
                headers={"X-API-Key": openaq_api_key},
                params={"limit": 1000},
            )
            if response.status_code != 200:
                return {"type": "FeatureCollection", "features": []}

            payload = response.json()
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
