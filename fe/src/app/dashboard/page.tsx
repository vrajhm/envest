"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Smooch_Sans, Montserrat } from "next/font/google";
import { Saira_Extra_Condensed } from "next/font/google";
import { useEffect, useState } from "react";
import {
  dashboardSeed,
  dashboardStartups,
  type DashboardStartupRow,
} from "@/lib/dashboardData";
import HeatMapCard from "./HeatMapCard";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500"],
});

const sairaExtraCondensed = Saira_Extra_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export default function Dashboard() {
  const [fadeIn, setFadeIn] = useState(false);
  const [logoOpacity, setLogoOpacity] = useState(1);
  const [startups, setStartups] = useState<DashboardStartupRow[]>(dashboardStartups);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startupNameInput, setStartupNameInput] = useState("");
  const [startupSectorInput, setStartupSectorInput] = useState("");
  const [startupLocationInput, setStartupLocationInput] = useState("");
  const [isAddingStartup, setIsAddingStartup] = useState(false);
  const [addStartupError, setAddStartupError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setFadeIn(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const fadeDistance = 90;
      const nextOpacity = Math.max(0, 1 - window.scrollY / fadeDistance);
      setLogoOpacity(nextOpacity);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const portfolioMetrics = dashboardSeed.portfolio_metrics;
  const canAddStartup =
    startupNameInput.trim().length > 0 &&
    startupSectorInput.trim().length > 0 &&
    startupLocationInput.trim().length > 0;

  const resetStartupDialog = () => {
    setStartupNameInput("");
    setStartupSectorInput("");
    setStartupLocationInput("");
    setAddStartupError(null);
  };

  const handleAddStartup = async () => {
    if (!canAddStartup || isAddingStartup) return;

    setIsAddingStartup(true);
    setAddStartupError(null);

    try {
      const response = await fetch("/api/dashboard/startups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: startupNameInput.trim(),
          sector: startupSectorInput.trim(),
          location: startupLocationInput.trim(),
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        startup?: {
          startup_id: string;
          name: string;
          sector: string;
          climate_trust: number;
          greenwash_risk: number;
          net_zero_cred: number;
          confidence: number;
          status: string;
        };
      };

      if (!response.ok || !payload.startup) {
        setAddStartupError(payload.error ?? "Failed to add startup.");
        return;
      }

      const startup = payload.startup;
      setStartups((current) => [
        ...current,
        {
          startupId: startup.startup_id,
          name: startup.name,
          sector: startup.sector,
          climateTrust: startup.climate_trust,
          greenwashRisk: startup.greenwash_risk,
          netZeroCred: startup.net_zero_cred,
          confidence: startup.confidence,
          status: startup.status,
        },
      ]);

      const startupPath = `/${encodeURIComponent(startup.name.toLowerCase())}`;
      resetStartupDialog();
      setDialogOpen(false);
      router.push(startupPath);
    } catch {
      setAddStartupError("Failed to add startup.");
    } finally {
      setIsAddingStartup(false);
    }
  };

  const handleRowClick = (startupName: string) => {
    router.push(`/${startupName.toLowerCase()}`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: fadeIn
          ? "linear-gradient(135deg, rgb(56, 58, 45) 60%, rgb(36, 44, 32) 100%)"
          : "rgb(56, 58, 45)",
        position: "relative",
        transition: "background 0.8s cubic-bezier(.4,1.3,.6,1)",
      }}
    >
      <div
        className={`${montserrat.className} min-h-screen w-full relative px-6 pt-32 pb-10`}
        style={{
          background: "transparent",
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
            opacity: logoOpacity,
            background: "radial-gradient(circle, rgb(56, 58, 45) 45%, rgba(56, 58, 45, 0.55) 70%, rgba(56, 58, 45, 0) 100%)",
            borderRadius: "9999px",
            padding: "0.35rem 0.9rem",
            boxShadow: "0 0 28px 12px rgba(56, 58, 45, 0.85)",
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
            <AlertDialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetStartupDialog();
              }}
            >
              <AlertDialogTrigger asChild>
                <button
                  type="button"
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
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Add startup?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Enter startup details to add it to your portfolio.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid gap-3">
                  <input
                    type="text"
                    value={startupNameInput}
                    onChange={(e) => setStartupNameInput(e.target.value)}
                    placeholder="Name"
                    className={`${montserrat.className} h-10 border border-[rgb(85,81,46)] bg-[rgb(237,243,189)] px-3 text-[rgb(26,28,18)] outline-none`}
                  />
                  <input
                    type="text"
                    value={startupSectorInput}
                    onChange={(e) => setStartupSectorInput(e.target.value)}
                    placeholder="Sector"
                    className={`${montserrat.className} h-10 border border-[rgb(85,81,46)] bg-[rgb(237,243,189)] px-3 text-[rgb(26,28,18)] outline-none`}
                  />
                  <input
                    type="text"
                    value={startupLocationInput}
                    onChange={(e) => setStartupLocationInput(e.target.value)}
                    placeholder="Location"
                    className={`${montserrat.className} h-10 border border-[rgb(85,81,46)] bg-[rgb(237,243,189)] px-3 text-[rgb(26,28,18)] outline-none`}
                  />
                  {addStartupError && (
                    <div
                      className={`${montserrat.className} text-sm text-red-800`}
                    >
                      {addStartupError}
                    </div>
                  )}
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <button
                    type="button"
                    onClick={handleAddStartup}
                    disabled={!canAddStartup || isAddingStartup}
                    className={`${montserrat.className} inline-flex h-10 items-center justify-center border border-[rgb(26,28,18)] px-4 text-sm font-medium uppercase tracking-wide text-[rgb(26,28,18)] transition hover:bg-[rgb(26,28,18)] hover:text-[rgb(237,243,189)] disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {isAddingStartup ? "Adding..." : "Add startup"}
                  </button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
                <span>AVERAGE CLIMATE SCORE </span>
              </div>
              <div
                className="text-lg font-normal mt-1 tracking-tight"
                style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
              >
                OVERALL SUSTAINABILITY TRUST RATING OF YOUR PORTFOLIO
              </div>
              <div
                className="w-full h-1/2 text-center text-[7rem] font-bold mt-auto flex items-center justify-center"
                style={{ lineHeight: "0.9" }}
              >
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
                <span>HIGH RISK STARTUPS</span>
              </div>
              <div
                className="text-lg font-normal mt-1 tracking-tight"
                style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
              >
                HOLDINGS FLAGGED AS HIGH-RISK FOR GREENWASHING
              </div>
              <div
                className="w-full h-1/2 text-center text-[7rem] font-bold mt-auto flex items-center justify-center"
                style={{ lineHeight: "0.9" }}
              >
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
                <span>AGGREGATE GREENWASHING RISK</span>
              </div>
              <div
                className="text-lg font-normal mt-1 tracking-tight"
                style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
              >
                COMBINED GREENWASHING PROBABILITY ACROSS YOUR PORTFOLIO
              </div>
              <div
                className="w-full h-1/2 text-center text-[7rem] font-bold mt-auto flex items-center justify-center"
                style={{ lineHeight: "0.9" }}
              >
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
                <span>CLIMATE-ADJUSTED RETURN INDEX</span>
              </div>
              <div
                className="text-lg font-normal mt-1 tracking-tight"
                style={{ color: "rgb(85, 81, 46)", lineHeight: "0.9" }}
              >
                RISK-ADJUSTED RETURNS FACTORING CLIMATE AUTHENTICITY
              </div>
              <div
                className="w-full h-1/2 text-center text-[7rem] font-bold mt-auto flex items-center justify-center"
                style={{ lineHeight: "0.9" }}
              >
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
                    className={`py-2 px-4 font-bold tracking-tight text-3xl  ${sairaExtraCondensed.className} text-center`}
                    style={{ color: "rgb(26, 28, 18)", lineHeight: "0.9" }}
                  >
                    CONFIDENCE
                  </th>
                  <th
                    className={`py-2 px-4 font-bold tracking-tight text-3xl  ${sairaExtraCondensed.className} text-center`}
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
                      className="py-2 px-4 text-center uppercase text-2xl mt-1 tracking-tight"
                      style={{
                        color: "rgb(52, 56, 36)",
                        lineHeight: "0.9",
                        letterSpacing: "0.02em",
                      }}
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
    </div>
  );
}
