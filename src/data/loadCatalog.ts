import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { RaceCatalogPayload } from "@/data/catalogTypes";
import {
  races as bundledRaces,
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

const SNAPSHOT_FILE = /^\d{4}-\d{2}-\d{2}\.json$/;

function threeMonthsBefore(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() - 3);
  return date.toISOString().slice(0, 10);
}

/** ディスク上の最新スナップショットと直近3か月分の開催日を読む。 */
export async function loadRaceCatalog(): Promise<RaceCatalogPayload> {
  const dir = path.join(process.cwd(), "src", "data", "snapshots");
  try {
    const latest = JSON.parse(await readFile(path.join(dir, "latest.json"), "utf8")) as SnapshotFile;
    const cutoff = threeMonthsBefore(latest.raceDate);
    const files = (await readdir(dir))
      .filter((name) => SNAPSHOT_FILE.test(name))
      .filter((name) => name.slice(0, 10) >= cutoff && name.slice(0, 10) <= latest.raceDate);
    const snapshots = await Promise.all(
      files.map(async (name) => JSON.parse(await readFile(path.join(dir, name), "utf8")) as SnapshotFile),
    );
    const races = snapshots
      .flatMap((snap) => snap.races ?? [])
      .map((race) => ({ ...race, authority: "JRA" as const }))
      .sort(
        (a, b) =>
          b.raceDate.localeCompare(a.raceDate) ||
          a.venue.localeCompare(b.venue, "ja") ||
          a.raceNumber - b.raceNumber,
      );
    return {
      fetchedAt: latest.fetchedAt ?? null,
      source: latest.source ?? null,
      raceDate: latest.raceDate ?? null,
      races,
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
