"""
Envest API
- GET /issues → OpenAQ heatmap GeoJSON
- POST /submit-preferences → Save investor preferences (MongoDB)
"""

import os
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
import requests

load_dotenv()

app = FastAPI(title="Envest API")

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- OpenAQ ----------------
OPENAQ_API_KEY = os.getenv("OPENAQ_API_KEY")


def normalize_air(aq_value: float) -> float:
    """Scale AQ value (e.g. PM2.5 µg/m³) to 0–1 for heatmap."""
    # 35 µg/m³ ~= unhealthy-for-sensitive-groups threshold for PM2.5.
    return min(1.0, max(0.0, float(aq_value) / 35.0))


def fetch_openaq_points():
    if not OPENAQ_API_KEY:
        return []

    headers = {"X-API-Key": OPENAQ_API_KEY}
    parameters = [2]  # PM2.5 only
    features = []

    for param_id in parameters:
        url = f"https://api.openaq.org/v3/parameters/{param_id}/latest"
        try:
            response = requests.get(
                url,
                headers=headers,
                params={"limit": 1000},
                timeout=12,
            )
            if response.status_code != 200:
                continue

            data = response.json()
            for item in data.get("results", []):
                coords = item.get("coordinates") or {}
                lat = coords.get("latitude")
                lon = coords.get("longitude")
                value = item.get("value")
                if lat is None or lon is None or value is None:
                    continue
                lat = float(lat)
                lon = float(lon)

                features.append({
                    "type": "Feature",
                    "properties": {
                        "category": "PM2.5",
                        "source": "OpenAQ",
                        "severity": normalize_air(value),
                        "raw_value": round(float(value), 2),
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [lon, lat],
                    },
                })
        except Exception as e:
            print("OpenAQ error:", e)
            continue

    return features


@app.get("/issues")
def get_issues(response: Response):
    response.headers["Cache-Control"] = "public, max-age=60"

    # Global heatmap from real OpenAQ PM2.5 points only.
    features = fetch_openaq_points()

    return {
        "type": "FeatureCollection",
        "features": features
    }


# ---------------- MongoDB ----------------
client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
db = client["climate_investor_db"]
collection = db["investor_preferences"]


class InvestorPreference(BaseModel):
    company_name: str = ""
    investment_amount: str
    risk_tolerance: int
    climate_concerns: list[str]
    location: str


@app.post("/submit-preferences")
def submit_preferences(data: InvestorPreference):
    document = {
        **data.dict(),
        "created_at": datetime.utcnow(),
    }
    result = collection.insert_one(document)
    return {"message": "Saved", "id": str(result.inserted_id)}
