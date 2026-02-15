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

  // Chat modal state
  const [chatOpen, setChatOpen] = useState(false);
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
  // Controls when the analysis box appears
  const [showAnalysisBox, setShowAnalysisBox] = useState(false);

  const RAG_API_BASE = "http://localhost:8000";

  useEffect(() => {
    setTimeout(() => setFadeIn(true), 200);
  }, []);

  // Delay showing the analysis box after dropbox disables
  useEffect(() => {
    if (phase === "parsing" || phase === "analyzing") {
      setShowAnalysisBox(false);
      const timeout = setTimeout(() => setShowAnalysisBox(true), 600); // 600ms delay
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

      // Move to next clause or close
      const remaining = getUnresolvedClauses();
      if (remaining.length > 0) {
        setChatClauseIndex(0); // Reset to first
        setSelectedClause(remaining[0]);
        setChatStatus("Clause resolved! Moving to next...");
      } else {
        setSelectedClause(null);
        setChatStatus("All clauses resolved!");
        setChatOpen(false);
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

  const calculateGreenwashRisk = (data: ScoreData): number => {
    if (!data.vulnerable_clauses.length) return 0;
    const total = data.vulnerable_clauses.reduce(
      (sum, c) => sum + c.vulnerability_score,
      0,
    );
    return Math.round(total / data.vulnerable_clauses.length);
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
    if (score <= 20) return "rgb(20, 100, 40)"; // green
    if (score <= 40) return "rgb(160, 130, 20)"; // darker yellow
    if (score <= 60) return "rgb(200, 80, 20)"; // darker orange
    return "rgb(140, 20, 20)"; // dark red for high risk
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
          <div className=" flex justify-end">
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
                      {phase === "analyzing" && (
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: "50%",
                            height: 2,
                            background:
                              "linear-gradient(90deg, transparent, rgb(20, 54, 17), transparent)",
                            animation: "scan 2s ease-in-out infinite",
                          }}
                        />
                      )}
                      <style>{`
                        @keyframes scan {
                          0%, 100% { transform: translateX(-100%); }
                          50% { transform: translateX(100%); }
                        }
                      `}</style>
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

              {/* Upload & Analyze button removed; analysis now starts automatically after file upload */}

              {/* Status message removed from dropbox; now only appears in the analysis box above */}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_380px] gap-6">
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
                            calculateGreenwashRisk(scoreData),
                            "risk",
                          )
                        : "rgb(120, 120, 120)",
                    }}
                  >
                    {scoreData ? `${calculateGreenwashRisk(scoreData)}%` : "--"}
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
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart
                        data={[
                          {
                            subject: "Carbon",
                            value: scoreData.goal_scores.carbon_reduction,
                            fullMark: 100,
                          },
                          {
                            subject: "Renewable",
                            value: scoreData.goal_scores.renewable_energy,
                            fullMark: 100,
                          },
                          {
                            subject: "Water",
                            value: scoreData.goal_scores.water_management,
                            fullMark: 100,
                          },
                          {
                            subject: "Waste",
                            value: scoreData.goal_scores.waste_reduction,
                            fullMark: 100,
                          },
                          {
                            subject: "Social",
                            value: scoreData.goal_scores.social_responsibility,
                            fullMark: 100,
                          },
                          {
                            subject: "Governance",
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
                            fontSize: 11,
                            fontFamily: "Saira Extra Condensed",
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
                    className="text-sm leading-relaxed"
                    style={{ color: "rgb(60, 60, 50)" }}
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
                            name: "Greenwash Signals",
                            value:
                              scoreData.risk_indicators.greenwashing_signals,
                          },
                          {
                            name: "Commitment Quality",
                            value:
                              scoreData.risk_indicators.commitment_specificity,
                          },
                          {
                            name: "Accountability",
                            value:
                              scoreData.risk_indicators.accountability_score,
                          },
                          {
                            name: "Baseline Quality",
                            value: scoreData.risk_indicators.baseline_quality,
                          },
                          {
                            name: "Timeline Clarity",
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
                            fontSize: 10,
                            fontFamily: "Saira Extra Condensed",
                          }}
                          width={75}
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
                            }}
                          >
                            {clause.clause_text}
                          </p>
                          <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                letterSpacing: "-0.25rem",
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
                    {/* Vulnerability Badge (symbol removed) */}
                    <div className="flex items-center gap-3">
                      <div
                        className="px-3 py-2 rounded-lg font-bold"
                        style={{
                          background: getVulnerabilityColor(
                            selectedClause.vulnerability_score,
                          ),
                          color: "white",
                          fontSize: "1.1rem",
                        }}
                      >
                        Vulnerability: {selectedClause.vulnerability_score}
                      </div>
                    </div>

                    {/* Vulnerable Text - More Prominent */}
                    <div>
                      <div
                        className="text-xs font-bold mb-2 uppercase"
                        style={{ color: "rgb(85, 81, 46)", fontSize: "1.5rem" }}
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
                          className="text-base font-medium leading-relaxed"
                          style={{ color: "rgb(85, 81, 46)" }}
                        >
                          {selectedClause.clause_text}
                        </p>
                      </div>
                    </div>

                    {selectedClause.notes && (
                      <div
                        className="text-xs font-bold mb-2 "
                        style={{
                          borderRadius: 0,
                          fontSize: "1.5rem",
                          color: "rgb(85, 81, 46)",
                        }}
                      >
                        ANALYSIS
                        <p
                          className="text-base font-medium leading-relaxed"
                          style={{ color: "rgb(50, 50, 40)" }}
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

          {/* Floating AI Assistant Button */}
          <button
            onClick={() => setChatOpen(true)}
            disabled={!scoreData}
            className="fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl transition-all hover:scale-105 hover:shadow-xl"
            style={{
              background: scoreData
                ? "linear-gradient(135deg, rgb(20, 54, 17) 0%, rgb(40, 90, 30) 100%)"
                : "rgb(120, 120, 120)",
              color: "rgb(237, 243, 189)",
              opacity: scoreData ? 1 : 0.6,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <div className="text-left">
              <div className="font-bold text-sm">AI Assistant</div>
              <div className="text-xs opacity-80">Resolve vulnerabilities</div>
            </div>
            {scoreData &&
              scoreData.vulnerable_clauses.length - resolvedClauses.size >
                0 && (
                <div
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold animate-pulse"
                  style={{ background: "rgb(180, 60, 40)", color: "white" }}
                >
                  {scoreData.vulnerable_clauses.length - resolvedClauses.size}
                </div>
              )}
          </button>

          {/* Chat Modal */}
          {chatOpen && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center px-4"
              style={{ background: "rgba(20, 30, 20, 0.85)" }}
              onClick={() => setChatOpen(false)}
            >
              <div
                className="w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                style={{ background: "rgb(237, 243, 189)" }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Chat Header */}
                <div
                  className="flex items-center justify-between px-6 py-4"
                  style={{
                    background:
                      "linear-gradient(135deg, rgb(56, 58, 45) 0%, rgb(36, 44, 32) 100%)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: "rgb(20, 54, 17)" }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgb(237, 243, 189)"
                        strokeWidth="2"
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div>
                      <div
                        className="font-bold text-lg"
                        style={{
                          color: "rgb(237, 243, 189)",
                          fontFamily: "Playfair Display, serif",
                        }}
                      >
                        AI Vulnerability Resolver
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: "rgb(180, 180, 140)" }}
                      >
                        Chat to resolve clauses, get suggestions, generate
                        emails
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setChatOpen(false)}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="rgb(237, 243, 189)"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Chat Content */}
                <div className="flex flex-1 overflow-hidden">
                  {/* Messages Area */}
                  <div className="flex-1 flex flex-col">
                    <div
                      className="flex-1 overflow-y-auto p-4 space-y-4"
                      style={{ background: "rgb(250, 245, 235)" }}
                    >
                      {chatMessages.length === 0 ? (
                        <div
                          className="h-full flex flex-col items-center justify-center text-center"
                          style={{ color: "rgb(85, 81, 46)" }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            className="mb-4 opacity-50"
                          >
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          <div className="font-semibold mb-2">
                            Start a conversation
                          </div>
                          <div className="text-sm opacity-70 max-w-xs">
                            Ask about vulnerabilities, request rectified
                            clauses, or generate investor communications
                          </div>
                        </div>
                      ) : (
                        chatMessages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                                msg.role === "user"
                                  ? "text-white"
                                  : "text-green-950"
                              }`}
                              style={{
                                background:
                                  msg.role === "user"
                                    ? "rgb(20, 54, 17)"
                                    : "white",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                              }}
                            >
                              <div className="text-xs font-semibold mb-1 opacity-70">
                                {msg.role === "user" ? "You" : "AI Assistant"}
                              </div>
                              {msg.role === "assistant" ? (
                                <div className="text-sm">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      p: ({ children }) => (
                                        <p className="mb-2 last:mb-0">{children}</p>
                                      ),
                                      ul: ({ children }) => (
                                        <ul className="list-disc pl-5 mb-2 last:mb-0">
                                          {children}
                                        </ul>
                                      ),
                                      ol: ({ children }) => (
                                        <ol className="list-decimal pl-5 mb-2 last:mb-0">
                                          {children}
                                        </ol>
                                      ),
                                      li: ({ children }) => <li>{children}</li>,
                                      code: ({ children }) => (
                                        <code className="px-1 py-0.5 rounded bg-black/10">
                                          {children}
                                        </code>
                                      ),
                                    }}
                                  >
                                    {msg.text}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <div className="text-sm whitespace-pre-wrap">
                                  {msg.text}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                      {chatLoading && (
                        <div className="flex justify-start">
                          <div
                            className="rounded-2xl px-4 py-3 bg-white text-green-950 shadow"
                            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
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
                      style={{
                        background: "rgb(237, 243, 189)",
                        borderColor: "rgb(200, 190, 160)",
                      }}
                    >
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask about vulnerabilities, request fixes..."
                          className="flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                          style={{
                            background: "white",
                            borderColor: "rgb(200, 190, 160)",
                            focusRingColor: "rgb(20, 54, 17)",
                          }}
                          disabled={chatLoading}
                        />
                        <button
                          type="submit"
                          disabled={!chatInput.trim() || chatLoading}
                          className="px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105"
                          style={{
                            background:
                              chatInput.trim() && !chatLoading
                                ? "rgb(20, 54, 17)"
                                : "rgb(120, 120, 120)",
                            color: "white",
                          }}
                        >
                          Send
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Chat Actions Sidebar */}
                  <div
                    className="w-72 p-4 border-l flex flex-col"
                    style={{
                      background: "rgb(230, 220, 190)",
                      borderColor: "rgb(200, 190, 160)",
                    }}
                  >
                    <div
                      className={`${sairaExtraCondensed.className} flex-1 overflow-hidden flex flex-col`}
                    >
                      {/* Clause Navigation */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <div
                            className="font-bold text-lg"
                            style={{ color: "rgb(26, 28, 18)" }}
                          >
                            VULNERABILITIES
                          </div>
                          <div
                            className="text-xs font-semibold px-2 py-1 rounded"
                            style={{
                              background: "rgb(20, 54, 17)",
                              color: "white",
                            }}
                          >
                            {getUnresolvedClauses().length} remaining
                          </div>
                        </div>

                        {/* Navigation */}
                        {getUnresolvedClauses().length > 0 && (
                          <div className="flex items-center justify-between mb-3">
                            <button
                              onClick={goToPrevClause}
                              disabled={chatClauseIndex === 0}
                              className="px-3 py-1 rounded text-sm font-semibold disabled:opacity-30"
                              style={{
                                background: "rgb(85, 81, 46)",
                                color: "white",
                              }}
                            >
                              ← Prev
                            </button>
                            <span
                              className="text-sm"
                              style={{ color: "rgb(85, 81, 46)" }}
                            >
                              {chatClauseIndex + 1} /{" "}
                              {getUnresolvedClauses().length}
                            </span>
                            <button
                              onClick={goToNextClause}
                              disabled={
                                chatClauseIndex >=
                                getUnresolvedClauses().length - 1
                              }
                              className="px-3 py-1 rounded text-sm font-semibold disabled:opacity-30"
                              style={{
                                background: "rgb(85, 81, 46)",
                                color: "white",
                              }}
                            >
                              Next →
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Current Clause Detail */}
                      <div className="mb-4">
                        {currentChatClause ? (
                          <div
                            className="p-3 rounded-lg"
                            style={{
                              background: "rgb(255, 250, 245)",
                              borderLeft: `4px solid ${getVulnerabilityColor(currentChatClause.vulnerability_score)}`,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span
                                className="text-xs font-semibold uppercase"
                                style={{ color: "rgb(85, 81, 46)" }}
                              >
                                Current Clause
                              </span>
                              <span
                                className="font-bold text-xs px-2 py-0.5 rounded"
                                style={{
                                  background: getVulnerabilityColor(
                                    currentChatClause.vulnerability_score,
                                  ),
                                  color: "white",
                                }}
                              >
                                Score {currentChatClause.vulnerability_score}
                              </span>
                            </div>
                            <p
                              className="text-sm font-medium leading-relaxed line-clamp-5"
                              style={{ color: "rgb(20, 20, 15)" }}
                            >
                              {currentChatClause.clause_text}
                            </p>
                          </div>
                        ) : (
                          <div
                            className="text-center py-4 rounded-lg"
                            style={{
                              background: "rgb(255, 250, 245)",
                              color: "rgb(20, 100, 40)",
                            }}
                          >
                            <div className="font-bold">All clauses resolved</div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div
                        className="space-y-2 pt-3 border-t"
                        style={{ borderColor: "rgb(180, 170, 140)" }}
                      >
                        <button
                          onClick={handleResolveClause}
                          disabled={
                            !currentChatClause || resolvingClauseIdx !== null
                          }
                          className="w-full p-3 rounded-lg text-center transition-all hover:scale-[1.02] disabled:opacity-50"
                          style={{
                            background: "rgb(20, 100, 40)",
                            color: "white",
                          }}
                        >
                          <div className="font-bold text-sm">
                            Resolve This Clause
                          </div>
                          <div className="text-xs opacity-80">
                            Move to next automatically
                          </div>
                        </button>

                        <button
                          onClick={handleGetRectifiedClause}
                          disabled={!currentChatClause || chatLoading}
                          className="w-full p-3 rounded-lg text-center transition-all hover:scale-[1.02] disabled:opacity-50"
                          style={{
                            background: "rgb(40, 80, 140)",
                            color: "white",
                          }}
                        >
                          <div className="font-bold text-sm">
                            Get Fixed Clause
                          </div>
                          <div className="text-xs opacity-80">
                            AI-generated replacement
                          </div>
                        </button>

                        <button
                          onClick={handleGenerateEmail}
                          disabled={chatLoading}
                          className="w-full p-3 rounded-lg text-center transition-all hover:scale-[1.02] disabled:opacity-50"
                          style={{
                            background: "rgb(140, 100, 40)",
                            color: "white",
                          }}
                        >
                          <div className="font-bold text-sm">
                            Generate Email
                          </div>
                          <div className="text-xs opacity-80">
                            Investor communication
                          </div>
                        </button>
                      </div>

                      {/* Status */}
                      <div
                        className="mt-4 pt-3 border-t text-xs"
                        style={{
                          borderColor: "rgb(180, 170, 140)",
                          color: "rgb(85, 81, 46)",
                        }}
                      >
                        Status:{" "}
                        <span className="font-semibold">{chatStatus}</span>
                      </div>
                    </div>
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
                className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden"
                style={{ background: "rgb(237, 243, 189)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="px-6 py-4"
                  style={{
                    background:
                      "linear-gradient(135deg, rgb(56, 58, 45) 0%, rgb(36, 44, 32) 100%)",
                  }}
                >
                  <h3
                    className="font-bold text-lg"
                    style={{
                      color: "rgb(237, 243, 189)",
                      fontFamily: "Playfair Display, serif",
                    }}
                  >
                    Investor Email Draft
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
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={() => setEmailModalOpen(false)}
                      className="px-5 py-2 rounded-lg font-semibold"
                      style={{
                        border: "2px solid rgb(85, 81, 46)",
                        color: "rgb(85, 81, 46)",
                      }}
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        setEmailModalOpen(false);
                        setChatOpen(false);
                        setChatMessages((prev) => [
                          ...prev,
                          {
                            role: "assistant",
                            text: "Email draft sent to investor.",
                          },
                        ]);
                      }}
                      className="px-5 py-2 rounded-lg font-semibold"
                      style={{ background: "rgb(20, 54, 17)", color: "white" }}
                    >
                      Accept and Send
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
          `}</style>
        </div>
      </div>
    </div>
  );
}
