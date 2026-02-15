import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      transcript,
      flagged_items,
      search_findings,
      risk_score,
      recommended_questions,
      company_name,
    } = body;

    if (!transcript || !company_name) {
      return NextResponse.json(
        { error: "transcript and company_name are required" },
        { status: 400 }
      );
    }

    const analysisResult = {
      id: `analysis_${Date.now()}`,
      transcript,
      flagged_items: flagged_items || [],
      search_findings: search_findings || {},
      risk_score: risk_score || 0,
      recommended_questions: recommended_questions || [],
      company_name,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({ result: analysisResult }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to submit analysis" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
