"use client";

import { FormEvent, useMemo, useState } from "react";

type Role = "user" | "assistant";
type ClauseStatus = "open" | "in_progress" | "resolved";

type ChatMessage = {
  role: Role;
  text: string;
};

type SimilarBadExample = {
  example_clause: string;
  source: string;
};

type Clause = {
  clause_id: string;
  clause_text: string;
  vulnerability_score: number;
  status: ClauseStatus;
  notes?: string | null;
  similar_bad_examples: SimilarBadExample[];
  accepted_change_instructions: string;
};

type ContextRecord = {
  overall_trust_score: number;
  syntax_notes: string;
  vulnerable_clauses: Clause[];
};

type ChatUpdate = {
  clause_id: string;
  previous_status: ClauseStatus;
  new_status: ClauseStatus;
  reason: string;
};

const DEFAULT_CONTEXT = {
  overall_trust_score: 48,
  per_goal_scores: [
    {
      goal: "Carbon Reduction",
      score: 50,
      notes: "Net-zero target is weakened by vague scope-3 commitments.",
    },
  ],
  syntax_notes:
    "The report uses aspirational language and non-committal phrasing that weakens accountability.",
  vulnerable_clauses: [
    {
      clause_text: "Scope 3: Under evaluation",
      vulnerability_score: 90,
      notes: "Major omission with no concrete timeline.",
      similar_bad_examples: [],
    },
  ],
};

const API_BASE = process.env.NEXT_PUBLIC_RAG_API_BASE || "http://127.0.0.1:8000";

function statusClasses(status: ClauseStatus): string {
  if (status === "resolved") return "border-emerald-400 bg-emerald-50";
  if (status === "in_progress") return "border-amber-400 bg-amber-50";
  return "border-rose-400 bg-rose-50";
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [contextJson, setContextJson] = useState(JSON.stringify(DEFAULT_CONTEXT, null, 2));
  const [context, setContext] = useState<ContextRecord | null>(null);
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [loaderOpen, setLoaderOpen] = useState(true);

  const canSend = useMemo(() => contextLoaded && text.trim().length > 0 && !loading, [contextLoaded, text, loading]);

  const selectedClause = useMemo(() => {
    if (!context || !selectedClauseId) return null;
    return context.vulnerable_clauses.find((c) => c.clause_id === selectedClauseId) || null;
  }, [context, selectedClauseId]);

  async function refreshContext() {
    const res = await fetch(`${API_BASE}/v1/context`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.detail || `Context fetch failed (${res.status})`);
    }

    const next: ContextRecord = {
      overall_trust_score: data.overall_trust_score,
      syntax_notes: data.syntax_notes,
      vulnerable_clauses: data.vulnerable_clauses || [],
    };
    setContext(next);

    if (!selectedClauseId || !next.vulnerable_clauses.some((c) => c.clause_id === selectedClauseId)) {
      const firstUnresolved = next.vulnerable_clauses.find((c) => c.status !== "resolved");
      setSelectedClauseId(firstUnresolved?.clause_id || next.vulnerable_clauses[0]?.clause_id || null);
    }
  }

  function applyUpdatesLocally(updates: ChatUpdate[]) {
    if (!updates.length) return;
    setContext((prev) => {
      if (!prev) return prev;
      const nextClauses = prev.vulnerable_clauses.map((clause) => {
        const found = updates.find((u) => u.clause_id === clause.clause_id);
        if (!found) return clause;
        return { ...clause, status: found.new_status };
      });
      return { ...prev, vulnerable_clauses: nextClauses };
    });
  }

  async function loadContext() {
    setLoading(true);
    setStatus("Loading context...");
    try {
      const parsed = JSON.parse(contextJson);
      const res = await fetch(`${API_BASE}/v1/context/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Context load failed (${res.status})`);
      }
      await refreshContext();
      setContextLoaded(true);
      setStatus("Context loaded.");
      setLoaderOpen(false);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load context.");
    } finally {
      setLoading(false);
    }
  }

  async function sendRawMessage(message: string, clauseIdOverride?: string | null, silentUser = false) {
    const useClause = clauseIdOverride || selectedClauseId || "clause_001";

    if (!silentUser) {
      setMessages((prev) => [...prev, { role: "user", text: message }]);
    }

    const res = await fetch(`${API_BASE}/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: "web_chat",
        clause_id: useClause,
        message,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.detail || `Chat failed (${res.status})`);
    }

    applyUpdatesLocally((data.inferred_updates || []) as ChatUpdate[]);
    setMessages((prev) => [...prev, { role: "assistant", text: data.answer || "No response" }]);
    await refreshContext();
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;

    const userText = text.trim();
    setText("");
    setLoading(true);
    setStatus("Assistant is responding...");

    try {
      await sendRawMessage(userText);
      setStatus("Ready");
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: err instanceof Error ? `Error: ${err.message}` : "Error sending message.",
        },
      ]);
      setStatus("Chat error");
    } finally {
      setLoading(false);
    }
  }

  async function resolveClause(clauseId: string) {
    setLoading(true);
    setStatus(`Resolving ${clauseId}...`);

    // Optimistic UI update
    setContext((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        vulnerable_clauses: prev.vulnerable_clauses.map((clause) =>
          clause.clause_id === clauseId ? { ...clause, status: "resolved" } : clause,
        ),
      };
    });

    try {
      await sendRawMessage("Mark this resolved.", clauseId, true);
      setStatus(`Resolved ${clauseId}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Resolve failed.");
      await refreshContext();
    } finally {
      setLoading(false);
    }
  }

  async function generateArtifacts() {
    setLoading(true);
    setStatus("Generating artifacts...");
    try {
      const res = await fetch(`${API_BASE}/v1/cleanup/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true, investor_note: "Approved from web chat." }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || `Cleanup failed (${res.status})`);
      }
      setStatus("Artifacts generated.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Artifacts generated:\n- ${data.artifact_paths?.revised_text_path}\n- ${data.artifact_paths?.revised_pdf_path}\n- ${data.artifact_paths?.investor_email_path}`,
        },
      ]);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Artifact generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full px-4 py-8" style={{ background: "rgb(217, 205, 183)" }}>
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <section className="bg-white/90 rounded-xl border border-green-900/10 shadow p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-green-950">RAG Chat</h1>
            <span className="text-sm text-green-800">{status}</span>
          </div>

          <div className="h-[500px] overflow-y-auto rounded-lg border border-green-900/10 p-3 bg-[#f7f3ea]">
            {messages.length === 0 ? (
              <p className="text-sm text-green-900/70">Load context, select a clause on the right, then start chatting.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, idx) => (
                  <div
                    key={`${msg.role}-${idx}`}
                    className={`rounded-lg px-3 py-2 whitespace-pre-wrap text-sm ${
                      msg.role === "user" ? "bg-green-100 ml-8" : "bg-white mr-8"
                    }`}
                  >
                    <strong className="block mb-1 text-xs uppercase tracking-wide text-green-900/80">{msg.role}</strong>
                    {msg.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={sendMessage} className="mt-4 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={contextLoaded ? "Ask about the selected vulnerable clause..." : "Load context first"}
              className="flex-1 rounded-lg border border-green-900/20 px-3 py-2 bg-white"
              disabled={!contextLoaded || loading}
            />
            <button
              type="submit"
              disabled={!canSend}
              className="rounded-lg px-4 py-2 bg-green-900 text-white disabled:opacity-50"
            >
              Send
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={generateArtifacts}
              className="rounded-md px-3 py-1.5 text-sm bg-emerald-800 text-white"
              disabled={!contextLoaded || loading}
            >
              Generate Artifacts
            </button>
            {selectedClause && (
              <span className="text-xs text-green-900/80 self-center">
                Selected: {selectedClause.clause_id} (score {selectedClause.vulnerability_score})
              </span>
            )}
          </div>
        </section>

        <aside className="bg-white/90 rounded-xl border border-green-900/10 shadow p-4 md:p-5">
          <h2 className="text-lg font-semibold text-green-950 mb-2">Vulnerable Clauses</h2>
          {!contextLoaded || !context ? (
            <p className="text-sm text-green-900/70">Load context to view clauses.</p>
          ) : (
            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
              {context.vulnerable_clauses.map((clause) => {
                const active = selectedClauseId === clause.clause_id;
                return (
                  <div
                    key={clause.clause_id}
                    className={`rounded-lg border p-3 cursor-pointer ${statusClasses(clause.status)} ${active ? "ring-2 ring-green-900/40" : ""}`}
                    onClick={() => setSelectedClauseId(clause.clause_id)}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-green-950">{clause.clause_id}</span>
                      <span className="text-xs text-green-950">{clause.status}</span>
                    </div>
                    <p className="text-sm text-green-950 line-clamp-4">{clause.clause_text}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-green-900/80">Vulnerability: {clause.vulnerability_score}</span>
                      <button
                        className="rounded-md bg-green-900 px-2 py-1 text-xs text-white disabled:opacity-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          void resolveClause(clause.clause_id);
                        }}
                        disabled={loading || clause.status === "resolved"}
                      >
                        {clause.status === "resolved" ? "Resolved" : "Resolve"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      <div className="fixed top-4 right-4 z-50">
        <div className="rounded-xl border border-green-900/20 bg-white/95 shadow-lg w-[320px]">
          <button
            className="w-full px-3 py-2 text-left text-sm font-semibold text-green-950 border-b border-green-900/10"
            onClick={() => setLoaderOpen((v) => !v)}
          >
            {loaderOpen ? "Hide" : "Show"} Context Loader
          </button>
          {loaderOpen && (
            <div className="p-3">
              <p className="text-xs text-green-900/70 mb-2">Paste `/score` JSON and load active context.</p>
              <textarea
                value={contextJson}
                onChange={(e) => setContextJson(e.target.value)}
                className="w-full h-[170px] rounded-lg border border-green-900/20 p-2 text-[11px] font-mono bg-[#f7f3ea]"
              />
              <button
                onClick={loadContext}
                disabled={loading}
                className="mt-2 w-full rounded-lg px-3 py-2 bg-green-950 text-white text-sm disabled:opacity-50"
              >
                Load Active Context
              </button>
              <p className="mt-2 text-[11px] text-green-900/70">API: {API_BASE}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
