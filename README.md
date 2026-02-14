# Envest

Climate-conscious investing: air quality map (OpenAQ) + investor preferences (MongoDB).

## Structure

- **`be/`** – FastAPI backend (OpenAQ heatmap API + MongoDB preferences)
- **`fe/`** – Next.js frontend

### Routes

| Route | Description |
|-------|-------------|
| `/` | Home: links to Map and Questionnaire |
| `/map` | Air quality heatmap (OpenAQ) |
| `/preferences/investors` | Investor questionnaire (saved to MongoDB) |

## Backend (be)

```bash
cd be
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
# Use be/.env with your keys (OPENAQ_API_KEY, MONGO_URI, etc.)
uvicorn main:app --reload --port 8000
```

**Env (be/.env):**

- `OPENAQ_API_KEY` – for heatmap data ([get one](https://explore.openaq.org/))
- `MONGO_URI` – optional; defaults to `mongodb://localhost:27017`

## Frontend (fe)

```bash
cd fe
npm install
# For /map, add NEXT_PUBLIC_MAPBOX_TOKEN to fe/.env.local (get token at mapbox.com)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Merge note (heatmap + mongodb)

This repo unifies:

- **Heatmap branch:** GET `/issues` (OpenAQ), `/map` page
- **Mongodb branch:** POST `/submit-preferences`, `/preferences/investors` page

Backend is a single `be/main.py`; frontend uses `/` as landing with links to `/map` and `/preferences/investors`.
