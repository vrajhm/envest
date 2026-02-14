from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

app = FastAPI()

# Allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
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
    investment_amount: str
    climate_concerns: list[str]
    location: str

# -------------------------
# Routes
# -------------------------
@app.post("/submit-preferences")
def submit_preferences(data: InvestorPreference):
    document = {
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
