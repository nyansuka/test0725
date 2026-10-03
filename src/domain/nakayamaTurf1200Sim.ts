import { normalizeVenue, parseDistanceMeters } from "@/domain/courseNotes.mjs";

/** この日以降の中山芝1200だけ、レース詳細に走行を出す */
export const NAKAYAMA_TURF_1200_SIM_FROM = "2026-09-01";

export function isNakayamaTurf1200SimRace(race: {
  venue: string;
  track: string;
  distance: string;
  raceDate: string;
}) {
  if (race.raceDate < NAKAYAMA_TURF_1200_SIM_FROM) return false;
  if (normalizeVenue(race.venue) !== "中山") return false;
  if (race.track !== "芝") return false;
  return parseDistanceMeters(race.distance) === 1200;
}
