# backend/main.py
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests

app = FastAPI()

# Allow frontend to fetch
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # frontend URLs
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENAQ_API_KEY = os.environ.get("OPENAQ_API_KEY", "")


def normalize_air(aq_value):
    """Convert AQ value (e.g. µg/m³ PM2.5) to 0-1 for heatmap intensity."""
    return min(1.0, max(0.0, float(aq_value) / 100.0))  # scale roughly 0–100 to 0–1


@app.get("/issues")
def get_issues():
    if not OPENAQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="OpenAQ API key not set. Add OPENAQ_API_KEY to your environment. Get a key at https://explore.openaq.org/",
        )

    features = []
    # OpenAQ v3: latest PM2.5 (parameter_id=2) across sensors/locations
    url = "https://api.openaq.org/v3/parameters/2/latest"
    headers = {"X-API-Key": OPENAQ_API_KEY}
    params = {"limit": 200}

    response = requests.get(url, headers=headers, params=params, timeout=15)
    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"OpenAQ API error: {response.status_code}",
        )

    data = response.json()
    for item in data.get("results", []):
        coords = item.get("coordinates") or {}
        lat, lon = coords.get("latitude"), coords.get("longitude")
        if lat is None or lon is None:
            continue
        value = item.get("value")
        if value is None:
            continue
        features.append({
            "type": "Feature",
            "properties": {
                "category": "air_pollution",
                "severity": normalize_air(value),
            },
            "geometry": {
                "type": "Point",
                "coordinates": [float(lon), float(lat)],
            },
        })

    return {"type": "FeatureCollection", "features": features}