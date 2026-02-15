"use client";
import Image from "next/image";
import Link from "next/link";
import { Smooch_Sans, Montserrat } from "next/font/google";
import { Saira_Extra_Condensed } from "next/font/google";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500"],
});

const sairaExtraCondensed = Saira_Extra_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export default function Dashboard() {
  return (
    <div
      className={`${montserrat.className} min-h-screen w-full relative px-6 pt-32 pb-10`}
      style={{
        background:
          "linear-gradient(135deg, rgb(56, 58, 45) 60%, rgb(36, 44, 32) 100%)",
      }}
    >
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
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.13)")}
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
            href="/chat"
            className="bg-green-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-800"
          >
            Open RAG Chat
          </Link>
        </div>
        {/* 2x2 Cards Grid */}
        <div className="flex flex-row gap-6 mb-10">
          {/* Card 1 */}
          <div
            className={`bg-[rgb(237,243,189)] shadow p-4 h-72 w-64 flex flex-col items-start justify-start text-2xl font-normal ${sairaExtraCondensed.className} text-left`}
            style={{ color: "rgb(26, 28, 18)" }}
          >
            <div
              className="font-bold tracking-tight text-3xl"
              style={{ lineHeight: "0.9" }}
            >
              <span>AVERAGE CLIMATE SCORE</span>
            </div>
            <div
              className="text-lg font-normal mt-1 tracking-tight"
              style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
            >
              OVERALL SUSTAINABILITY TRUST RATING OF YOUR PORTFOLIO
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
              <span>HIGH RISK STARTUPS</span>
            </div>
            <div
              className="text-lg font-normal mt-1 tracking-tight"
              style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
            >
              HOLDINGS FLAGGED AS HIGH-RISK FOR GREENWASHING
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
              <span>AGGREGATE GREENWASHING RISK</span>
            </div>
            <div
              className="text-lg font-normal mt-1 tracking-tight"
              style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
            >
              COMBINED GREENWASHING PROBABILITY ACROSS YOUR PORTFOLIO
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
              <span>CLIMATE-ADJUSTED RETURN INDEX</span>
            </div>
            <div
              className="text-lg font-normal mt-1 tracking-tight"
              style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
            >
              RISK-ADJUSTED RETURNS FACTORING CLIMATE AUTHENTICITY
            </div>
          </div>
        </div>

        {/* Placeholder Table */}
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
              <tr
                onClick={() => {
                  /* row click handler */
                }}
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
                  EcoGen
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  Energy
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  92
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  12
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  100
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  87
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  Strong
                </td>
              </tr>
              <tr
                onClick={() => {
                  /* row click handler */
                }}
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
                  GreenLeaf
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  Agriculture
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  78
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  34
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  65
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  54
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  Neutral
                </td>
              </tr>
              <tr
                onClick={() => {
                  /* row click handler */
                }}
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
                  UrbanRoots
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  Urban Farming
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  88
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  27
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  90
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  73
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  Strong
                </td>
              </tr>
              <tr
                onClick={() => {
                  /* row click handler */
                }}
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
                  BlueCycle
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  Recycling
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  61
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  49
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  72
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  58
                </td>
                <td
                  className="py-2 px-4 text-center uppercase text-lg font-normal mt-1 tracking-tight"
                  style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
                >
                  Poor
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
