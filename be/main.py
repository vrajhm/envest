"""
Unified backend: OpenAQ heatmap (GET /issues) + investor preferences (POST /submit-preferences).
"""
import os
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
import requests

load_dotenv()

app = FastAPI(
    title="Envest API",
    description="Air quality (OpenAQ) + investor preferences",
)

# CORS: allow frontend dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# OpenAQ (heatmap)
# ---------------------------------------------------------------------------
OPENAQ_API_KEY = os.environ.get("OPENAQ_API_KEY", "")


def normalize_air(aq_value):
    """Scale AQ value (e.g. PM2.5 µg/m³) to 0–1 for heatmap."""
    return min(1.0, max(0.0, float(aq_value) / 100.0))


@app.get("/issues")
def get_issues():
    """GeoJSON FeatureCollection of latest OpenAQ PM2.5 for the heatmap."""
    if not OPENAQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="OpenAQ API key not set. Add OPENAQ_API_KEY to your environment. Get a key at https://explore.openaq.org/",
        )
    features = []
    url = "https://api.openaq.org/v3/parameters/2/latest"
    headers = {"X-API-Key": OPENAQ_API_KEY}
    params = {"limit": 200}
    response = requests.get(url, headers=headers, params=params, timeout=15)
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"OpenAQ API error: {response.status_code}")
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
            "properties": {"category": "air_pollution", "severity": normalize_air(value)},
            "geometry": {"type": "Point", "coordinates": [float(lon), float(lat)]},
        })
    return {"type": "FeatureCollection", "features": features}


# ---------------------------------------------------------------------------
# Investor preferences (MongoDB)
# ---------------------------------------------------------------------------
client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
db = client["climate_investor_db"]
collection = db["investor_preferences"]


class InvestorPreference(BaseModel):
    company_name: str = ""
    investment_amount: str
    risk_tolerance: int = 5  # 1–10 scale
    climate_concerns: list[str]
    location: str


@app.options("/submit-preferences")
def submit_preferences_options():
    return {}


@app.post("/submit-preferences")
def submit_preferences(data: InvestorPreference):
    document = {
        "company_name": data.company_name,
        "investment_amount": data.investment_amount,
        "risk_tolerance": data.risk_tolerance,
        "climate_concerns": data.climate_concerns,
        "location": data.location,
        "created_at": datetime.utcnow(),
    }
    result = collection.insert_one(document)
    return {"message": "Preferences saved successfully", "id": str(result.inserted_id)}
