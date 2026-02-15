"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Montserrat } from "next/font/google";
import { Saira_Extra_Condensed } from "next/font/google";
import { useState } from "react";
import { dashboardSeed, dashboardStartups } from "@/lib/dashboardData";
import HeatMapCard from "./HeatMapCard";


const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500"],
});

const sairaExtraCondensed = Saira_Extra_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export default function Dashboard() {
  const [fadeIn] = useState(true);
  const router = useRouter();

  const startups = dashboardStartups;
  const portfolioMetrics = dashboardSeed.portfolio_metrics;

  const handleRowClick = (startupName: string) => {
    router.push(`/${startupName.toLowerCase()}`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "rgb(217, 205, 183)",
        position: "relative",
        transition: "background 0.8s cubic-bezier(.4,1.3,.6,1)",
      }}
    >
      <div
        className={`${montserrat.className} min-h-screen w-full relative px-6 pt-32 pb-10`}
        style={{
          background:
            "linear-gradient(135deg, rgb(56, 58, 45) 60%, rgb(36, 44, 32) 100%)",
          opacity: fadeIn ? 1 : 0,
          transition: "opacity 0.8s cubic-bezier(.4,1.3,.6,1)",
        }}
      >
        {fadeIn && (
          <style>{`
            body { background: linear-gradient(135deg, rgb(56, 58, 45) 60%, rgb(36, 44, 32) 100%) !important; }
          `}</style>
        )}
        {/* Small header top left */}
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
          onMouseEnter={(e) =>
            (e.currentTarget.style.transform = "scale(1.13)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          envest
        </Link>
        <div className="relative z-10 max-w-5xl mx-auto">
          {/* Section Header */}
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
          <div className="mb-6 flex justify-end">
            <Link
              href="/add-startup"
              className={`${montserrat.className} text-lg font-semibold`}
              style={{
                color: "rgb(237, 243, 189)",
                letterSpacing: "0.04em",
                textDecoration: "none",
                transition: "transform 0.18s cubic-bezier(.4,1.3,.6,1)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "scale(1.09)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            >
              add startup →
            </Link>
          </div>
          {/* 2x2 Cards Grid */}
          <div className="flex flex-row gap-6 mb-10 mt-9">
            {/* Card 1 */}
            <div
              className={`bg-[rgb(237,243,189)] shadow p-4 h-72 w-64 flex flex-col items-start justify-start text-2xl font-normal ${sairaExtraCondensed.className} text-left`}
              style={{ color: "rgb(26, 28, 18)" }}
            >
              <div
                className="font-bold tracking-tight text-3xl"
                style={{ lineHeight: "0.9" }}
              >
                <span>
                  AVERAGE CLIMATE SCORE:{" "}
                  
                </span>
              </div>
              <div
                className="text-lg font-normal mt-1 tracking-tight"
                style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
              >
                OVERALL SUSTAINABILITY TRUST RATING OF YOUR PORTFOLIO
              </div>
              <div>
                {portfolioMetrics.average_climate_score}
              </div>
            </div>

            {/* Card 2 */}
            <div
              className={`bg-[rgb(237,243,189)] shadow p-4 h-72 w-64 flex flex-col items-start justify-start text-2xl font-normal ${sairaExtraCondensed.className} text-left`}
              style={{ color: "rgb(26, 28, 18)" }}
            >
              <div
                className="font-bold tracking-tight text-3xl"
                style={{ lineHeight: "0.9" }}
              >
                <span>
                  HIGH RISK STARTUPS: 
                </span>
              </div>
              <div
                className="text-lg font-normal mt-1 tracking-tight"
                style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
              >
                HOLDINGS FLAGGED AS HIGH-RISK FOR GREENWASHING
              </div>
              <div>
                {portfolioMetrics.high_risk_startups}
              </div>
            </div>

            {/* Card 3 */}
            <div
              className={`bg-[rgb(237,243,189)] shadow p-4 h-72 w-64 flex flex-col items-start justify-start text-2xl font-normal ${sairaExtraCondensed.className} text-left`}
              style={{ color: "rgb(26, 28, 18)" }}
            >
              <div
                className="font-bold tracking-tight text-3xl"
                style={{ lineHeight: "0.9" }}
              >
                <span>
                  AGGREGATE GREENWASHING RISK: 
                </span>
              </div>
              <div
                className="text-lg font-normal mt-1 tracking-tight"
                style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
              >
                COMBINED GREENWASHING PROBABILITY ACROSS YOUR PORTFOLIO
              </div>
              <div>
                {portfolioMetrics.aggregate_greenwashing_risk}
              </div>
            </div>

            {/* Card 4 */}
            <div
              className={`bg-[rgb(237,243,189)] shadow p-4 h-72 w-64 flex flex-col items-start justify-start text-2xl font-normal ${sairaExtraCondensed.className} text-left`}
              style={{ color: "rgb(26, 28, 18)" }}
            >
              <div
                className="font-bold tracking-tight text-3xl"
                style={{ lineHeight: "0.9" }}
              >
                <span>
                  CLIMATE-ADJUSTED RETURN INDEX: 
                </span>
              </div>
              <div
                className="text-lg font-normal mt-1 tracking-tight"
                style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
              >
                RISK-ADJUSTED RETURNS FACTORING CLIMATE AUTHENTICITY
              </div>
              <div>
                {portfolioMetrics.climate_adjusted_return_index}
              </div>
            </div>
          </div>

          {/* Section Header for Table */}
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
          <div
            className={`shadow p-4 ${sairaExtraCondensed.className}`}
            style={{ background: "rgb(237, 243, 189)" }}
          >
            <table className="w-full text-center uppercase">
              <thead>
                <tr className="text-green-900">
                  <th
                    className={`py-2 px-4 font-bold tracking-tight text-3xl ${sairaExtraCondensed.className} text-center uppercase`}
                    style={{ color: "rgb(26, 28, 18)", lineHeight: "0.9" }}
                  >
                    STARTUP
                  </th>
                  <th
                    className={`py-2 px-4 font-bold tracking-tight text-3xl ${sairaExtraCondensed.className} text-center uppercase`}
                    style={{ color: "rgb(26, 28, 18)", lineHeight: "0.9" }}
                  >
                    SECTOR
                  </th>
                  <th
                    className={`py-2 px-4 font-bold tracking-tight text-3xl  ${sairaExtraCondensed.className} text-left`}
                    style={{ color: "rgb(26, 28, 18)", lineHeight: "0.9" }}
                  >
                    CLIMATE TRUST
                  </th>
                  <th
                    className={`py-2 px-4 font-bold tracking-tight text-3xl  ${sairaExtraCondensed.className} text-left`}
                    style={{ color: "rgb(26, 28, 18)", lineHeight: "0.9" }}
                  >
                    GREENWASH RISK
                  </th>
                  <th
                    className={`py-2 px-4 font-bold tracking-tight text-3xl  ${sairaExtraCondensed.className} text-left`}
                    style={{ color: "rgb(26, 28, 18)", lineHeight: "0.9" }}
                  >
                    NET-ZERO CRED.
                  </th>
                  <th
                    className={`py-2 px-4 font-bold tracking-tight text-3xl  ${sairaExtraCondensed.className} text-left`}
                    style={{ color: "rgb(26, 28, 18)", lineHeight: "0.9" }}
                  >
                    CONFIDENCE
                  </th>
                  <th
                    className={`py-2 px-4 font-bold tracking-tight text-3xl  ${sairaExtraCondensed.className} text-left`}
                    style={{ color: "rgb(26, 28, 18)", lineHeight: "0.9" }}
                  >
                    STATUS
                  </th>
                </tr>
              </thead>
              <tbody>
                {startups.map((startup) => (
                  <tr
                    key={startup.name}
                    onClick={() => handleRowClick(startup.name)}
                    style={{
                      cursor: "pointer",
                      transition: "transform 0.18s cubic-bezier(.4,1.3,.6,1)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.transform = "scale(1.01)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.transform = "scale(1)")
                    }
                  >
                    <td
                      className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                      style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                    >
                      {startup.name}
                    </td>
                    <td
                      className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                      style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                    >
                      {startup.sector}
                    </td>
                    <td
                      className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                      style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                    >
                      {startup.climateTrust}
                    </td>
                    <td
                      className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                      style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                    >
                      {startup.greenwashRisk}
                    </td>
                    <td
                      className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                      style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                    >
                      {startup.netZeroCred}
                    </td>
                    <td
                      className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                      style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                    >
                      {startup.confidence}
                    </td>
                    <td
                      className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                      style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                    >
                      {startup.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            lineHeight: 1,
            marginTop: "4rem",
            marginBottom: "1.5rem",
            width: "960px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          portfolio heatmap
        </div>
        <div
          className={`shadow p-4 ${sairaExtraCondensed.className}`}
          style={{ background: "rgb(237, 243, 189)", width: "960px", margin: "0 auto" }}
        >
          <div
            style={{
              padding: "20px",
              width: "100%",
              boxSizing: "border-box",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div style={{ width: "910px", height: "550px" }}>
              <HeatMapCard startups={dashboardSeed.startups} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
