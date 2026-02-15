"""
Envest API
- GET /issues → OpenAQ heatmap GeoJSON
- POST /submit-preferences → Save investor preferences (MongoDB)
"""

import os
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

from dotenv import load_dotenv
from fastapi import FastAPI
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
SF_BOUNDS = {
    "min_lat": 37.7045,
    "max_lat": 37.8333,
    "min_lon": -122.527,
    "max_lon": -122.356,
}

# A fixed neighborhood-style sample grid across SF for stable, realistic heatmaps.
SF_SAMPLE_POINTS = [
    (37.8087, -122.4098),  # Fisherman's Wharf
    (37.7993, -122.3977),  # Financial District
    (37.7936, -122.3930),  # Embarcadero
    (37.7879, -122.4074),  # Union Square
    (37.7841, -122.4116),  # SoMa
    (37.7766, -122.4174),  # Civic Center
    (37.7749, -122.4194),  # Downtown
    (37.7652, -122.4312),  # Mission Dolores
    (37.7599, -122.4148),  # Mission
    (37.7694, -122.4862),  # Golden Gate Park
    (37.7740, -122.4661),  # Haight-Ashbury
    (37.8024, -122.4480),  # Marina
    (37.7925, -122.4382),  # Pacific Heights
    (37.7294, -122.4933),  # Daly City border / SW SF
    (37.7347, -122.3902),  # Bayview
    (37.7460, -122.4177),  # Bernal Heights
]


def normalize_air(aq_value: float) -> float:
    """Scale AQ value (e.g. PM2.5 µg/m³) to 0–1 for heatmap."""
    # 35 µg/m³ ~= unhealthy-for-sensitive-groups threshold for PM2.5.
    return min(1.0, max(0.0, float(aq_value) / 35.0))


def in_sf_bounds(lat: float, lon: float) -> bool:
    return (
        SF_BOUNDS["min_lat"] <= lat <= SF_BOUNDS["max_lat"]
        and SF_BOUNDS["min_lon"] <= lon <= SF_BOUNDS["max_lon"]
    )


def fetch_openaq_sf_points():
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
                if not in_sf_bounds(lat, lon):
                    continue

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


def fetch_pm25_open_meteo(lat: float, lon: float):
    try:
        response = requests.get(
            "https://air-quality-api.open-meteo.com/v1/air-quality",
            params={
                "latitude": lat,
                "longitude": lon,
                "hourly": "pm2_5",
                "past_days": 1,
                "forecast_days": 0,
                "timezone": "UTC",
            },
            timeout=10,
        )
        if response.status_code != 200:
            return None

        payload = response.json()
        hourly = payload.get("hourly") or {}
        values = hourly.get("pm2_5") or []
        values = [v for v in values if v is not None]
        if not values:
            return None
        return float(values[-1])
    except Exception as e:
        print("Open-Meteo error:", e)
        return None


def fetch_open_meteo_sf_points():
    features = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(fetch_pm25_open_meteo, lat, lon): (lat, lon)
            for lat, lon in SF_SAMPLE_POINTS
        }
        for future in as_completed(futures):
            lat, lon = futures[future]
            value = future.result()
            if value is None:
                continue

            features.append({
                "type": "Feature",
                "properties": {
                    "category": "PM2.5",
                    "source": "Open-Meteo (modeled)",
                    "severity": normalize_air(value),
                    "raw_value": round(value, 2),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat],
                },
            })
    return features


@app.get("/issues")
def get_issues():
    # Prefer real station points from OpenAQ when available, and fill coverage with
    # modeled SF PM2.5 points from Open-Meteo so the heatmap stays realistic.
    features = fetch_openaq_sf_points()
    modeled = fetch_open_meteo_sf_points()
    features.extend(modeled)

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
