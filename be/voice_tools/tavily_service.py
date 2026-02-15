from __future__ import annotations

import httpx


async def search_web(query: str, api_key: str) -> dict:
    """
    Search the web using Tavily API.
    Returns search results with snippets and sources.
    """
    if not api_key:
        return {"error": "No API key provided", "results": []}

    url = "https://api.tavily.com/search"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                json={
                    "api_key": api_key,
                    "query": query,
                    "max_results": 10,
                    "include_answer": True,
                    "include_raw_content": False,
                }
            )
            
            if response.status_code != 200:
                return {"error": f"API error: {response.status_code}", "results": []}
            
            data = response.json()
            
            results = []
            for result in data.get("results", []):
                results.append({
                    "title": result.get("title", ""),
                    "url": result.get("url", ""),
                    "content": result.get("content", ""),
                    "score": result.get("score", 0)
                })
            
            return {
                "query": query,
                "answer": data.get("answer", ""),
                "results": results
            }
    except Exception as e:
        return {"error": str(e), "results": []}


async def search_company(company_name: str, api_key: str) -> dict:
    """
    Search for company information including CEO, funding, news.
    """
    queries = [
        f"{company_name} company",
        f"{company_name} CEO",
        f"{company_name} funding round",
        f"{company_name} news 2024"
    ]
    
    all_results = {}
    
    for query in queries:
        result = await search_web(query, api_key)
        all_results[query] = result
    
    return all_results


async def search_claim(claim: str, api_key: str) -> dict:
    """
    Search to verify a specific claim.
    """
    return await search_web(claim, api_key)
