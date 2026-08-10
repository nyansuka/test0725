import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { Race } from "@/domain/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SnapshotFile = {
  raceDate: string;
  races: Race[];
};

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(p, "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * 成績日記用コーパス（既定）: ライブ snapshot のオッズ＋結果。
 * ローカル専用の loop/snapshots 凍結オッズは使わない（本番と揃える）。
 *
 * 検証で凍結オッズを使うときだけ `?frozen=1`。
 */
export async function GET(request: Request) {
  const preferFrozen = new URL(request.url).searchParams.get("frozen") === "1";
  const root = process.cwd();
  const loopDir = path.join(root, "src", "data", "loop", "snapshots");
  const liveDir = path.join(root, "src", "data", "snapshots");

  const dates = new Set<string>();
  if (preferFrozen && (await exists(loopDir))) {
    for (const name of await readdir(loopDir)) {
      const m = name.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
      if (m) dates.add(m[1]);
    }
  }
  if (await exists(liveDir)) {
    for (const name of await readdir(liveDir)) {
      const m = name.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
      if (m) dates.add(m[1]);
    }
  }

  const races: Race[] = [];
  const usedDates: string[] = [];

  for (const date of [...dates].sort()) {
    const frozen = preferFrozen
      ? await readJson<SnapshotFile>(path.join(loopDir, `${date}.json`))
      : null;
    const live = await readJson<SnapshotFile>(path.join(liveDir, `${date}.json`));
    const resultById = new Map(
      (live?.races ?? [])
        .filter((r) => r.result?.finishes?.length)
        .map((r) => [r.id, r.result]),
    );

    const baseRaces =
      preferFrozen && frozen?.races?.length ? frozen.races : (live?.races ?? []);
    const merged = baseRaces
      .filter((r) => r.authority === "JRA" || !r.authority)
      .map((r) => {
        const result = resultById.get(r.id) ?? r.result;
        return {
          ...r,
          authority: "JRA" as const,
          result,
        };
      })
      .filter((r) => r.result?.finishes?.length);

    if (merged.length === 0) continue;
    usedDates.push(date);
    races.push(...merged);
  }

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    dates: usedDates,
    raceCount: races.length,
    races,
    oddsSource: preferFrozen ? "frozen" : "live",
    note: preferFrozen
      ? "凍結オッズ優先（?frozen=1）。結果があるレースのみ。設定変更時はクライアント側で再集計。"
      : "ライブ snapshot のオッズ＋結果。結果があるレースのみ。設定変更時はクライアント側で再集計。",
  });
}
