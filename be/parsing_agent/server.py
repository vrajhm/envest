"""
LlamaParse + scoring: parse climate contracts, then score alignment with investor goals.
Uses vector retrieval (top-k chunks) to avoid sending the full document to the LLM.
"""
import asyncio
import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from llama_cloud import AsyncLlamaCloud
from llama_index.core import Document, VectorStoreIndex, Settings
from llama_index.embeddings.google_genai import GoogleGenAIEmbedding
from llama_index.llms.google_genai import GoogleGenAI
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
import uvicorn

# Load .env from this directory or parent
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv()

LLAMA_API_KEY = os.getenv("LLAMA_CLOUD_API_KEY") or os.getenv("llamaparse_api_key")

app = FastAPI(title="LlamaParse + Contract Scoring", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger = logging.getLogger("parsing_agent")

# MongoDB connection
mongo_client = AsyncIOMotorClient(
    os.getenv("MONGO_URI"),
    tls=True,
    tlsAllowInvalidCertificates=True
)
db = mongo_client["climate_investor_db"]
investor_collection = db["investor_preferences"]

# Cached test investor
_test_investor = None


async def _get_test_investor():
    """Get the test investor from MongoDB, caching in memory."""
    global _test_investor
    if _test_investor is None:
        _test_investor = await investor_collection.find_one({"_id": "test_user"})
    return _test_investor


@app.post("/investor/refresh")
async def refresh_investor():
    """Refresh the cached test investor from MongoDB."""
    global _test_investor
    _test_investor = None
    investor = await _get_test_investor()
    if not investor:
        return {"ok": False, "error": "test_user not found"}
    return {"ok": True, "investor": investor.get("company_name", "Unknown")}

# In-memory state: last parsed markdown and vector index (for retrieval only)
_last_markdown: str | None = None
_vector_index: VectorStoreIndex | None = None

DEFAULT_TOP_K = 15


def _get_llm():
    """Build LLM from env. Uses Gemini if GOOGLE_API_KEY is set."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    return GoogleGenAI(model="models/gemini-2.0-flash", api_key=api_key)


def _get_embed_model():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    return GoogleGenAIEmbedding(model_name="gemini-embedding-001", api_key=api_key)


def _build_vector_index(markdown: str) -> VectorStoreIndex | None:
    """Chunk the markdown, embed, and build a vector index for retrieval only."""
    global _vector_index
    if not markdown.strip():
        return None
    embed = _get_embed_model()
    if not embed:
        return None
    Settings.embed_model = embed
    doc = Document(text=markdown)
    _vector_index = VectorStoreIndex.from_documents([doc])
    return _vector_index


def _retrieve_chunks(query: str, top_k: int) -> list[str]:
    """Retrieve top-k chunks from the vector index for the given query."""
    if not _vector_index:
        return []
    retriever = _vector_index.as_retriever(similarity_top_k=top_k)
    nodes = retriever.retrieve(query)
    return [node.node.text for node in nodes]


def _parse_llm_json(raw: str) -> dict:
    """Extract JSON from LLM response (handles markdown code fences)."""
    raw = raw.strip()
    # Strip ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
    if match:
        raw = match.group(1).strip()
    return json.loads(raw)


def _extract_markdown(result) -> tuple[str, str]:
    """Extract markdown text from known Llama parse result fields."""
    candidates = [
        ("markdown_full", getattr(result, "markdown_full", None)),
        ("text_full", getattr(result, "text_full", None)),
    ]
    for source, value in candidates:
        if isinstance(value, str) and value.strip():
            return value, source

    markdown_obj = getattr(result, "markdown", None)
    markdown_pages = getattr(markdown_obj, "pages", None)
    if isinstance(markdown_pages, list):
        markdown_chunks: list[str] = []
        for page in markdown_pages:
            if getattr(page, "success", False) is not True:
                continue
            value = getattr(page, "markdown", None)
            if isinstance(value, str) and value.strip():
                markdown_chunks.append(value)
        if markdown_chunks:
            return "\n\n".join(markdown_chunks), "markdown.pages"

    text_obj = getattr(result, "text", None)
    text_pages = getattr(text_obj, "pages", None)
    if isinstance(text_pages, list):
        text_chunks = [
            page_text
            for page in text_pages
            for page_text in [getattr(page, "text", None)]
            if isinstance(page_text, str) and page_text.strip()
        ]
        if text_chunks:
            return "\n\n".join(text_chunks), "text.pages"

    return "", "none"


# Score request body (optional for future use)
class ScoreBody(BaseModel):
    investor_goals: list[str] | None = None
    top_k: int | None = None


SCORE_PROMPT_TEMPLATE = """You are a senior ESG disclosure analyst with expertise in investor-aligned reporting, greenwashing detection, regulatory scrutiny patterns, and historical ESG controversies.

Your task has two required components:

(1) ALIGNMENT SCORING
Evaluate how well the report's language, commitments, structure, and tone align with the investor priorities below.

(2) VULNERABILITY ANALYSIS
Identify specific clauses that are vulnerable due to:
- Vagueness or undefined terminology
- Loopholes or escape clauses
- Non-quantified commitments
- Lack of timelines or baselines
- Conditional or discretionary language (e.g., "aim to", "seek to", "where feasible")
- Overly broad sustainability claims
- Framing that overstates impact relative to evidence
- Greenwashing-style rhetoric
- Weak accountability mechanisms

You must rely ONLY on the provided excerpts. Do not assume facts not in evidence. No external search is used. Use your internal knowledge of ESG reporting norms and well-known controversies.

KNOWN ESG CONTROVERSIES AND LOOPHOLES TO REFERENCE:

Famous Greenwashing Cases:
- ExxonMobil's "Energy Factor" foundation funding climate denial while company's ESG scores masked actual lobbying
- Volkswagen's "Clean Diesel" scandal where emissions tests were rigged
- BP's "Beyond Petroleum" rebranding while continuing heavy oil investments
- Shell's "major oil company" sustainability reports with vague "net zero" goals
- Amazon's "Climate Pledge" using carbon offsets instead of actual emissions reductions
- Apple's 2030 carbon neutral claims relying heavily on offset projects
- Meta/Google's carbon neutral claims excluding Scope 3 supply chain emissions
- Nestlé's "carbon neutral" coffee claims based on offset schemes
- H&M's "Conscious Collection" sustainability line with vague sustainability claims
- Fast fashion industry's "recycling" programs with low actual recycling rates
- Coca-Cola's "World Without Waste" pledges while remaining the world's largest plastic polluter and fighting binding plastic regulations
- Starbucks' "strawless lids" rollout that actually used more plastic by weight than the previous straw + lid combo
- IKEA's "sustainable wood" sourcing while independent investigations linked products to illegal logging certified as "responsible" by FSC
- Delta's "first carbon neutral airline" claim later challenged as misleading because it relied heavily on low-quality offsets
- Ryanair's "Europe's lowest emissions airline" ads banned by regulators as misleading environmental claims
- HSBC's "financing the transition" climate ads banned for highlighting green investments while omitting ongoing large fossil fuel financing
- Quorn's "low carbon footprint" product marketing found misleading due to unverifiable carbon claims
- Hefty's "recycling" trash bags marketed as environmentally friendly despite not being accepted in most recycling systems
- Bottled water brands touting "eco-friendly caps" while the bottles and caps remain conventional single-use plastic
- Apparel brands (Nike, Superdry, Lacoste) running performance ads around "sustainable" lines with vague criteria and no full lifecycle data
- Shein's "long-term sustainability goals" and "social responsibility" pages with minimal transparency on supplier audits and overproduction
- Bank "sustainable investing" funds (e.g., Active Super) that quietly hold fossil fuels, tobacco, and other excluded sectors while marketing as climate-aligned
- Airports promoting "carbon neutral growth" for new terminals while ignoring induced flight emissions and focusing only on building operations
- Meat producers (e.g., Danish Crown) branding pork as "climate controlled" or "climate improved" despite marginal changes and ongoing high emissions
- Utilities (e.g., Anglian Water) highlighting river restoration projects while downplaying sewage pollution and regulatory violations


Common Loopholes to Detect:
- "We aim to..." / "We seek to..." / "Our goal is to..." without concrete targets
- "Carbon neutral" achieved through offsets rather than emissions reduction
- "Net zero by 2050" commitments without interim targets or scope 3 inclusion
- "Renewable energy" claims using RECs without actual renewable procurement
- "Water neutral" achieved through offset schemes
- "Zero deforestation" commitments excluding leased land
- "Circular economy" claims with low recycling/inclusion rates
- "ESG leader" rankings purchased through ESG rating agencies
- "Science-based targets" that are not officially validated
- "Scope 3 emissions under evaluation" - indefinitely deferred
- "Baseline recalculated" to make emissions appear lower
- "Carbon intensity" metrics instead of absolute emissions
- "Year-over-year improvement" ignoring absolute growth
- "Industry-leading" with no verifiable benchmarks
- "Natural" / "eco-friendly" / "green" labels with no standardized definition or third-party verification
- Highlighting one "green" feature (e.g., lighter packaging) while ignoring overall lifecycle impacts like energy use and end-of-life waste
- Comparing products to a worse baseline ("40% greener than our old model") without disclosing absolute impact
- "Up to X% electric driving" style claims that describe best-case lab conditions, not typical real-world use
- "Sustainability" ads that focus on tiny low-carbon product lines while the core business model remains high-emissions (classic greenlighting)
- Constantly "updating" or "aligning" targets with new methodologies to avoid ever being measured against a fixed goal (greenrinsing)
- Corporate silence on key metrics ("we do not yet report Scope 3 due to data challenges") used as a long-term shield (greenhushing)
- Shifting responsibility to consumers ("it's up to you to recycle/offset") instead of addressing production emissions (greenshifting)
- Hiding behind industry initiatives ("as part of the XYZ Alliance we are committed to…") without disclosing individual performance (greencrowding)
- Packaging that uses earth tones, leaves, or faux-certification seals to imply environmental benefits that don't exist (greenlabelling)
- Emphasis on carbon intensity per unit (per passenger-km, per product) while total absolute emissions continue to rise
- One-off pilot projects (e.g., a single "net zero" store or flight) heavily marketed as if they represent the whole company's operations

Company-Specific Patterns:
- Oil & Gas: Scope 3 exclusion, "transition" language, offset reliance
- Tech: Data center emissions exclusion, renewable claims without additionality
- Fashion: Microfiber pollution, supply chain visibility, wage issues
- Food/Ag: Deforestation, land use, water intensity
- Mining: Tailings dams, Indigenous consent, rehabilitation bonds

If a clause resembles language from any of the above cases, include a comparable example in similar_bad_examples with the company name and year.
If no known example applies, return an empty array [].

--------------------------------------------------
RELEVANT EXCERPTS (ONLY THESE MAY BE USED):

{chunks_text}

INVESTOR PRIORITIES:
{goals_text}
--------------------------------------------------

SCORING GUIDELINES

Overall Trust Score (0–100):
0–20  = Highly misleading, structurally weak, or greenwashing-heavy
21–40 = Major ambiguity, weak commitments
41–60 = Mixed quality; partial alignment with material weaknesses
61–80 = Strong alignment; minor clarity or accountability gaps
81–100 = Highly specific, measurable, time-bound, and credible

Per-Goal Score (0–100):
Evaluate:
- Specificity (quantified vs. vague)
- Measurability (baseline, targets, metrics)
- Time-bound commitments (deadlines vs. "aim to")
- Clear baselines (vs. "recalculated" baselines)
- Accountability signals (board oversight, penalties)
- Direct relevance to investor priority

Vulnerability Score (0–100):
Higher score = more exploitable

0–20  = Clear, precise, measurable
21–40 = Minor ambiguity
41–60 = Noticeable weakness or hedging
61–80 = Significant loopholes or accountability gaps
81–100 = Highly exploitable; resembles known greenwashing patterns

--------------------------------------------------

Output only valid JSON with no other text. Use this exact structure:

{
  "overall_trust_score": <number 0-100>,
  "per_goal_scores": [
    { "goal": "<goal text>", "score": <0-100>, "notes": "<short note>" }
  ],
  "syntax_notes": "<short overall note on document language and legitimacy>",
  "vulnerable_clauses": [
    {
      "clause_text": "<excerpt from the document>",
      "vulnerability_score": <number 0-100, higher = more exploitable>,
      "notes": "<optional short note>",
      "similar_bad_examples": [
        { "example_clause": "<clause from a known ESG report>", "source": "<e.g. Company X 2022 ESG report>" }
      ]
    }
  ]
}

For each vulnerable clause:
- vulnerability_score must be 0–100.
- similar_bad_examples must be an array of objects with example_clause and source.
- If no known comparable example exists, return [].
- Do not fabricate historical examples.
- Do not invent excerpts not present in the provided text.

Be skeptical, analytical, and investor-focused.
"""


@app.post("/parse", response_class=PlainTextResponse)
async def parse_document(file: UploadFile | None = File(None)):
    """
    Parse an ESG report document with LlamaParse (Llama Cloud).
    
    If a file is uploaded, it will be parsed.
    Otherwise, defaults to the local ESG Report.pdf.
    
    Returns the parsed markdown and builds a vector index for later scoring.
    """
    if not LLAMA_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Set LLAMA_CLOUD_API_KEY or llamaparse_api_key in .env",
        )

    if file and file.filename:
        temp_dir = Path(__file__).resolve().parent / ".tmp_uploads"
        temp_dir.mkdir(exist_ok=True)
        path = temp_dir / file.filename
        content = await file.read()
        path.write_bytes(content)
    else:
        path = Path(__file__).resolve().parent / "ESG_Report_2024.docx"
        if not path.is_file():
            raise HTTPException(status_code=400, detail=f"File not found: {path}")

    try:
        async with AsyncLlamaCloud(api_key=LLAMA_API_KEY) as client:
            result = await client.parsing.parse(
                upload_file=str(path),
                tier="cost_effective",
                version="latest",
                expand=["markdown", "text"],
            )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LlamaParse error: {e!s}")

    if result.job.status != "COMPLETED":
        raise HTTPException(
            status_code=502,
            detail=f"Parsing job status: {result.job.status}",
        )

    markdown, markdown_source = _extract_markdown(result)
    logger.info("Parse completed: markdown_source=%s chars=%d", markdown_source, len(markdown))
    if not markdown.strip():
        markdown_obj = getattr(result, "markdown", None)
        markdown_pages = getattr(markdown_obj, "pages", None)
        text_obj = getattr(result, "text", None)
        text_pages = getattr(text_obj, "pages", None)
        markdown_page_count = len(markdown_pages) if isinstance(markdown_pages, list) else 0
        successful_markdown_page_count = 0
        if isinstance(markdown_pages, list):
            successful_markdown_page_count = sum(
                1
                for page in markdown_pages
                if getattr(page, "success", False) is True
                and isinstance(getattr(page, "markdown", None), str)
                and bool(getattr(page, "markdown").strip())
            )
        text_page_count = len(text_pages) if isinstance(text_pages, list) else 0
        logger.warning(
            "Parse completed with empty content: job_id=%s status=%s has_markdown=%s markdown_pages=%d successful_markdown_pages=%d text_pages=%d",
            getattr(result.job, "id", "unknown"),
            getattr(result.job, "status", "unknown"),
            bool(markdown_obj),
            markdown_page_count,
            successful_markdown_page_count,
            text_page_count,
        )
        raise HTTPException(
            status_code=502,
            detail="LlamaParse completed, but no extractable content was found in markdown/text pages.",
        )

    global _last_markdown
    _last_markdown = markdown
    await asyncio.to_thread(_build_vector_index, markdown)

    return markdown


@app.get("/score")
async def score_contract():
    """
    Score the last parsed contract against investor goals from MongoDB.
    Uses one retrieval over the document (top-k chunks for all goals), then an LLM to produce a trust score.
    Requires GOOGLE_API_KEY. Call POST /parse first.
    """
    if not _last_markdown:
        raise HTTPException(
            status_code=400,
            detail="No document parsed yet. Call POST /parse first.",
        )
    
    # Always get investor goals from MongoDB
    investor = await _get_test_investor()
    if not investor:
        raise HTTPException(
            status_code=400,
            detail="test_user not found in MongoDB.",
        )
    investor_goals = investor.get("climate_concerns", [])
    if not investor_goals:
        raise HTTPException(
            status_code=400,
            detail="Test user has no climate_concerns configured in MongoDB.",
        )

    top_k = DEFAULT_TOP_K
    # One retrieval query summarizing all goals
    retrieval_query = "Climate and sustainability commitments, emissions, water usage, environmental obligations, goals and standards: " + " ".join(investor_goals)

    chunks = _retrieve_chunks(retrieval_query, top_k)
    if not chunks:
        # Index may not exist if GOOGLE_API_KEY wasn't configured at parse time
        await asyncio.to_thread(_build_vector_index, _last_markdown)
        chunks = _retrieve_chunks(retrieval_query, top_k)
    if not chunks:
        raise HTTPException(
            status_code=503,
            detail="Vector index unavailable. Set GOOGLE_API_KEY and call POST /parse again.",
        )

    llm = _get_llm()
    if not llm:
        raise HTTPException(
            status_code=503,
            detail="Set GOOGLE_API_KEY in .env to use the score endpoint.",
        )

    chunks_text = "\n\n---\n\n".join(chunks)
    goals_text = "\n".join(f"- {g}" for g in investor_goals)
    prompt = SCORE_PROMPT_TEMPLATE.format(chunks_text=chunks_text, goals_text=goals_text)

    try:
        response = await llm.acomplete(prompt)
        raw_text = (getattr(response, "text", None) or str(response)).strip()
        result = _parse_llm_json(raw_text)
        # Normalize: ensure vulnerable_clauses exists and each has similar_bad_examples
        if "vulnerable_clauses" not in result or not isinstance(result["vulnerable_clauses"], list):
            result["vulnerable_clauses"] = []
        for clause in result["vulnerable_clauses"]:
            if not isinstance(clause, dict):
                continue
            if "similar_bad_examples" not in clause or not isinstance(clause["similar_bad_examples"], list):
                clause["similar_bad_examples"] = []
        return result
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"LLM did not return valid JSON: {e!s}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Score error: {e!s}")


@app.get("/investor")
async def get_investor():
    """Get the current test investor details."""
    investor = await _get_test_investor()
    if not investor:
        return {"ok": False, "error": "test_user not found in MongoDB"}
    # Convert ObjectId to string for JSON response
    investor["_id"] = str(investor.get("_id", ""))
    # Convert datetime to string if present
    if investor.get("created_at"):
        investor["created_at"] = investor["created_at"].isoformat()
    if investor.get("updated_at"):
        investor["updated_at"] = investor["updated_at"].isoformat()
    return {"ok": True, "investor": investor}


@app.get("/health")
def health():
    return {
        "ok": True,
        "llama_configured": bool(LLAMA_API_KEY),
        "google_configured": bool(os.getenv("GOOGLE_API_KEY")),
        "mongo_configured": bool(os.getenv("MONGO_URI")),
    }


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
