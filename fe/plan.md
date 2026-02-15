# Frontend Local Data Plan (Dashboard MVP)

## Goal
Use one local JSON data model in the frontend for demo mode:
- 1 investor profile
- 10 startups (all in San Francisco city)
- 4 portfolio metrics that are hardcoded but accurately computed from those startups

## What We Store
1. `investor_profile` (single object for demo)
2. `startups` (array of 10 rows powering the startup table)
3. `portfolio_metrics` (four KPI cards in "your portfolio")

## Dashboard UI Fields Mapped
Each startup record will include all fields currently shown in `fe/src/app/dashboard/page.tsx`:
- `name` (STARTUP)
- `sector` (SECTOR)
- `climate_trust` (CLIMATE TRUST)
- `greenwash_risk` (GREENWASH RISK)
- `net_zero_cred` (NET-ZERO CRED.)
- `confidence` (CONFIDENCE)
- `status` (STATUS)
- plus `geo` with San Francisco lat/lng

## Proposed JSON Shape
```json
{
  "version": "1.0",
  "updated_at": "2026-02-15T00:00:00Z",
  "investor_profile": {
    "investor_id": "inv_demo_001",
    "name": "Bay Climate Fund",
    "check_size_usd": 2500000,
    "climate_concerns": [
      "Carbon reduction",
      "Scope 3 transparency",
      "Offset quality",
      "Supply-chain accountability"
    ],
    "location": "San Francisco, CA"
  },
  "portfolio_metrics": {
    "average_climate_score": 72.7,
    "high_risk_startups": 2,
    "aggregate_greenwashing_risk": 36.9,
    "climate_adjusted_return_index": 68.9
  },
  "startups": [
    {
      "startup_id": "st_001",
      "name": "EcoGen Grid",
      "sector": "Energy",
      "climate_trust": 82,
      "greenwash_risk": 18,
      "net_zero_cred": 84,
      "confidence": 91,
      "status": "healthy",
      "geo": { "city": "San Francisco", "lat": 37.7749, "lng": -122.4194 }
    }
  ]
}
```

## Metric Rules (so hardcoded values stay accurate)
- `average_climate_score` = mean of `startups[].climate_trust` = **72.7**
- `high_risk_startups` = count where `greenwash_risk >= 60` = **2**
- `aggregate_greenwashing_risk` = mean of `startups[].greenwash_risk` = **36.9**
- `climate_adjusted_return_index` = mean of:
  - `(0.6 * climate_trust) + (0.4 * (100 - greenwash_risk))`
  - result = **68.9**

## File Plan (Minimal + Separated)
- `fe/src/data/dashboardSeed.ts`
  - Seed JSON constant only (investor profile, startups, metrics).
- `fe/src/lib/dashboardData.ts`
  - `loadDashboardData()` with `localStorage` fallback to `dashboardSeed`.
  - `saveDashboardData()`.
  - `computePortfolioMetrics(startups)`.
  - Optional `validateDashboardData()` guard.
- `fe/src/app/dashboard/page.tsx`
  - Consume data/helpers from `dashboardData.ts`.
  - Render KPI cards + startup table directly from that data.

## Implementation Notes
- Keep demo mode single-profile only (no account switching).
- Keep geolocation in each startup row for future heatmap page.
- Do not call backend for dashboard rendering in MVP.
