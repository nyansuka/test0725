import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { races as bundledRaces, samplePrevWeek } from "@/data/races";
import type { Race } from "@/domain/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SnapshotFile = {
  fetchedAt: string;
  source: string;
  raceDate: string;
  raceCount: number;
  venues: string[];
  races: Race[];
};

async function readLatest(): Promise<SnapshotFile | null> {
  const p = path.join(process.cwd(), "src", "data", "snapshots", "latest.json");
  try {
    return JSON.parse(await readFile(p, "utf8")) as SnapshotFile;
  } catch {
    return null;
  }
}

export async function GET() {
  const snap = await readLatest();
  const live = (snap?.races ?? []).map((r) => ({
    ...r,
    authority: "JRA" as const,
  }));
  // 日付切替デモ用の合成日はバンドル側から併用
  const demo = bundledRaces.filter((r) => r.raceDate === samplePrevWeek);
  const merged = [...live, ...demo];
  return NextResponse.json({
    fetchedAt: snap?.fetchedAt ?? null,
    source: snap?.source ?? null,
    raceDate: snap?.raceDate ?? null,
    races: merged,
  });
}
