# Envest Mapping Agent

Standalone mapping service for dashboard heatmap data.

## Run

From repo root:

```bash
uvicorn app.main:app --app-dir be/mapping_agent --reload --port 8001
```

From `be/mapping_agent`:

```bash
uvicorn app.main:app --app-dir . --reload --port 8001
```

## Endpoints

- `GET /health` - liveness check
- `GET /issues` - OpenAQ PM2.5 GeoJSON for heatmap

## Environment

Copy `.env.example` to `.env` and set:

- `OPENAQ_API_KEY`
