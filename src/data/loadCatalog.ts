import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RaceCatalogPayload } from "@/data/catalogTypes";
import {
  races as bundledRaces,
  samplePrevWeek,
  snapshotMeta as seedMeta,
} from "@/data/races";
import type { Race } from "@/domain/types";

export type { RaceCatalogPayload };

type SnapshotFile = {
  fetchedAt: string;
  source: string;
  raceDate: string;
  raceCount: number;
  venues: string[];
  races: Race[];
};

/**
 * ディスク上の latest.json を読み、デモ用合成日とマージする。
 * 静的 import のキャッシュずれを避けるため、SSR / API はここを使う。
 */
export async function loadRaceCatalog(): Promise<RaceCatalogPayload> {
  const p = path.join(process.cwd(), "src", "data", "snapshots", "latest.json");
  try {
    const snap = JSON.parse(await readFile(p, "utf8")) as SnapshotFile;
    const live = (snap.races ?? []).map((r) => ({
      ...r,
      authority: "JRA" as const,
    }));
    const demo = bundledRaces.filter((r) => r.raceDate === samplePrevWeek);
    return {
      fetchedAt: snap.fetchedAt ?? null,
      source: snap.source ?? null,
      raceDate: snap.raceDate ?? null,
      races: [...live, ...demo],
    };
  } catch {
    return {
      fetchedAt: seedMeta.fetchedAt,
      source: seedMeta.source,
      raceDate: seedMeta.raceDate,
      races: bundledRaces,
    };
  }
}
