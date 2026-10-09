import { loadRaceCatalog } from "@/data/loadCatalog";
import { parseDistanceMeters } from "@/domain/courseNotes.mjs";
import { simFieldFromRuns } from "@/domain/sim/nakayamaTurf1200Field";
import type { StyleRun } from "@/domain/sim/runningStyle";
import { flatSimId } from "@/domain/sim/flatSimCatalog";
import { loadHorseRuns } from "../../../../../scripts/lib/horse-form.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function readRuns(horseId: string): Promise<StyleRun[]> {
  if (!/^\d+$/.test(horseId)) return [];
  try {
    const cached = await loadHorseRuns(horseId, { sleepMs: 0 });
    const runs = cached?.runs;
    return Array.isArray(runs) ? (runs as StyleRun[]) : [];
  } catch (error) {
    console.error("[sim field]", horseId, error);
    return [];
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const catalog = await loadRaceCatalog();
  const race = catalog.races.find((item) => item.id === id);
  const courseId = race ? flatSimId(race) : null;
  if (!race || !courseId) {
    return Response.json({ error: "このレースの走行はありません" }, { status: 404 });
  }

  const runsByNumber = new Map<number, StyleRun[]>();
  const queue = [...race.horses];
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length) {
      const horse = queue.shift();
      if (!horse) return;
      const runs = horse.horseId ? await readRuns(horse.horseId) : [];
      runsByNumber.set(horse.number, runs);
    }
  });
  await Promise.all(workers);

  const field = simFieldFromRuns(
    race.horses.map((horse) => ({
      number: horse.number,
      bracket: horse.bracket,
      name: horse.name,
    })),
    runsByNumber,
    race.raceDate,
    { venue: race.venue, distanceM: parseDistanceMeters(race.distance), track: race.track === "ダート" ? "ダート" : "芝" },
  );

  return Response.json({
    id: race.id,
    courseId,
    title: race.title,
    raceDate: race.raceDate,
    raceNumber: race.raceNumber,
    startTime: race.startTime,
    horses: field.horses,
    withoutPass: field.withoutPass,
  });
}
