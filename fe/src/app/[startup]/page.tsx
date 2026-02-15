"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Montserrat } from "next/font/google";
import { Saira_Extra_Condensed } from "next/font/google";
import { useEffect, useState, useRef } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { dashboardStartups } from "@/lib/dashboardData";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500"],
});

const sairaExtraCondensed = Saira_Extra_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

type SimilarBadExample = {
  example_clause: string;
  source: string;
};

type VulnerableClause = {
  clause_text: string;
  vulnerability_score: number;
  issue_type?: string;
  notes?: string;
  similar_bad_examples: SimilarBadExample[];
};

type GoalScores = {
  carbon_reduction: number;
  renewable_energy: number;
  water_management: number;
  waste_reduction: number;
  social_responsibility: number;
  governance: number;
};

type RiskIndicators = {
  greenwashing_signals: number;
  commitment_specificity: number;
  accountability_score: number;
  baseline_quality: number;
  timeline_clarity: number;
};

type ScoreData = {
  overall_trust_score: number;
  net_zero_credibility: number;
  goal_scores?: GoalScores;
  risk_indicators?: RiskIndicators;
  syntax_notes: string;
  vulnerable_clauses: VulnerableClause[];
};

type AnalysisPhase = "idle" | "parsing" | "analyzing" | "complete";

const API_BASE = "http://localhost:8000";

export default function StartupDetail() {
  const params = useParams();
  const startupName = decodeURIComponent(params.startup as string);

  const startupFromJson = dashboardStartups.find(
    (s) => s.startupId === startupName || s.name.toLowerCase() === startupName,
  );

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

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [selectedClause, setSelectedClause] = useState<VulnerableClause | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStatus, setChatStatus] = useState("Idle");
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [resolvingClauseIdx, setResolvingClauseIdx] = useState<number | null>(
    null,
  );
  const [resolvedClauses, setResolvedClauses] = useState<Set<number>>(
    new Set(),
  );
  const [chatClauseIndex, setChatClauseIndex] = useState<number>(0);

  const [fadeIn, setFadeIn] = useState(false);
  const [showAnalysisBox, setShowAnalysisBox] = useState(false);

  const RAG_API_BASE = "http://localhost:8000";

  useEffect(() => {
    setTimeout(() => setFadeIn(true), 200);
  }, []);

  useEffect(() => {
    if (phase === "parsing" || phase === "analyzing") {
      setShowAnalysisBox(false);
      const timeout = setTimeout(() => setShowAnalysisBox(true), 600);
      return () => clearTimeout(timeout);
    } else if (phase === "complete" || phase === "idle") {
      setShowAnalysisBox(false);
    }
  }, [phase]);

  const getUnresolvedClauses = () => {
    if (!scoreData) return [];
    return scoreData.vulnerable_clauses.filter(
      (_, idx) => !resolvedClauses.has(idx),
    );
  };

  const currentChatClause = getUnresolvedClauses()[chatClauseIndex] || null;

  const goToNextClause = () => {
    const unresolved = getUnresolvedClauses();
    if (chatClauseIndex < unresolved.length - 1) {
      setChatClauseIndex(chatClauseIndex + 1);
      setSelectedClause(unresolved[chatClauseIndex + 1]);
    }
  };

  const goToPrevClause = () => {
    const unresolved = getUnresolvedClauses();
    if (chatClauseIndex > 0) {
      setChatClauseIndex(chatClauseIndex - 1);
      setSelectedClause(unresolved[chatClauseIndex - 1]);
    }
  };

  const sendChatMessage = async (message: string, silent = false) => {
    if (!silent) {
      setChatMessages((prev) => [...prev, { role: "user", text: message }]);
    }
    setChatLoading(true);
    setChatStatus("Assistant is responding...");

    try {
      const clauseToUse = currentChatClause || selectedClause;
      const clauseIdx =
        clauseToUse && scoreData
          ? scoreData.vulnerable_clauses.indexOf(clauseToUse)
          : 0;
      const clauseId = `clause_${clauseIdx + 1}`;

      const res = await fetch(`${RAG_API_BASE}/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: "startup_chat",
          clause_id: clauseId,
          message,
          include_replacement_clause: false,
        }),
      });

      if (!res.ok) {
        throw new Error(`Chat failed: ${res.statusText}`);
      }

      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer || "No response" },
      ]);
      setChatStatus("Ready");
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Error: ${err instanceof Error ? err.message : "Failed to send message"}`,
        },
      ]);
      setChatStatus("Error");
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    await sendChatMessage(msg);
  };

  const handleResolveClause = async () => {
    if (!currentChatClause || scoreData === null) return;
    const clauseIdx = scoreData.vulnerable_clauses.indexOf(currentChatClause);
    setResolvingClauseIdx(clauseIdx);
    setChatStatus("Resolving clause...");

    try {
      await sendChatMessage("Mark this clause as resolved.", true);
      setResolvedClauses((prev) => new Set(prev).add(clauseIdx));

      const remaining = getUnresolvedClauses();
      if (remaining.length > 0) {
        setChatClauseIndex(0);
        setSelectedClause(remaining[0]);
        setChatStatus("Clause resolved! Moving to next...");
      } else {
        setSelectedClause(null);
        setChatStatus("All clauses resolved!");
      }
    } catch {
      setChatStatus("Failed to resolve clause");
    } finally {
      setResolvingClauseIdx(null);
    }
  };

  const handleGetRectifiedClause = async () => {
    if (!selectedClause) return;
    setChatLoading(true);
    setChatStatus("Generating rectified clause...");
    try {
      const clauseIdx =
        scoreData?.vulnerable_clauses.indexOf(selectedClause) ?? 0;
      const clauseId = `clause_${clauseIdx + 1}`;

      const res = await fetch(`${RAG_API_BASE}/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: "startup_chat",
          clause_id: clauseId,
          message:
            "Generate a rectified version of this vulnerable clause that addresses the issues.",
          include_replacement_clause: true,
        }),
      });

      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `RECTIFIED CLAUSE:\n\n${data.answer || "No response"}`,
        },
      ]);
      setChatStatus("Rectified clause generated!");
    } catch {
      setChatStatus("Failed to generate rectified clause");
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateEmail = async () => {
    setChatLoading(true);
    setChatStatus("Generating investor email...");
    try {
      const res = await fetch(`${RAG_API_BASE}/v1/cleanup/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          investor_note: "Generated from startup page chat.",
        }),
      });

      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setEmailDraft(data.investor_email_draft || "");
      setEmailModalOpen(true);
      setChatStatus("Email draft generated!");
    } catch {
      setChatStatus("Failed to generate email");
    } finally {
      setChatLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setStatusMessage("");
      setScoreData(null);
      setSelectedClause(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatusMessage("");
      setScoreData(null);
      setSelectedClause(null);
      setUploading(true);
      setPhase("parsing");
      setStatusMessage("Parsing document...");
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const parseRes = await fetch(`${API_BASE}/parse`, {
          method: "POST",
          body: formData,
        });
        if (!parseRes.ok) {
          const errorText = await parseRes.text();
          throw new Error(errorText);
        }
        setPhase("analyzing");
        setStatusMessage("Analyzing ESG claims...");
        const scoreRes = await fetch(`${API_BASE}/score`);
        if (!scoreRes.ok) {
          const errorText = await scoreRes.text();
          throw new Error(errorText);
        }
        const data: ScoreData = await scoreRes.json();
        setScoreData(data);
        if (data.vulnerable_clauses.length > 0) {
          setSelectedClause(data.vulnerable_clauses[0]);
        }
        setStatusMessage("Syncing with AI assistant...");
        try {
          await fetch(`${API_BASE}/ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ use_cache_on_score_failure: false }),
          });
        } catch {}
        setPhase("complete");
        setStatusMessage("Analysis complete!");
      } catch (err) {
        setPhase("idle");
        setStatusMessage(
          `Error: ${err instanceof Error ? err.message : "Upload failed"}`,
        );
      } finally {
        setUploading(false);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setPhase("parsing");
    setStatusMessage("Parsing document...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const parseRes = await fetch(`${API_BASE}/parse`, {
        method: "POST",
        body: formData,
      });

      if (!parseRes.ok) {
        const errorText = await parseRes.text();
        throw new Error(errorText);
      }

      setPhase("analyzing");
      setStatusMessage("Analyzing ESG claims...");

      const scoreRes = await fetch(`${API_BASE}/score`);
      if (!scoreRes.ok) {
        const errorText = await scoreRes.text();
        throw new Error(errorText);
      }

      const data: ScoreData = await scoreRes.json();
      setScoreData(data);
      if (data.vulnerable_clauses.length > 0) {
        setSelectedClause(data.vulnerable_clauses[0]);
      }

      setStatusMessage("Syncing with AI assistant...");
      try {
        await fetch(`${API_BASE}/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ use_cache_on_score_failure: false }),
        });
      } catch {
        // Ingest failed but score succeeded - continue anyway
      }

      setPhase("complete");
      setStatusMessage("Analysis complete!");
    } catch (err) {
      setPhase("idle");
      setStatusMessage(
        `Error: ${err instanceof Error ? err.message : "Upload failed"}`,
      );
    } finally {
      setUploading(false);
    }
  };

  const getScoreColor = (
    score: number,
    type: "trust" | "risk" | "credibility",
  ): string => {
    if (type === "risk") {
      if (score <= 20) return "rgb(20, 100, 40)";
      if (score <= 40) return "rgb(100, 140, 40)";
      if (score <= 60) return "rgb(180, 140, 40)";
      return "rgb(180, 60, 40)";
    }
    if (score >= 80) return "rgb(20, 100, 40)";
    if (score >= 60) return "rgb(100, 140, 40)";
    if (score >= 40) return "rgb(180, 140, 40)";
    return "rgb(180, 60, 40)";
  };

  const getVulnerabilityColor = (score: number): string => {
    if (score <= 20) return "rgb(20, 100, 40)";
    if (score <= 40) return "rgb(160, 130, 20)";
    if (score <= 60) return "rgb(200, 80, 20)";
    return "rgb(140, 20, 20)";
  };

  const getSeverityLabel = (score: number): string => {
    if (score <= 20) return "LOW";
    if (score <= 40) return "MEDIUM";
    if (score <= 60) return "HIGH";
    return "CRITICAL";
  };

  if (!startup && !startupFromJson) {
    return <div>Startup not found</div>;
  }

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

        <div className="relative z-10 max-w-6xl mx-auto">
          <div
            className="flex justify-end flex-col items-end gap-0.5"
            style={{ marginBottom: "-5rem" }}
          >
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
            {phase === "complete" && (
              <button
                onClick={() => {
                  const element = document.querySelector("[data-ai-resolver]");
                  if (element) {
                    element.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }
                }}
                className={`${montserrat.className} text-lg font-semibold`}
                style={{
                  color: "rgb(237, 243, 189)",
                  letterSpacing: "0.04em",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  transition: "transform 0.18s cubic-bezier(.4,1.3,.6,1)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = "scale(1.05)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                ai assistant →
              </button>
            )}
          </div>

          <div
            style={{
              fontFamily: "Playfair Display, serif",
              fontWeight: 400,
              fontSize: "6rem",
              color: "rgb(237, 243, 189)",
              letterSpacing: "-0.03em",
              lineHeight: 1,
              marginBottom: "0.5rem",
              marginTop: "-4rem",
            }}
          >
            {startupFromJson?.name || startup?.name || "Startup"}
          </div>

          {/* Analysis Phase Indicator with delay */}
          {showAnalysisBox && phase !== "idle" && (
            <div
              className={`mb-10 p-4 ${sairaExtraCondensed.className}`}
              style={{
                background: "rgba(237, 243, 189, 0.95)",
                borderRadius: "8px",
                border: "2px solid rgb(20, 54, 17)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(phase === "parsing" || phase === "analyzing") && (
                    <>
                      <div className="relative">
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            border:
                              phase === "parsing"
                                ? "2px solid rgb(20, 54, 17)"
                                : undefined,
                            borderTopColor:
                              phase === "parsing" ? "transparent" : undefined,
                            background:
                              phase === "analyzing"
                                ? "rgb(20, 54, 17)"
                                : undefined,
                            animation:
                              phase === "parsing"
                                ? "spin 1s linear infinite"
                                : "pulse 1s ease-in-out infinite",
                          }}
                        />
                        <style>{`
                          @keyframes spin {
                            to { transform: rotate(360deg); }
                          }
                          @keyframes pulse {
                            0%, 100% { opacity: 1; transform: scale(1); }
                            50% { opacity: 0.5; transform: scale(0.8); }
                          }
                        `}</style>
                      </div>
                      <span
                        style={{ color: "rgb(26, 28, 18)", fontSize: "1.1rem" }}
                      >
                        {statusMessage || "Analyzing ESG report..."}
                      </span>
                    </>
                  )}
                  {phase === "complete" && (
                    <>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "rgb(20, 100, 40)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: 12,
                          fontWeight: "bold",
                        }}
                      >
                        ✓
                      </div>
                      <span
                        style={{
                          color: "rgb(20, 100, 40)",
                          fontSize: "1.1rem",
                          fontWeight: 600,
                        }}
                      >
                        Analysis Complete
                      </span>
                    </>
                  )}
                </div>
                {phase !== "complete" && (
                  <div className="flex gap-1">
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background:
                          phase === "parsing"
                            ? "rgb(20, 54, 17)"
                            : "rgb(180, 180, 140)",
                        transition: "background 0.3s",
                      }}
                    />
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background:
                          phase === "analyzing" || phase === "complete"
                            ? "rgb(20, 54, 17)"
                            : "rgb(180, 180, 140)",
                        transition: "background 0.3s",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Zone */}
          <div
            className={`mb-10 p-6 ${sairaExtraCondensed.className}`}
            style={{
              background: "rgb(237, 243, 189)",
              borderRadius: "8px",
              border: isDragging
                ? "3px dashed rgb(20, 54, 17)"
                : "3px dashed rgb(85, 81, 46)",
              transition: "border-color 0.2s ease",
              opacity: phase === "parsing" || phase === "analyzing" ? 0.6 : 1,
              pointerEvents:
                phase === "parsing" || phase === "analyzing" ? "none" : "auto",
              minHeight: 220,
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="text-center flex flex-col justify-center h-full">
              <div
                className="text-4xl font-bold mb-2 mt-4"
                style={{
                  letterSpacing: "-0.03em",
                  color: "rgb(26, 28, 18)",
                  lineHeight: "0.9",
                }}
              >
                UPLOAD ESG REPORT
              </div>
              <div
                className="text-l mb-4"
                style={{
                  letterSpacing: "-0.03em",
                  color: "rgb(85, 81, 46)",
                  lineHeight: "0.9",
                }}
              >
                DRAG AND DROP YOUR FILE HERE OR CLICK TO BROWSE
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md px-2 py-4 text-lg font-semibold"
                style={{
                  background: "rgb(237, 243, 189)",
                  color: "rgb(26, 28, 18)",
                  border: "1.5px solid rgb(85, 81, 46)",
                  fontSize: "1.25rem",
                  letterSpacing: "0.01em",
                  maxWidth: "150px",
                  width: "150px",
                  margin: "0 auto",
                  display: "block",
                }}
              >
                CHOOSE FILE
              </button>

              {file && (
                <span
                  className="text-sm ml-2"
                  style={{ color: "rgb(26, 28, 18)" }}
                >
                  {file.name}
                </span>
              )}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_380px] gap-6 mb-10">
            {/* Left Column: Key Stats + Radar Chart */}
            <div>
              {/* Key Stats Row */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div
                  className={`bg-[rgb(237,243,189)] shadow p-5 ${sairaExtraCondensed.className}`}
                  style={{ color: "rgb(26, 28, 18)" }}
                >
                  <div
                    className="font-bold text-4xl"
                    style={{ lineHeight: "0.9", letterSpacing: "-0.03em" }}
                  >
                    CLIMATE TRUST
                  </div>
                  <div
                    className="text-4xl font-bold mt-3"
                    style={{
                      color: scoreData
                        ? getScoreColor(scoreData.overall_trust_score, "trust")
                        : "rgb(120, 120, 120)",
                    }}
                  >
                    {scoreData ? scoreData.overall_trust_score : "--"}
                  </div>
                </div>

                <div
                  className={`bg-[rgb(237,243,189)] shadow p-5 ${sairaExtraCondensed.className}`}
                  style={{ color: "rgb(26, 28, 18)" }}
                >
                  <div
                    className="font-bold text-4xl"
                    style={{ lineHeight: "0.9", letterSpacing: "-0.03em" }}
                  >
                    GREENWASH RISK
                  </div>
                  <div
                    className="text-4xl font-bold mt-3"
                    style={{
                      color: scoreData
                        ? getScoreColor(
                            Math.round(
                              scoreData.vulnerable_clauses.reduce(
                                (sum, c) => sum + c.vulnerability_score,
                                0,
                              ) / scoreData.vulnerable_clauses.length,
                            ),
                            "risk",
                          )
                        : "rgb(120, 120, 120)",
                    }}
                  >
                    {scoreData
                      ? `${Math.round(scoreData.vulnerable_clauses.reduce((sum, c) => sum + c.vulnerability_score, 0) / scoreData.vulnerable_clauses.length)}%`
                      : "--"}
                  </div>
                </div>
              </div>

              {/* Goal Scores Radar Chart */}
              <div
                className={`bg-[rgb(237,243,189)] shadow p-5 ${sairaExtraCondensed.className}`}
                style={{ color: "rgb(26, 28, 18)", marginBottom: "1.5rem" }}
              >
                <div
                  className="font-bold text-4xl mb-2"
                  style={{ lineHeight: "0.9", letterSpacing: "-0.03em" }}
                >
                  ESG GOAL BREAKDOWN
                </div>
                {!scoreData?.goal_scores ? (
                  <div
                    className="h-[280px] flex items-center justify-center"
                    style={{ color: "rgb(100, 100, 80)" }}
                  >
                    Upload a report to see goal analysis
                  </div>
                ) : (
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart
                        data={[
                          {
                            subject: "CARBON",
                            value: scoreData.goal_scores.carbon_reduction,
                            fullMark: 100,
                          },
                          {
                            subject: "RENEWABLE",
                            value: scoreData.goal_scores.renewable_energy,
                            fullMark: 100,
                          },
                          {
                            subject: "WATER",
                            value: scoreData.goal_scores.water_management,
                            fullMark: 100,
                          },
                          {
                            subject: "WASTE",
                            value: scoreData.goal_scores.waste_reduction,
                            fullMark: 100,
                          },
                          {
                            subject: "SOCIAL",
                            value: scoreData.goal_scores.social_responsibility,
                            fullMark: 100,
                          },
                          {
                            subject: "GOVERNANCE",
                            value: scoreData.goal_scores.governance,
                            fullMark: 100,
                          },
                        ]}
                      >
                        <PolarGrid stroke="rgb(85, 81, 46)" />
                        <PolarAngleAxis
                          dataKey="subject"
                          tick={{
                            fill: "rgb(26, 28, 18)",
                            fontSize: 13,
                            fontFamily: "Saira Extra Condensed",
                            letterSpacing: 0.1,
                          }}
                        />
                        <PolarRadiusAxis
                          angle={30}
                          domain={[0, 100]}
                          tick={{ fill: "rgb(85, 81, 46)", fontSize: 9 }}
                        />
                        <Radar
                          name="Score"
                          dataKey="value"
                          stroke="rgb(20, 54, 17)"
                          fill="rgb(20, 54, 17)"
                          fillOpacity={0.5}
                          strokeWidth={2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Syntax Notes */}
              {scoreData && scoreData.syntax_notes && (
                <div
                  className={`bg-[rgb(237,243,189)] shadow p-5 ${sairaExtraCondensed.className}`}
                  style={{ color: "rgb(26, 28, 18)" }}
                >
                  <div
                    className="font-bold text-4xl mb-3"
                    style={{ lineHeight: "0.9", letterSpacing: "-0.03em" }}
                  >
                    ANALYSIS SUMMARY
                  </div>
                  <p
                    className="text-lg"
                    style={{ color: "rgb(60, 60, 50)", lineHeight: 1.1 }}
                  >
                    {scoreData.syntax_notes}
                  </p>
                </div>
              )}
            </div>

            {/* Middle Column: Risk Indicators + Vulnerabilities Visualization */}
            <div>
              {/* Risk Indicators Bar Chart */}
              <div
                className={`bg-[rgb(237,243,189)] shadow p-5 ${sairaExtraCondensed.className}`}
                style={{ color: "rgb(26, 28, 18)", marginBottom: "1.5rem" }}
              >
                <div
                  className="font-bold text-4xl mb-2"
                  style={{ lineHeight: "0.9", letterSpacing: "-0.03em" }}
                >
                  RISK INDICATORS
                </div>
                {!scoreData?.risk_indicators ? (
                  <div
                    className="h-[200px] flex items-center justify-center"
                    style={{ color: "rgb(100, 100, 80)" }}
                  >
                    Upload a report to see risk analysis
                  </div>
                ) : (
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={[
                          {
                            name: "GREENWASH SIGNALS",
                            value:
                              scoreData.risk_indicators.greenwashing_signals,
                          },
                          {
                            name: "COMMITMENT QUALITY",
                            value:
                              scoreData.risk_indicators.commitment_specificity,
                          },
                          {
                            name: "ACCOUNTABILITY",
                            value:
                              scoreData.risk_indicators.accountability_score,
                          },
                          {
                            name: "BASELINE QUALITY",
                            value: scoreData.risk_indicators.baseline_quality,
                          },
                          {
                            name: "TIMELINE CLARITY",
                            value: scoreData.risk_indicators.timeline_clarity,
                          },
                        ]}
                        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                      >
                        <XAxis type="number" domain={[0, 100]} hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{
                            fill: "rgb(26, 28, 18)",
                            fontSize: 14,
                            fontFamily: "Saira Extra Condensed",
                            letterSpacing: 0.1,
                          }}
                          width={20}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {[
                            scoreData.risk_indicators.greenwashing_signals,
                            scoreData.risk_indicators.commitment_specificity,
                            scoreData.risk_indicators.accountability_score,
                            scoreData.risk_indicators.baseline_quality,
                            scoreData.risk_indicators.timeline_clarity,
                          ].map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                entry > 60
                                  ? "rgb(180, 60, 40)"
                                  : entry > 40
                                    ? "rgb(180, 140, 40)"
                                    : "rgb(20, 100, 40)"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Vulnerabilities by Type */}
              <div
                className={`bg-[rgb(237,243,189)] shadow p-5 ${sairaExtraCondensed.className}`}
                style={{ color: "rgb(26, 28, 18)" }}
              >
                <div
                  className="font-bold text-4xl mb-4"
                  style={{ lineHeight: "0.9", letterSpacing: "-0.03em" }}
                >
                  VULNERABILITIES BY SEVERITY
                </div>

                {!scoreData ? (
                  <div
                    className="py-8 text-center"
                    style={{ color: "rgb(100, 100, 80)" }}
                  >
                    Upload a report to see vulnerabilities
                  </div>
                ) : scoreData.vulnerable_clauses.filter(
                    (_, idx) => !resolvedClauses.has(idx),
                  ).length === 0 ? (
                  <div
                    className="py-8 text-center"
                    style={{ color: "rgb(20, 100, 40)" }}
                  >
                    All vulnerabilities resolved!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {scoreData.vulnerable_clauses
                      .filter((_, idx) => !resolvedClauses.has(idx))
                      .sort(
                        (a, b) => b.vulnerability_score - a.vulnerability_score,
                      )
                      .map((clause, idx) => (
                        <div
                          key={idx}
                          className={`p-4 border-l-4 cursor-pointer transition-all ${
                            selectedClause === clause
                              ? "bg-white shadow-lg border-l-8"
                              : "bg-white/60 hover:bg-white/80"
                          }`}
                          onClick={() => setSelectedClause(clause)}
                          style={{
                            borderLeftColor: getVulnerabilityColor(
                              clause.vulnerability_score,
                            ),
                            borderLeftWidth:
                              selectedClause === clause ? "6px" : "4px",
                            boxShadow:
                              selectedClause === clause
                                ? "0 6px 20px rgba(0,0,0,0.15)"
                                : "none",
                          }}
                        >
                          <div className="flex items-center justify-between gap-2 mb-0">
                            <span
                              className="font-bold uppercase px-0 py-1 rounded"
                              style={{
                                fontSize: "1.5rem",
                                background: `${getVulnerabilityColor(clause.vulnerability_score)}20`,
                                color: getVulnerabilityColor(
                                  clause.vulnerability_score,
                                ),
                              }}
                            >
                              {getSeverityLabel(clause.vulnerability_score)}
                            </span>
                            <span
                              className="text-xs font-bold"
                              style={{
                                fontSize: "1.5rem",
                                color: getVulnerabilityColor(
                                  clause.vulnerability_score,
                                ),
                              }}
                            >
                              {clause.vulnerability_score}
                            </span>
                          </div>
                          <p
                            className="text-sm line-clamp-2 font-medium"
                            style={{
                              color: "rgb(30, 30, 20)",
                              letterSpacing: "-0.02em",
                              lineHeight: 1.1,
                            }}
                          >
                            {clause.clause_text}
                          </p>
                          <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${clause.vulnerability_score}%`,
                                background: getVulnerabilityColor(
                                  clause.vulnerability_score,
                                ),
                              }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Selected Clause Detail */}
            <div>
              {/* Net-Zero + Vulnerabilities Count */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div
                  className={`bg-[rgb(237,243,189)] shadow p-5 ${sairaExtraCondensed.className}`}
                  style={{ color: "rgb(26, 28, 18)" }}
                >
                  <div
                    className="font-bold text-4xl"
                    style={{ lineHeight: "0.9", letterSpacing: "-0.03em" }}
                  >
                    NET-ZERO CRED
                  </div>
                  <div
                    className="text-4xl font-bold mt-3"
                    style={{
                      color: scoreData
                        ? getScoreColor(
                            scoreData.net_zero_credibility,
                            "credibility",
                          )
                        : "rgb(120, 120, 120)",
                    }}
                  >
                    {scoreData ? scoreData.net_zero_credibility : "--"}
                  </div>
                </div>

                <div
                  className={`bg-[rgb(237,243,189)] shadow p-5 ${sairaExtraCondensed.className}`}
                  style={{ color: "rgb(26, 28, 18)" }}
                >
                  <div
                    className="font-bold text-4xl"
                    style={{ lineHeight: "0.9", letterSpacing: "-0.03em" }}
                  >
                    VULNERABLE CLAUSES
                  </div>
                  <div
                    className="text-4xl font-bold mt-3"
                    style={{ color: "rgb(26, 28, 18)" }}
                  >
                    {scoreData ? scoreData.vulnerable_clauses.length : "--"}
                  </div>
                </div>
              </div>

              {/* Selected Clause Detail */}
              <div
                className={`bg-[rgb(237,243,189)] shadow p-5 ${sairaExtraCondensed.className}`}
                style={{
                  color: "rgb(26, 28, 18)",
                  maxHeight: 500,
                  overflowY: "auto",
                }}
              >
                <div
                  className="font-bold text-4xl mb-4"
                  style={{ lineHeight: "0.9", letterSpacing: "-0.03em" }}
                >
                  CLAUSE DETAIL
                </div>

                {!selectedClause ? (
                  <div
                    className="py-8 text-center"
                    style={{ color: "rgb(100, 100, 80)" }}
                  >
                    Select a vulnerability to view details
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Vulnerability Score */}
                    <div className="flex items-center gap-3">
                      <span
                        className="font-bold"
                        style={{
                          color: getVulnerabilityColor(
                            selectedClause.vulnerability_score,
                          ),
                          fontSize: "1.7rem",
                        }}
                      >
                        VULNERABILITY: {selectedClause.vulnerability_score}
                      </span>
                    </div>

                    {/* Vulnerable Text */}
                    <div>
                      <div
                        className="text-xs font-bold mb-2 uppercase"
                        style={{
                          color: "rgb(85, 81, 46)",
                          fontSize: "1.5rem",
                        }}
                      >
                        Vulnerable Text
                      </div>
                      <div
                        className="p-4"
                        style={{
                          background: "rgb(255, 250, 245)",
                          borderLeft: `4px solid ${getVulnerabilityColor(selectedClause.vulnerability_score)}`,
                        }}
                      >
                        <p
                          className="text-base font-medium"
                          style={{
                            color: "rgb(85, 81, 46)",
                            lineHeight: 1.1,
                          }}
                        >
                          {selectedClause.clause_text}
                        </p>
                      </div>
                    </div>

                    {selectedClause.notes && (
                      <div
                        className="text-xs font-bold mb-2"
                        style={{
                          fontSize: "1.5rem",
                          color: "rgb(85, 81, 46)",
                        }}
                      >
                        ANALYSIS
                        <p
                          className="text-base font-medium"
                          style={{ color: "rgb(50, 50, 40)", lineHeight: 1.1 }}
                        >
                          {selectedClause.notes}
                        </p>
                      </div>
                    )}
                    {selectedClause.similar_bad_examples.length > 0 && (
                      <div>
                        <div
                          className="text-xs font-bold mb-2 uppercase"
                          style={{
                            color: "rgb(180, 60, 40)",
                            fontSize: "1.5rem",
                          }}
                        >
                          Known Similar Cases
                        </div>
                        <div className="space-y-2">
                          {selectedClause.similar_bad_examples.map((ex, i) => (
                            <div
                              key={i}
                              className="p-3"
                              style={{
                                background: "rgb(255, 245, 240)",
                                borderLeft: "3px solid rgb(180, 60, 40)",
                              }}
                            >
                              <p
                                className="text-sm italic mb-2"
                                style={{ color: "rgb(60, 60, 50)" }}
                              >
                                &ldquo;{ex.example_clause}&rdquo;
                              </p>
                              <p
                                className="text-xs font-bold"
                                style={{ color: "rgb(180, 60, 40)" }}
                              >
                                — {ex.source}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI VULNERABILITY RESOLVER SECTION - Card-Based Layout */}
          {scoreData && (
            <div data-ai-resolver>
              {/* AI Vulnerability Resolver Title (styled like startup name) */}
              <div
                style={{
                  fontFamily: "Playfair Display, serif",
                  fontWeight: 400,
                  fontSize: "5rem",
                  color: "rgb(237, 243, 189)",
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                  marginBottom: "1.5rem",
                  marginTop: "7rem",
                  textShadow: "0 2px 16px rgba(36,44,32,0.18)",
                  textAlign: "left",
                }}
              >
                ai vulnerability resolver
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
                {/* Left Column: Chat */}
                <div
                  className="bg-[rgb(237,243,189)] shadow rounded-lg overflow-hidden flex flex-col"
                  style={{ height: "600px" }}
                >
                  {/* Chat Messages */}
                  <div
                    className="flex-1 overflow-y-auto p-4 space-y-4"
                    style={{ background: "rgb(250, 245, 235)" }}
                  >
                    {chatMessages.length === 0 ? (
                      <div
                        className="h-full flex flex-col items-center justify-center text-center"
                        style={{ color: "rgb(85, 81, 46)" }}
                      >
                        <div
                          style={{
                            fontFamily: "Playfair Display, serif",
                            fontSize: "1.8rem",
                            fontWeight: 400,
                            marginBottom: "12px",
                            color: "rgb(85, 81, 46)",
                          }}
                        >
                          start a conversation
                        </div>
                        <div className="text-xs opacity-70 max-w-xs">
                          ask about vulnerabilities, request rectified clauses,
                          or generate investor communications
                        </div>
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className="max-w-[80%] rounded-lg px-4 py-2 text-sm"
                            style={{
                              background:
                                msg.role === "user"
                                  ? "rgb(20, 54, 17)"
                                  : "white",
                              color:
                                msg.role === "user"
                                  ? "white"
                                  : "rgb(26, 28, 18)",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                            }}
                          >
                            {msg.text}
                          </div>
                        </div>
                      ))
                    )}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div
                          className="rounded-lg px-4 py-2"
                          style={{ background: "white" }}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{
                                background: "rgb(20, 54, 17)",
                                animation: "pulse 1s infinite",
                              }}
                            />
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{
                                background: "rgb(20, 54, 17)",
                                animation: "pulse 1s infinite 0.2s",
                              }}
                            />
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{
                                background: "rgb(20, 54, 17)",
                                animation: "pulse 1s infinite 0.4s",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chat Input */}
                  <form
                    onSubmit={handleSendChat}
                    className="p-4 border-t"
                    style={{ borderColor: "rgb(200, 190, 160)" }}
                  >
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="ask about vulnerabilities..."
                        className="flex-1 px-3 py-2 rounded border text-sm focus:outline-none"
                        style={{
                          background: "white",
                          borderColor: "rgb(200, 190, 160)",
                        }}
                        disabled={chatLoading}
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || chatLoading}
                        className="px-4 py-2 text-sm font-semibold rounded transition-all"
                        style={{
                          background:
                            chatInput.trim() && !chatLoading
                              ? "rgb(20, 54, 17)"
                              : "rgb(120, 120, 120)",
                          color: "white",
                        }}
                      >
                        send
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right Column: Controls & Clauses */}
                <div className="flex flex-col gap-6">
                  {/* Current Clause Card */}
                  {currentChatClause && (
                    <div
                      className={`bg-[rgb(237,243,189)] shadow p-4 relative ${sairaExtraCondensed.className}`}
                      style={{
                        background: "rgb(237, 243, 189)",
                        color: "rgb(26, 28, 18)",
                        borderLeft: "none",
                      }}
                    >
                      {/* Score number top right, text colored */}
                      <div
                        className="absolute top-4 right-4 font-bold"
                        style={{
                          color: getVulnerabilityColor(
                            currentChatClause.vulnerability_score,
                          ),
                          fontSize: "1.5rem",
                          letterSpacing: "0.01em",
                        }}
                      >
                        {currentChatClause.vulnerability_score}
                      </div>
                      <div
                        className="font-bold text-4xl mb-2"
                        style={{
                          lineHeight: "0.9",
                          letterSpacing: "-0.03em",
                          color: "rgb(26, 28, 18)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        CURRENT CLAUSE
                      </div>
                      <div
                        className="text-sm mb-2"
                        style={{
                          color: "rgb(85, 81, 46)",
                          fontWeight: 500,
                          fontSize: "1.15rem",
                          lineHeight: "1.15",
                          letterSpacing: "-0.01em",
                          marginBottom: "0.5rem",
                        }}
                      >
                        {currentChatClause.clause_text}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        gap: "2rem",
                        justifyContent: "center",
                        width: "100%",
                      }}
                    >
                      <button
                        onClick={handleResolveClause}
                        disabled={
                          !currentChatClause || resolvingClauseIdx !== null
                        }
                        className={`font-bold transition-all ${montserrat.className}`}
                        style={{
                          background: "none",
                          border: "none",
                          color: "rgb(237, 243, 189)",
                          letterSpacing: "0.03em",
                          fontSize: "1.1rem",
                          textTransform: "lowercase",
                          cursor:
                            currentChatClause && resolvingClauseIdx === null
                              ? "pointer"
                              : "not-allowed",
                          padding: 0,
                          width: "auto",
                          textAlign: "center",
                          opacity:
                            currentChatClause && resolvingClauseIdx === null
                              ? 1
                              : 0.5,
                          transition:
                            "font-size 0.18s cubic-bezier(.4,1.3,.6,1)",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.fontSize = "1.35rem")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.fontSize = "1.1rem")
                        }
                      >
                        resolve
                      </button>
                      <button
                        onClick={handleGetRectifiedClause}
                        disabled={!currentChatClause || chatLoading}
                        className={`font-bold transition-all ${montserrat.className}`}
                        style={{
                          background: "none",
                          border: "none",
                          color: "rgb(237, 243, 189)",
                          letterSpacing: "0.03em",
                          fontSize: "1.1rem",
                          textTransform: "lowercase",
                          cursor:
                            currentChatClause && !chatLoading
                              ? "pointer"
                              : "not-allowed",
                          padding: 0,
                          width: "auto",
                          textAlign: "center",
                          opacity: currentChatClause && !chatLoading ? 1 : 0.5,
                          transition:
                            "font-size 0.18s cubic-bezier(.4,1.3,.6,1)",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.fontSize = "1.35rem")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.fontSize = "1.1rem")
                        }
                      >
                        get fixed clause
                      </button>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        width: "100%",
                      }}
                    >
                      <button
                        onClick={handleGenerateEmail}
                        disabled={!currentChatClause || chatLoading}
                        className={`font-bold transition-all ${montserrat.className}`}
                        style={{
                          background: "none",
                          border: "none",
                          color: "rgb(237, 243, 189)",
                          letterSpacing: "0.03em",
                          fontSize: "1.1rem",
                          textTransform: "lowercase",
                          cursor:
                            currentChatClause && !chatLoading
                              ? "pointer"
                              : "not-allowed",
                          padding: 0,
                          width: "auto",
                          textAlign: "center",
                          opacity: currentChatClause && !chatLoading ? 1 : 0.5,
                          transition:
                            "font-size 0.18s cubic-bezier(.4,1.3,.6,1)",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.fontSize = "1.35rem")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.fontSize = "1.1rem")
                        }
                      >
                        generate email
                      </button>
                    </div>
                  </div>

                  {/* Vulnerabilities List */}
                  <div
                    className={`bg-[rgb(237,243,189)] shadow p-4 ${sairaExtraCondensed.className}`}
                    style={{
                      color: "rgb(26, 28, 18)",
                      maxHeight: "300px",
                      overflowY: "auto",
                    }}
                  >
                    <div
                      className="font-bold text-4xl mb-3"
                      style={{
                        lineHeight: "0.9",
                        letterSpacing: "-0.03em",
                        color: "rgb(26, 28, 18)",
                        marginBottom: "0.5rem",
                      }}
                    >
                      REMAINING CLAUSES
                    </div>
                    <div className="space-y-2">
                      {getUnresolvedClauses().map((clause, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setChatClauseIndex(idx);
                            setSelectedClause(clause);
                          }}
                          className="p-2 cursor-pointer transition-all text-xs"
                          style={{
                            background:
                              currentChatClause === clause
                                ? "rgb(255, 250, 245)"
                                : "white",
                            borderLeft: `3px solid ${getVulnerabilityColor(clause.vulnerability_score)}`,
                            borderRadius: 0,
                          }}
                        >
                          <div
                            className="font-bold mb-1"
                            style={{
                              color: getVulnerabilityColor(
                                clause.vulnerability_score,
                              ),
                            }}
                          >
                            {clause.vulnerability_score}
                          </div>
                          <p
                            className="line-clamp-2"
                            style={{ color: "rgb(50, 50, 40)" }}
                          >
                            {clause.clause_text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div
                    className={`bg-[rgb(237,243,189)] shadow p-3 text-center ${sairaExtraCondensed.className}`}
                    style={{
                      fontFamily: "Saira Extra Condensed",
                      fontWeight: "bold",
                      fontSize: "2rem",
                      lineHeight: "0.9",
                      letterSpacing: "-0.03em",
                      color: "rgb(26, 28, 18)",
                    }}
                  >
                    STATUS: {chatStatus}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Email Modal */}
          {emailModalOpen && (
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center px-4"
              style={{ background: "rgba(20, 30, 20, 0.85)" }}
              onClick={() => setEmailModalOpen(false)}
            >
              <div
                className="w-full max-w-2xl shadow-2xl overflow-hidden"
                style={{ background: "rgb(237, 243, 189)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 pt-6 pb-0">
                  <h3
                    className="font-bold text-4xl mb-2"
                    style={{
                      fontFamily: "Saira Extra Condensed",
                      color: "rgb(56, 58, 45)",
                      lineHeight: "0.9",
                      letterSpacing: "-0.03em",
                      marginBottom: "0.5rem",
                    }}
                  >
                    INVESTOR EMAIL DRAFT
                  </h3>
                </div>
                <div className="p-6">
                  <pre
                    className="max-h-[400px] overflow-auto rounded-lg p-4 text-sm whitespace-pre-wrap"
                    style={{
                      background: "rgb(250, 245, 235)",
                      color: "rgb(26, 28, 18)",
                    }}
                  >
                    {emailDraft || "No draft generated."}
                  </pre>
                  <div className="mt-6 flex justify-end gap-6">
                    <button
                      onClick={() => setEmailModalOpen(false)}
                      className="font-semibold email-modal-btn"
                      style={{
                        border: "none",
                        background: "none",
                        color: "rgb(56, 58, 45)",
                        cursor: "pointer",
                        padding: 0,
                        fontSize: "1.1rem",
                        letterSpacing: "0.01em",
                        transition: "transform 0.18s cubic-bezier(.4,1.3,.6,1)",
                        display: "inline-block",
                      }}
                    >
                      close
                    </button>
                    <button
                      onClick={() => {
                        setEmailModalOpen(false);
                        setChatMessages((prev) => [
                          ...prev,
                          {
                            role: "assistant",
                            text: "Email draft sent to investor.",
                          },
                        ]);
                      }}
                      className="font-semibold email-modal-btn"
                      style={{
                        border: "none",
                        background: "none",
                        color: "rgb(56, 58, 45)",
                        cursor: "pointer",
                        padding: 0,
                        fontSize: "1.1rem",
                        letterSpacing: "0.01em",
                        transition: "transform 0.18s cubic-bezier(.4,1.3,.6,1)",
                        display: "inline-block",
                      }}
                    >
                      accept and send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
            .email-modal-btn:hover {
              transform: scale(1.05);
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}
