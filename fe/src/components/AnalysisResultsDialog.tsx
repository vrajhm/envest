"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Montserrat } from "next/font/google";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600"],
});

interface FlaggedItem {
  category: string;
  text: string;
  confidence: number;
  context?: string;
}

interface AnalysisResult {
  id: string;
  transcript: string;
  flagged_items: FlaggedItem[];
  search_findings: Record<string, unknown>;
  risk_score: number;
  recommended_questions: string[];
  company_name: string;
  created_at: string;
}

interface AnalysisResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: AnalysisResult | null;
}

export function AnalysisResultsDialog({
  open,
  onOpenChange,
  result,
}: AnalysisResultsDialogProps) {
  if (!result) return null;

  const getRiskColor = (score: number) => {
    if (score >= 0.7) return "rgb(185, 28, 28)";
    if (score >= 0.4) return "rgb(180, 83, 9)";
    return "rgb(22, 101, 52)";
  };

  const getCategoryColor = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes("greenwash")) return "bg-red-100 text-red-800";
    if (cat.includes("vague")) return "bg-yellow-100 text-yellow-800";
    if (cat.includes("buzzword")) return "bg-purple-100 text-purple-800";
    if (cat.includes("weak")) return "bg-orange-100 text-orange-800";
    if (cat.includes("scope")) return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
        style={{
          background: "rgb(237, 243, 189)",
          border: "none",
        }}
      >
        <DialogHeader>
          <DialogTitle
            className={`${montserrat.className} text-2xl font-semibold`}
            style={{ color: "rgb(26, 28, 18)" }}
          >
            Analysis Results: {result.company_name}
          </DialogTitle>
          <DialogDescription
            className={montserrat.className}
            style={{ color: "rgb(85, 81, 46)" }}
          >
            Submitted on {new Date(result.created_at).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          {/* Risk Score */}
          <div
            className="p-4 rounded-lg"
            style={{ background: "rgba(255,255,255,0.5)" }}
          >
            <div className={`${montserrat.className} text-sm font-semibold mb-2`}
              style={{ color: "rgb(85, 81, 46)" }}
            >
              RISK SCORE
            </div>
            <div
              className="text-4xl font-bold"
              style={{ color: getRiskColor(result.risk_score) }}
            >
              {(result.risk_score * 100).toFixed(0)}%
            </div>
          </div>

          {/* Flagged Items */}
          {result.flagged_items.length > 0 && (
            <div>
              <div className={`${montserrat.className} text-sm font-semibold mb-3`}
                style={{ color: "rgb(85, 81, 46)" }}
              >
                FLAGGED ITEMS ({result.flagged_items.length})
              </div>
              <div className="space-y-3">
                {result.flagged_items.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg border"
                    style={{
                      background: "rgba(255,255,255,0.5)",
                      borderColor: "rgb(85, 81, 46)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(item.category)}`}
                      >
                        {item.category}
                      </span>
                      <span
                        className={`${montserrat.className} text-sm font-medium`}
                        style={{ color: "rgb(26, 28, 18)" }}
                      >
                        {(item.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <p
                      className={`${montserrat.className} text-sm`}
                      style={{ color: "rgb(26, 28, 18)" }}
                    >
                      &ldquo;{item.text}&rdquo;
                    </p>
                    {item.context && (
                      <p
                        className={`${montserrat.className} text-xs mt-2`}
                        style={{ color: "rgb(85, 81, 46)" }}
                      >
                        {item.context}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Questions */}
          {result.recommended_questions.length > 0 && (
            <div>
              <div className={`${montserrat.className} text-sm font-semibold mb-3`}
                style={{ color: "rgb(85, 81, 46)" }}
              >
                RECOMMENDED FOLLOW-UP QUESTIONS
              </div>
              <ul className="space-y-2">
                {result.recommended_questions.map((question, index) => (
                  <li
                    key={index}
                    className={`${montserrat.className} text-sm flex items-start gap-2`}
                    style={{ color: "rgb(26, 28, 18)" }}
                  >
                    <span style={{ color: "rgb(85, 81, 46)" }}>→</span>
                    {question}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcript Preview */}
          <div>
            <div className={`${montserrat.className} text-sm font-semibold mb-2`}
              style={{ color: "rgb(85, 81, 46)" }}
            >
              TRANSCRIPT PREVIEW
            </div>
            <p
              className={`${montserrat.className} text-xs`}
              style={{ color: "rgb(85, 81, 46)" }}
            >
              {result.transcript.length > 500
                ? result.transcript.substring(0, 500) + "..."
                : result.transcript}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
