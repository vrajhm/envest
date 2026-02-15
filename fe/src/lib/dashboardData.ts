import dashboardDataJson from "@/data/dashboardData.json";

export type StartupStatus = "healthy" | "watch" | "high_risk";

export type DashboardData = {
  version: string;
  updated_at: string;
  investor_profile: {
    investor_id: string;
    name: string;
    check_size_usd: number;
    climate_concerns: string[];
    location: string;
  };
  portfolio_metrics: {
    average_climate_score: number;
    high_risk_startups: number;
    aggregate_greenwashing_risk: number;
    climate_adjusted_return_index: number;
  };
  startups: Array<{
    startup_id: string;
    name: string;
    sector: string;
    climate_trust: number;
    greenwash_risk: number;
    net_zero_cred: number;
    confidence: number;
    status: StartupStatus;
    geo: {
      city: string;
      lat: number;
      lng: number;
    };
  }>;
};

export type DashboardStartupRow = {
  startupId: string;
  name: string;
  sector: string;
  climateTrust: number;
  greenwashRisk: number;
  netZeroCred: number;
  confidence: number;
  status: string;
};

export const dashboardSeed: DashboardData = dashboardDataJson as DashboardData;

export const dashboardStartups: DashboardStartupRow[] = dashboardSeed.startups.map(
  (startup) => ({
    startupId: startup.startup_id,
    name: startup.name,
    sector: startup.sector,
    climateTrust: startup.climate_trust,
    greenwashRisk: startup.greenwash_risk,
    netZeroCred: startup.net_zero_cred,
    confidence: startup.confidence,
    status: startup.status.replace("_", " "),
  }),
);

export const addStartupToDashboardData = (
  data: DashboardData,
  startup: DashboardData["startups"][number],
): DashboardData => ({
  ...data,
  startups: [...data.startups, startup],
  updated_at: new Date().toISOString(),
});
