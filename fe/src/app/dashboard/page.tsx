"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Montserrat, Saira_Extra_Condensed } from "next/font/google";

import { DashboardData, computePortfolioMetrics, loadDashboardData } from "../../lib/dashboardData";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500"],
});

const sairaExtraCondensed = Saira_Extra_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export default function Dashboard() {
  const [dashboardData] = useState<DashboardData>(() => loadDashboardData());

  const metrics = useMemo(() => {
    const computed = computePortfolioMetrics(dashboardData.startups);
    return {
      average_climate_score: dashboardData.portfolio_metrics.average_climate_score ?? computed.average_climate_score,
      high_risk_startups: dashboardData.portfolio_metrics.high_risk_startups ?? computed.high_risk_startups,
      aggregate_greenwashing_risk:
        dashboardData.portfolio_metrics.aggregate_greenwashing_risk ?? computed.aggregate_greenwashing_risk,
      climate_adjusted_return_index:
        dashboardData.portfolio_metrics.climate_adjusted_return_index ?? computed.climate_adjusted_return_index,
    };
  }, [dashboardData]);

  return (
    <div
      className={`${montserrat.className} min-h-screen w-full relative px-6 pt-32 pb-10`}
      style={{
        background: "linear-gradient(135deg, rgb(56, 58, 45) 60%, rgb(36, 44, 32) 100%)",
      }}
    >
      <Link
        href="/"
        style={{
          position: "fixed",
          top: 24,
          left: 32,
          zIndex: 3,
          fontFamily: "Playfair Display, serif",
          fontWeight: 300,
          fontSize: "1.35rem",
          color: "rgb(237, 243, 189)",
          letterSpacing: "0.1em",
          textShadow: "0 2px 8px #222a1a, 0 0 1px #222a1a",
          userSelect: "none",
          textDecoration: "none",
          transition: "transform 0.18s cubic-bezier(.4,1.3,.6,1)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.13)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        envest
      </Link>

      <div className="relative z-10 max-w-6xl mx-auto">
        <div
          style={{
            fontFamily: "Playfair Display, serif",
            fontWeight: 400,
            fontStyle: "normal",
            fontSize: "6rem",
            color: "rgb(237, 243, 189)",
            letterSpacing: "-0.03em",
            display: "block",
            marginRight: "-10.5vw",
            lineHeight: 1,
            marginTop: "-1.7rem",
            marginBottom: "-2.5rem",
          }}
        >
          your portfolio
        </div>

        <div className="mb-6 flex justify-between items-center">
          <div className="text-[rgb(237,243,189)] text-sm uppercase tracking-wide">
            Investor: {dashboardData.investor_profile.name}
          </div>
          <Link href="/chat" className="bg-green-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-800">
            Open RAG Chat
          </Link>
        </div>

        <div className="flex flex-row gap-6 mb-10 flex-wrap">
          <MetricCard
            title="AVERAGE CLIMATE SCORE"
            value={metrics.average_climate_score.toFixed(1)}
            subtitle="OVERALL SUSTAINABILITY TRUST RATING OF YOUR PORTFOLIO"
            fontClass={sairaExtraCondensed.className}
          />
          <MetricCard
            title="HIGH RISK STARTUPS"
            value={String(metrics.high_risk_startups)}
            subtitle="HOLDINGS FLAGGED AS HIGH-RISK FOR GREENWASHING"
            fontClass={sairaExtraCondensed.className}
          />
          <MetricCard
            title="AGGREGATE GREENWASHING RISK"
            value={metrics.aggregate_greenwashing_risk.toFixed(1)}
            subtitle="COMBINED GREENWASHING PROBABILITY ACROSS YOUR PORTFOLIO"
            fontClass={sairaExtraCondensed.className}
          />
          <MetricCard
            title="CLIMATE-ADJUSTED RETURN INDEX"
            value={metrics.climate_adjusted_return_index.toFixed(1)}
            subtitle="RISK-ADJUSTED RETURNS FACTORING CLIMATE AUTHENTICITY"
            fontClass={sairaExtraCondensed.className}
          />
        </div>

        <div
          style={{
            fontFamily: "Playfair Display, serif",
            fontWeight: 400,
            fontStyle: "normal",
            fontSize: "6rem",
            color: "rgb(237, 243, 189)",
            letterSpacing: "-0.03em",
            display: "block",
            marginRight: "-10.5vw",
            lineHeight: 1,
            marginTop: "4rem",
            marginBottom: "1.5rem",
          }}
        >
          your startups
        </div>

        <div className={`shadow p-4 overflow-x-auto ${sairaExtraCondensed.className}`} style={{ background: "rgb(237, 243, 189)" }}>
          <table className="w-full text-center uppercase min-w-[980px]">
            <thead>
              <tr className="text-green-900">
                <HeaderCell text="STARTUP" fontClass={sairaExtraCondensed.className} />
                <HeaderCell text="SECTOR" fontClass={sairaExtraCondensed.className} />
                <HeaderCell text="CLIMATE TRUST" fontClass={sairaExtraCondensed.className} />
                <HeaderCell text="GREENWASH RISK" fontClass={sairaExtraCondensed.className} />
                <HeaderCell text="NET-ZERO CRED." fontClass={sairaExtraCondensed.className} />
                <HeaderCell text="CONFIDENCE" fontClass={sairaExtraCondensed.className} />
                <HeaderCell text="STATUS" fontClass={sairaExtraCondensed.className} />
              </tr>
            </thead>
            <tbody>
              {dashboardData.startups.map((startup) => (
                <tr
                  key={startup.startup_id}
                  style={{
                    cursor: "pointer",
                    transition: "transform 0.18s cubic-bezier(.4,1.3,.6,1)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.01)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <BodyCell value={startup.name} />
                  <BodyCell value={startup.sector} />
                  <BodyCell value={String(startup.climate_trust)} />
                  <BodyCell value={String(startup.greenwash_risk)} />
                  <BodyCell value={String(startup.net_zero_cred)} />
                  <BodyCell value={String(startup.confidence)} />
                  <BodyCell value={startup.status.replace("_", " ")} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  fontClass,
}: {
  title: string;
  value: string;
  subtitle: string;
  fontClass: string;
}) {
  return (
    <div
      className={`bg-[rgb(237,243,189)] shadow p-4 h-72 w-64 flex flex-col items-start justify-start text-2xl font-normal ${fontClass} text-left`}
      style={{ color: "rgb(26, 28, 18)" }}
    >
      <div className="font-bold tracking-tight text-3xl" style={{ lineHeight: "0.9" }}>
        <span>{title}</span>
      </div>
      <div className="text-6xl font-bold mt-6 mb-5 leading-none">{value}</div>
      <div className="text-lg font-normal mt-1 tracking-tight" style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}>
        {subtitle}
      </div>
    </div>
  );
}

function HeaderCell({ text, fontClass }: { text: string; fontClass: string }) {
  return (
    <th
      className={`py-2 px-4 font-bold tracking-tight text-3xl ${fontClass} text-center uppercase`}
      style={{ color: "rgb(26, 28, 18)", lineHeight: "0.9" }}
    >
      {text}
    </th>
  );
}

function BodyCell({ value }: { value: string }) {
  return (
    <td className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight" style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}>
      {value}
    </td>
  );
}
