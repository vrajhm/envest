"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Montserrat } from "next/font/google";
import { Saira_Extra_Condensed } from "next/font/google";
import { useEffect, useState } from "react";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500"],
});

const sairaExtraCondensed = Saira_Extra_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export default function StartupDetail() {
  const params = useParams();
  const startupName = params.startup;

  // Your startup data
  const startupData = {
    ecogen: {
      name: "EcoGen",
      sector: "Energy",
      climateTrust: 92,
      greenwashRisk: 12,
      netZeroCred: 100,
      confidence: 87,
      status: "Strong",
      description: "Leading solar energy innovator",
    },
    greenleaf: {
      name: "GreenLeaf",
      sector: "Agriculture",
      climateTrust: 78,
      greenwashRisk: 34,
      netZeroCred: 65,
      confidence: 54,
      status: "Neutral",
      description: "Sustainable farming practices",
    },
    urbanroots: {
      name: "UrbanRoots",
      sector: "Urban Farming",
      climateTrust: 88,
      greenwashRisk: 27,
      netZeroCred: 90,
      confidence: 73,
      status: "Strong",
      description: "Urban agriculture solutions",
    },
    bluecycle: {
      name: "BlueCycle",
      sector: "Recycling",
      climateTrust: 61,
      greenwashRisk: 49,
      netZeroCred: 72,
      confidence: 58,
      status: "Poor",
      description: "Water recycling technology",
    },
  };

  const startup = startupData[startupName];

  if (!startup) {
    return <div>Startup not found</div>;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "rgb(217, 205, 183)",
        position: "relative",
      }}
    >
      <div
        className={`${montserrat.className} min-h-screen w-full relative px-6 pt-32 pb-10`}
        style={{
          background:
            "linear-gradient(135deg, rgb(56, 58, 45) 60%, rgb(36, 44, 32) 100%)",
        }}
      >
        {/* Header */}
        <Link
          href="/dashboard"
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
          {/* Back button */}
          <div className="mb-6 flex justify-end">
            <Link
              href="/dashboard"
              className={`${montserrat.className} text-lg font-semibold`}
              style={{
                color: "rgb(237, 243, 189)",
                letterSpacing: "0.04em",
                textDecoration: "none",
              }}
            >
              ← back to portfolio
            </Link>
          </div>

          {/* Startup Title */}
          <div
            style={{
              fontFamily: "Playfair Display, serif",
              fontWeight: 400,
              fontSize: "6rem",
              color: "rgb(237, 243, 189)",
              letterSpacing: "-0.03em",
              lineHeight: 1,
              marginBottom: "2rem",
            }}
          >
            {startup.name}
          </div>

          {/* Startup Info Cards */}
          <div className="grid grid-cols-2 gap-6 mb-10">
            <div
              className={`bg-[rgb(237,243,189)] shadow p-6 ${sairaExtraCondensed.className}`}
              style={{ color: "rgb(26, 28, 18)" }}
            >
              <div className="font-bold text-2xl" style={{ lineHeight: "0.9" }}>
                CLIMATE TRUST
              </div>
              <div
                className="text-5xl font-bold mt-4"
                style={{ color: "rgb(26, 28, 18)" }}
              >
                {startup.climateTrust}
              </div>
            </div>

            <div
              className={`bg-[rgb(237,243,189)] shadow p-6 ${sairaExtraCondensed.className}`}
              style={{ color: "rgb(26, 28, 18)" }}
            >
              <div className="font-bold text-2xl" style={{ lineHeight: "0.9" }}>
                GREENWASH RISK
              </div>
              <div
                className="text-5xl font-bold mt-4"
                style={{ color: "rgb(26, 28, 18)" }}
              >
                {startup.greenwashRisk}%
              </div>
            </div>

            <div
              className={`bg-[rgb(237,243,189)] shadow p-6 ${sairaExtraCondensed.className}`}
              style={{ color: "rgb(26, 28, 18)" }}
            >
              <div className="font-bold text-2xl" style={{ lineHeight: "0.9" }}>
                NET-ZERO CREDIBILITY
              </div>
              <div
                className="text-5xl font-bold mt-4"
                style={{ color: "rgb(26, 28, 18)" }}
              >
                {startup.netZeroCred}
              </div>
            </div>

            <div
              className={`bg-[rgb(237,243,189)] shadow p-6 ${sairaExtraCondensed.className}`}
              style={{ color: "rgb(26, 28, 18)" }}
            >
              <div className="font-bold text-2xl" style={{ lineHeight: "0.9" }}>
                CONFIDENCE
              </div>
              <div
                className="text-5xl font-bold mt-4"
                style={{ color: "rgb(26, 28, 18)" }}
              >
                {startup.confidence}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
