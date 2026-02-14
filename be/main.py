from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

app = FastAPI()

# Allow frontend (include common dev origins so preflight OPTIONS succeeds)
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

# MongoDB connection (defaults to localhost for local dev)
client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
db = client["climate_investor_db"]
collection = db["investor_preferences"]

# -------------------------
# Data Model
# -------------------------
class InvestorPreference(BaseModel):
    company_name: str = ""
    investment_amount: str
    climate_concerns: list[str]
    location: str

# -------------------------
# Routes
# -------------------------
@app.options("/submit-preferences")
def submit_preferences_options():
    return {}

@app.post("/submit-preferences")
def submit_preferences(data: InvestorPreference):
    document = {
        "company_name": data.company_name,
        "investment_amount": data.investment_amount,
        "climate_concerns": data.climate_concerns,
        "location": data.location,
        "created_at": datetime.utcnow()
    }

    result = collection.insert_one(document)

    return {
        "message": "Preferences saved successfully",
        "id": str(result.inserted_id)
    }
