# Dashboard Data Wiring Plan

## Goal
Use a JSON file as the single source of truth for dashboard data and wire the dashboard table to consume it without changing dashboard component structure/styling.

## Changes
1. Add `src/data/dashboardData.json` with the full dashboard seed payload (investor profile, portfolio metrics, startups).
2. Add `src/lib/dashboardData.ts` to:
   - Define `DashboardData`/startup types.
   - Export `dashboardSeed` from JSON.
   - Export `dashboardStartups` with snake_case -> camelCase field mapping for current table bindings.
   - Export `addStartupToDashboardData(...)` utility to make adding startups explicit and type-safe.
3. Update `src/app/dashboard/page.tsx` to replace inline hardcoded `startups` data with `dashboardStartups` import.

## Source of Truth
- Primary data file: `src/data/dashboardData.json`
- To add a startup, append a valid object to `startups` in this JSON (or use the helper function in code paths that construct new data objects).

## Non-Goals
- No styling changes.
- No component layout/content changes unrelated to data wiring.
