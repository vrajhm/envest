"""
LlamaParse + scoring: parse climate contracts, then score alignment with investor goals.
Uses vector retrieval (top-k chunks) to avoid sending the full document to the LLM.
"""
import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import PlainTextResponse
from llama_cloud import AsyncLlamaCloud
from llama_index.core import Document, VectorStoreIndex, Settings
from llama_index.embeddings.gemini import GeminiEmbedding
from llama_index.llms.google_genai import GoogleGenAI
from pydantic import BaseModel
import uvicorn

# Load .env from this directory or parent
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv()

LLAMA_API_KEY = os.getenv("LLAMA_CLOUD_API_KEY") or os.getenv("llamaparse_api_key")

app = FastAPI(title="LlamaParse + Contract Scoring", version="0.2.0")

# In-memory state: last parsed markdown and vector index (for retrieval only)
_last_markdown: str | None = None
_vector_index: VectorStoreIndex | None = None

DEFAULT_TOP_K = 15


def _get_llm():
    """Build LLM from env. Uses Gemini if GOOGLE_API_KEY is set."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    return GoogleGenAI(model="gemini-2.0-flash", api_key=api_key)


def _get_embed_model():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    return GeminiEmbedding(model_name="gemini-embedding-001", api_key=api_key)


def _build_vector_index(markdown: str) -> VectorStoreIndex | None:
    """Chunk the markdown, embed, and build a vector index for retrieval only."""
    global _vector_index
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


# Request body for /score (validation only; response is raw JSON from LLM)
class ScoreBody(BaseModel):
    investor_goals: list[str]
    top_k: int | None = None


SCORE_PROMPT_TEMPLATE = """You are evaluating an ESG report. Your task is to (1) score how well the report's language, commitments, and syntax align with the investor priorities below, and (2) identify vulnerable clauses in the document—vague language, loopholes, weak commitments, or greenwashing-like wording—and score each for exploitability.

Use your knowledge of famous ESG reports and controversies. When you know of a similar clause from a real company's ESG report that was criticized or exploited, include it in similar_bad_examples for that vulnerable clause. If you have no such example, leave similar_bad_examples as an empty array. No external search is used; rely on your own knowledge.

Relevant excerpts from the document (these are the only parts you should use):

{chunks_text}

Investor priorities (what they care about):
{goals_text}

Output only valid JSON with no other text. Use this exact structure:

{{
  "overall_trust_score": <number 0-100>,
  "per_goal_scores": [
    {{ "goal": "<goal text>", "score": <0-100>, "notes": "<short note>" }},
    ...
  ],
  "syntax_notes": "<short overall note on document language and legitimacy>",
  "vulnerable_clauses": [
    {{
      "clause_text": "<excerpt from the document>",
      "vulnerability_score": <number 0-100, higher = more exploitable>,
      "notes": "<optional short note>",
      "similar_bad_examples": [
        {{ "example_clause": "<clause from a known ESG report>", "source": "<e.g. Company X 2022 ESG report>" }},
        ...
      ]
    }},
    ...
  ]
}}

For each vulnerable clause: assign vulnerability_score 0-100 (higher = more exploitable or similar to known-bad patterns). similar_bad_examples must be an array of objects with example_clause and source; use [] when you have no known example.
"""


@app.post("/parse", response_class=PlainTextResponse)
async def parse_document(
    file_path: str | None = Form(None),
    file: UploadFile | None = File(None),
):
    """
    Parse a local document with LlamaParse (Llama Cloud).
    Provide either form field file_path=/path/to/doc.pdf or multipart file=@doc.pdf.
    Returns the parsed markdown and builds a vector index for later scoring.
    """
    if not LLAMA_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Set LLAMA_CLOUD_API_KEY or llamaparse_api_key in .env",
        )

    path: Path | None = None
    if file and file.filename:
        temp_dir = Path(__file__).resolve().parent / ".tmp_uploads"
        temp_dir.mkdir(exist_ok=True)
        path = temp_dir / file.filename
        content = await file.read()
        path.write_bytes(content)
    elif file_path:
        path = Path(file_path).resolve()
        if not path.is_file():
            raise HTTPException(status_code=400, detail=f"File not found: {path}")
    else:
        raise HTTPException(status_code=400, detail="Provide 'file_path' or upload a 'file'")

    try:
        async with AsyncLlamaCloud(api_key=LLAMA_API_KEY) as client:
            result = await client.parsing.parse(
                upload_file=str(path),
                tier="cost_effective",
                version="latest",
                expand=["markdown_full"],
            )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LlamaParse error: {e!s}")

    if result.job.status != "COMPLETED":
        raise HTTPException(
            status_code=502,
            detail=f"Parsing job status: {result.job.status}",
        )

    markdown = getattr(result, "markdown_full", None) or ""
    global _last_markdown
    _last_markdown = markdown
    _build_vector_index(markdown)

    return markdown


@app.post("/score")
async def score_contract(body: ScoreBody):
    """
    Score the last parsed contract against investor goals.
    Uses one retrieval over the document (top-k chunks for all goals), then an LLM to produce a trust score.
    Requires GOOGLE_API_KEY. Call POST /parse first.
    """
    if not _last_markdown:
        raise HTTPException(
            status_code=400,
            detail="No document parsed yet. Call POST /parse first.",
        )
    if not body.investor_goals:
        raise HTTPException(status_code=400, detail="investor_goals must be a non-empty list.")

    top_k = body.top_k if body.top_k is not None else DEFAULT_TOP_K
    # One retrieval query summarizing all goals
    retrieval_query = "Climate and sustainability commitments, emissions, water usage, environmental obligations, goals and standards: " + " ".join(body.investor_goals)

    chunks = _retrieve_chunks(retrieval_query, top_k)
    if not chunks:
        # Index may not exist if OPENAI wasn't configured at parse time
        _build_vector_index(_last_markdown)
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
    goals_text = "\n".join(f"- {g}" for g in body.investor_goals)
    prompt = SCORE_PROMPT_TEMPLATE.format(chunks_text=chunks_text, goals_text=goals_text)

    try:
        response = llm.complete(prompt)
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


@app.get("/health")
def health():
    return {
        "ok": True,
        "llama_configured": bool(LLAMA_API_KEY),
        "google_configured": bool(os.getenv("GOOGLE_API_KEY")),
    }


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
