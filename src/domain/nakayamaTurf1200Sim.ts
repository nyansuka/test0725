import { normalizeVenue, parseDistanceMeters } from "@/domain/courseNotes.mjs";

/** この日以降だけ、対応している芝の走行をレース詳細に出す */
export const TURF_SIM_FROM = "2026-09-01";

/** この日以降の中山芝1200だけ、という以前の境界。今は芝ワンターン全体が同じ日 */
export const NAKAYAMA_TURF_1200_SIM_FROM = TURF_SIM_FROM;

export type TurfOneTurnId =
  | "nakayama-turf-1200"
  | "nakayama-turf-1600"
  | "nakayama-turf-1800"
  | "kyoto-turf-1200"
  | "kyoto-turf-1600"
  | "kyoto-turf-1600-outer"
  | "kyoto-turf-1800"
  | "kyoto-turf-2400"
  | "hanshin-turf-1200"
  | "hanshin-turf-1600"
  | "hanshin-turf-1800"
  | "tokyo-turf-1400"
  | "tokyo-turf-1600"
  | "tokyo-turf-1800"
  | "tokyo-turf-2000"
  | "sapporo-turf-1000"
  | "sapporo-turf-1200"
  | "hakodate-turf-1000"
  | "hakodate-turf-1200"
  | "fukushima-turf-1000"
  | "fukushima-turf-1200"
  | "niigata-turf-1200"
  | "niigata-turf-1600"
  | "niigata-turf-1800"
  | "chukyo-turf-1200"
  | "chukyo-turf-1300"
  | "chukyo-turf-1400"
  | "chukyo-turf-1600"
  | "kokura-turf-1000"
  | "kokura-turf-1200";

/**
 * レース詳細に出す芝。同じ型の距離だけ台本を共有する。
 * 段4はワンターン。段5はポケットと一周超。段6は残り6場の芝ワンターン。
 * 段7は阪神の外回り1600・1800。前が残る。直線が長くても差しが詰める台本にはしない。
 * 段8は長い引き込み。京都芝1800と中京芝1600。140m地点はまだ引き込み。
 * 阪神芝1400、新潟芝1400、京都芝1400・1600・2000は、内と外が距離だけでは分かれない。
 * 京都のその3距離は courseRail があるとき flatSimId が出す。ここには入れない。
 * ダート・障害・1角から入る距離はここには入れない。
 * 走行の絵はローカル見本。ここは、どのレースに欄を出すかだけ。
 */
const ONE_TURN: Record<string, TurfOneTurnId> = {
  "中山:1200": "nakayama-turf-1200",
  "中山:1600": "nakayama-turf-1600",
  "中山:1800": "nakayama-turf-1800",
  "京都:1200": "kyoto-turf-1200",
  "京都:1800": "kyoto-turf-1800",
  "京都:2400": "kyoto-turf-2400",
  "阪神:1200": "hanshin-turf-1200",
  "阪神:1600": "hanshin-turf-1600",
  "阪神:1800": "hanshin-turf-1800",
  "東京:1400": "tokyo-turf-1400",
  "東京:1600": "tokyo-turf-1600",
  "東京:1800": "tokyo-turf-1800",
  "東京:2000": "tokyo-turf-2000",
  "札幌:1000": "sapporo-turf-1000",
  "札幌:1200": "sapporo-turf-1200",
  "函館:1000": "hakodate-turf-1000",
  "函館:1200": "hakodate-turf-1200",
  "福島:1000": "fukushima-turf-1000",
  "福島:1200": "fukushima-turf-1200",
  "新潟:1200": "niigata-turf-1200",
  "新潟:1600": "niigata-turf-1600",
  "新潟:1800": "niigata-turf-1800",
  "中京:1200": "chukyo-turf-1200",
  "中京:1300": "chukyo-turf-1300",
  "中京:1400": "chukyo-turf-1400",
  "中京:1600": "chukyo-turf-1600",
  "小倉:1000": "kokura-turf-1000",
  "小倉:1200": "kokura-turf-1200",
};

export function turfOneTurnId(race: {
  venue: string;
  track: string;
  distance: string;
  raceDate: string;
}): TurfOneTurnId | null {
  if (race.raceDate < TURF_SIM_FROM) return null;
  if (race.track !== "芝") return null;
  if (race.distance.includes("障害")) return null;
  const meters = parseDistanceMeters(race.distance);
  if (meters == null) return null;
  return ONE_TURN[`${normalizeVenue(race.venue)}:${meters}`] ?? null;
}

export function isNakayamaTurf1200SimRace(race: {
  venue: string;
  track: string;
  distance: string;
  raceDate: string;
}) {
  return turfOneTurnId(race) === "nakayama-turf-1200";
}

/** レース詳細に出す芝の走行。未対応の距離は false */
export function isTurfOneTurnSimRace(race: {
  venue: string;
  track: string;
  distance: string;
  raceDate: string;
}) {
  return turfOneTurnId(race) != null;
}
