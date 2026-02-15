import { NextResponse } from "next/server";

const DEFAULT_BASE = "http://127.0.0.1:8001";

export async function GET() {
  const base = (process.env.MAPPING_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_BASE)
    .trim()
    .replace(/\/+$/, "");

  const upstreamUrl = `${base}/issues`;

  try {
    const response = await fetch(upstreamUrl, { cache: "no-store" });

    if (!response.ok) {
      return NextResponse.json(
        { error: "upstream_unavailable", status: response.status, upstreamUrl },
        { status: response.status },
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "upstream_fetch_failed", upstreamUrl },
      { status: 502 },
    );
  }
}
