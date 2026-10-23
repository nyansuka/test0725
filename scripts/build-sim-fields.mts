/**
 * レース詳細の走行は、リクエスト中に netkeiba を取りに行かない。
 * 手元の馬成績キャッシュから、日付ごとの並びを src/data/sim-fields に書く。
 *   npx tsx scripts/build-sim-fields.mts
 *   npx tsx scripts/build-sim-fields.mts 2026-10-18
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDistanceMeters } from "../src/domain/courseNotes.mjs";
import { flatSimId } from "../src/domain/sim/flatSimCatalog.ts";
import { simFieldFromRuns } from "../src/domain/sim/nakayamaTurf1200Field.ts";
import type { StyleRun } from "../src/domain/sim/runningStyle.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapDir = path.join(root, "src", "data", "snapshots");
const outDir = path.join(root, "src", "data", "sim-fields");
const cacheDir = path.join(root, "src", "data", "cache", "horse-form");

async function cachedRuns(horseId: string): Promise<StyleRun[]> {
  try {
    const cached = JSON.parse(await readFile(path.join(cacheDir, `${horseId}.json`), "utf8")) as {
      runs?: StyleRun[];
    };
    return Array.isArray(cached.runs) ? cached.runs : [];
  } catch {
    return [];
  }
}

const only = process.argv[2];
const names = (await readdir(snapDir))
  .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name) && name.slice(0, 10) >= "2026-09-01")
  .map((name) => name.slice(0, 10))
  .filter((date) => !only || date === only)
  .sort();

if (!names.length) {
  console.error(only ? `no snapshot ${only}` : "no snapshots");
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

for (const date of names) {
  const snap = JSON.parse(await readFile(path.join(snapDir, `${date}.json`), "utf8")) as {
    races?: Array<{
      id: string;
      title: string;
      raceDate: string;
      raceNumber: number;
      startTime: string;
      venue: string;
      track: string;
      distance: string;
      courseRail?: "内" | "外";
      horses?: Array<{ number: number; bracket?: number; name: string; horseId?: string }>;
    }>;
  };
  const races: Record<string, unknown> = {};
  let withPass = 0;
  for (const race of snap.races ?? []) {
    const courseId = flatSimId(race);
    if (!courseId) continue;
    const runsByNumber = new Map<number, StyleRun[]>();
    for (const horse of race.horses ?? []) {
      runsByNumber.set(horse.number, horse.horseId ? await cachedRuns(horse.horseId) : []);
    }
    const field = simFieldFromRuns(
      (race.horses ?? []).map((horse) => ({
        number: horse.number,
        bracket: horse.bracket,
        name: horse.name,
      })),
      runsByNumber,
      race.raceDate,
      {
        venue: race.venue,
        distanceM: parseDistanceMeters(race.distance),
        track: race.track === "ダート" ? "ダート" : "芝",
      },
    );
    const horses = field.horses.map(({ turfPasses: _passes, ...horse }) => horse);
    if (field.withoutPass.length < horses.length) withPass += 1;
    races[race.id] = {
      id: race.id,
      courseId,
      title: race.title,
      raceDate: race.raceDate,
      raceNumber: race.raceNumber,
      startTime: race.startTime,
      horses,
      withoutPass: field.withoutPass,
    };
  }
  await writeFile(path.join(outDir, `${date}.json`), JSON.stringify({ raceDate: date, races }));
  console.log(`${date} courses=${Object.keys(races).length} withPass=${withPass}`);
}
