import dashboardDataJson from "../data/dashboardData.json";

export type StartupRecord = {
  startup_id: string;
  name: string;
  sector: string;
  climate_trust: number;
  greenwash_risk: number;
  net_zero_cred: number;
  confidence: number;
  status: "healthy" | "watch" | "high_risk";
  geo: {
    city: "San Francisco";
    lat: number;
    lng: number;
  };
};

export type InvestorProfile = {
  investor_id: string;
  name: string;
  check_size_usd: number;
  climate_concerns: string[];
  location: string;
};

export type PortfolioMetrics = {
  average_climate_score: number;
  high_risk_startups: number;
  aggregate_greenwashing_risk: number;
  climate_adjusted_return_index: number;
};

export type DashboardData = {
  version: string;
  updated_at: string;
  investor_profile: InvestorProfile;
  portfolio_metrics: PortfolioMetrics;
  startups: StartupRecord[];
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computePortfolioMetrics(startups: StartupRecord[]): PortfolioMetrics {
  const count = startups.length || 1;
  const climateAvg = startups.reduce((acc, row) => acc + row.climate_trust, 0) / count;
  const greenwashAvg = startups.reduce((acc, row) => acc + row.greenwash_risk, 0) / count;
  const highRisk = startups.filter((row) => row.greenwash_risk >= 60).length;
  const climateAdjusted =
    startups.reduce(
      (acc, row) => acc + (0.6 * row.climate_trust + 0.4 * (100 - row.greenwash_risk)),
      0,
    ) / count;

  return {
    average_climate_score: round1(climateAvg),
    high_risk_startups: highRisk,
    aggregate_greenwashing_risk: round1(greenwashAvg),
    climate_adjusted_return_index: round1(climateAdjusted),
  };
}

export function validateDashboardData(input: unknown): input is DashboardData {
  if (!input || typeof input !== "object") return false;
  const data = input as DashboardData;
  return Array.isArray(data.startups) && typeof data.version === "string" && !!data.investor_profile;
}

export function loadDashboardData(): DashboardData {
  if (!validateDashboardData(dashboardDataJson)) {
    throw new Error("Invalid dashboardData.json shape");
  }
  // Always return a fresh copy so callers can safely mutate state.
  return JSON.parse(JSON.stringify(dashboardDataJson)) as DashboardData;
}

export function addStartup(current: DashboardData, startup: StartupRecord): DashboardData {
  const startups = [...current.startups, startup];
  return {
    ...current,
    updated_at: new Date().toISOString(),
    startups,
    portfolio_metrics: computePortfolioMetrics(startups),
  };
}
