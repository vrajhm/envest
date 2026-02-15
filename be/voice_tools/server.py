from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

from tavily_service import search_web, search_company, search_claim

app = FastAPI(title="Voice Tools API")

# CORS - allow all for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get API key from environment
def get_tavily_key() -> str:
    return os.getenv("TAVILY_API_KEY", "")


# Request/Response Models
class SearchRequest(BaseModel):
    query: str


class CompanySearchRequest(BaseModel):
    company_name: str


class SubmitRequest(BaseModel):
    transcript: str
    flagged_items: List[dict]
    search_findings: dict
    risk_score: float
    recommended_questions: List[str]
    company_name: str = ""


# Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "voice_tools"}


@app.post("/search")
async def search(request: SearchRequest):
    """
    Generic web search endpoint.
    Used by ElevenLabs voice agent to search for information.
    """
    api_key = get_tavily_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="TAVILY_API_KEY not configured")
    
    result = await search_web(request.query, api_key)
    return result


@app.post("/search/company")
async def search_company_endpoint(request: CompanySearchRequest):
    """
    Search for company information.
    Returns CEO, funding, news, and other company details.
    """
    api_key = get_tavily_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="TAVILY_API_KEY not configured")
    
    result = await search_company(request.company_name, api_key)
    return result


@app.post("/search/claim")
async def search_claim_endpoint(request: SearchRequest):
    """
    Search to verify a specific claim.
    """
    api_key = get_tavily_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="TAVILY_API_KEY not configured")
    
    result = await search_claim(request.query, api_key)
    return result


@app.post("/submit")
async def submit_results(request: SubmitRequest):
    """
    Submit validation results to frontend.
    This sends the analysis results to be displayed on the frontend.
    
    Frontend polls GET /submissions/latest to get results.
    """
    submission = {
        "transcript": request.transcript,
        "flagged_items": request.flagged_items,
        "search_findings": request.search_findings,
        "risk_score": request.risk_score,
        "recommended_questions": request.recommended_questions,
        "company_name": request.company_name,
        "timestamp": "now"
    }
    
    app.state.latest_submission = submission
    
    return {"status": "received"}


@app.get("/submissions/latest")
async def get_latest_submission():
    """Get the latest submission for frontend polling."""
    if not hasattr(app.state, "latest_submission"):
        return {"status": "no_submissions"}
    
    return {
        "status": "ok",
        "data": app.state.latest_submission
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
