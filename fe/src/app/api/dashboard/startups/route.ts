import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { DashboardData } from "@/lib/dashboardData";

const dataFilePath = path.join(process.cwd(), "src", "data", "dashboardData.json");

const randomInRange = (min: number, max: number) =>
  Math.random() * (max - min) + min;

const createStartupId = (startups: DashboardData["startups"]) => {
  const maxId = startups.reduce((currentMax, startup) => {
    const match = startup.startup_id.match(/^st_(\d+)$/);
    if (!match) return currentMax;
    return Math.max(currentMax, Number(match[1]));
  }, 0);

  return `st_${String(maxId + 1).padStart(3, "0")}`;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      sector?: string;
      location?: string;
    };

    const name = body.name?.trim() ?? "";
    const sector = body.sector?.trim() ?? "";
    const location = body.location?.trim() ?? "";

    if (!name || !sector || !location) {
      return NextResponse.json(
        { error: "name, sector, and location are required" },
        { status: 400 },
      );
    }

    const existingJson = await fs.readFile(dataFilePath, "utf-8");
    const data = JSON.parse(existingJson) as DashboardData;

    const newStartup: DashboardData["startups"][number] & { location: string } = {
      startup_id: createStartupId(data.startups),
      name,
      sector,
      location,
      climate_trust: 0,
      greenwash_risk: 0,
      net_zero_cred: 0,
      confidence: 0,
      status: "N/A",
      geo: {
        city: "San Francisco",
        lat: Number(randomInRange(37.708, 37.812).toFixed(6)),
        lng: Number(randomInRange(-122.515, -122.355).toFixed(6)),
      },
    };

    const updatedData = {
      ...data,
      updated_at: new Date().toISOString(),
      startups: [...data.startups, newStartup],
    };

    await fs.writeFile(dataFilePath, `${JSON.stringify(updatedData, null, 2)}\n`, "utf-8");

    return NextResponse.json({ startup: newStartup }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to add startup" },
      { status: 500 },
    );
  }
}
