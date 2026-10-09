import { normalizeVenue, parseDistanceMeters } from "@/domain/courseNotes.mjs";
import type { StretchKind } from "@/domain/sim/fieldShape";
import { TURF_SIM_FROM, turfOneTurnId } from "@/domain/nakayamaTurf1200Sim";

/**
 * 平地の走行をレース詳細に出す入口。
 * 2026-09-01 以降。障害は出さない。
 * 内と外が同じ距離の芝は、距離以外で回りを決めるまで出さない。
 *
 * 新しい距離の直線は、次のどれかに乗せる。14本の台本は詰め幅を個別に変えない。
 * - short … 直線が短く、後方から届かない（札幌・函館・福島・小倉、阪神ダートの前残り）
 * - finishHill … ゴール前の坂で前が残る（中山の芝・ダート、阪神の急坂）
 * - middle … 直線で少し詰める。長い直線の上限にはしない
 * - long … すでに長い直線で使っている上限（東京芝、新潟の外と直線、京都の外回り一周超、中京の長い芝）
 */

export type FlatRow = {
  id: string;
  venue: string;
  track: "芝" | "ダート";
  meters: number;
  stretch: StretchKind;
};

/** 距離だけでは内と外が分かれない。回りを決める方法が決まるまで出さない */
export const DEFERRED_FLAT = [
  "阪神:芝:1400",
  "新潟:芝:1400",
  "京都:芝:1400",
  "京都:芝:1600",
  "京都:芝:2000",
  "新潟:芝:2000",
] as const;

const DEFERRED = new Set<string>(DEFERRED_FLAT);

function row(venue: string, track: "芝" | "ダート", meters: number, stretch: StretchKind): FlatRow {
  const slug = {
    中山: "nakayama",
    東京: "tokyo",
    阪神: "hanshin",
    京都: "kyoto",
    中京: "chukyo",
    新潟: "niigata",
    札幌: "sapporo",
    函館: "hakodate",
    福島: "fukushima",
    小倉: "kokura",
  }[venue];
  const surface = track === "芝" ? "turf" : "dirt";
  return { id: `${slug}-${surface}-${meters}`, venue, track, meters, stretch };
}

/** ワンターン以外。芝の内・外が同じ距離は入れない */
export const FLAT_NEW: FlatRow[] = [
  row("中山", "芝", 2000, "finishHill"),
  row("中山", "芝", 2200, "finishHill"),
  row("中山", "芝", 2500, "finishHill"),
  row("中山", "芝", 2600, "finishHill"),
  row("中山", "芝", 3200, "finishHill"),
  row("中山", "芝", 3600, "finishHill"),
  row("中山", "芝", 4000, "finishHill"),
  row("中山", "ダート", 1000, "finishHill"),
  row("中山", "ダート", 1200, "finishHill"),
  row("中山", "ダート", 1700, "finishHill"),
  row("中山", "ダート", 1800, "finishHill"),
  row("中山", "ダート", 2400, "finishHill"),
  row("中山", "ダート", 2500, "finishHill"),

  row("東京", "芝", 2300, "long"),
  row("東京", "芝", 2400, "long"),
  row("東京", "芝", 2500, "long"),
  row("東京", "芝", 2600, "long"),
  row("東京", "芝", 3400, "long"),
  row("東京", "ダート", 1200, "middle"),
  row("東京", "ダート", 1300, "middle"),
  row("東京", "ダート", 1400, "middle"),
  row("東京", "ダート", 1600, "middle"),
  row("東京", "ダート", 2100, "middle"),
  row("東京", "ダート", 2400, "middle"),

  row("阪神", "芝", 2000, "middle"),
  row("阪神", "芝", 2200, "middle"),
  row("阪神", "芝", 2400, "middle"),
  row("阪神", "芝", 2600, "finishHill"),
  row("阪神", "芝", 3000, "finishHill"),
  row("阪神", "芝", 3200, "finishHill"),
  row("阪神", "ダート", 1200, "short"),
  row("阪神", "ダート", 1400, "middle"),
  row("阪神", "ダート", 1800, "finishHill"),
  row("阪神", "ダート", 2000, "short"),
  row("阪神", "ダート", 2600, "finishHill"),

  row("京都", "芝", 1100, "middle"),
  row("京都", "芝", 2200, "long"),
  row("京都", "芝", 3000, "long"),
  row("京都", "芝", 3200, "long"),
  row("京都", "ダート", 1000, "middle"),
  row("京都", "ダート", 1100, "middle"),
  row("京都", "ダート", 1200, "middle"),
  row("京都", "ダート", 1400, "middle"),
  row("京都", "ダート", 1800, "middle"),
  row("京都", "ダート", 1900, "middle"),
  row("京都", "ダート", 2600, "middle"),

  row("中京", "芝", 2000, "middle"),
  row("中京", "芝", 2200, "long"),
  row("中京", "芝", 3000, "long"),
  row("中京", "ダート", 1200, "middle"),
  row("中京", "ダート", 1400, "middle"),
  row("中京", "ダート", 1800, "middle"),
  row("中京", "ダート", 1900, "middle"),
  row("中京", "ダート", 2500, "middle"),

  row("新潟", "芝", 1000, "long"),
  row("新潟", "芝", 2200, "middle"),
  row("新潟", "芝", 2400, "middle"),
  row("新潟", "芝", 3000, "long"),
  row("新潟", "芝", 3200, "long"),
  row("新潟", "ダート", 1000, "middle"),
  row("新潟", "ダート", 1200, "middle"),
  row("新潟", "ダート", 1700, "middle"),
  row("新潟", "ダート", 1800, "middle"),
  row("新潟", "ダート", 2500, "middle"),

  row("札幌", "芝", 1500, "short"),
  row("札幌", "芝", 1800, "short"),
  row("札幌", "芝", 2000, "short"),
  row("札幌", "芝", 2600, "short"),
  row("札幌", "ダート", 1000, "short"),
  row("札幌", "ダート", 1700, "short"),
  row("札幌", "ダート", 2400, "short"),

  row("函館", "芝", 1700, "short"),
  row("函館", "芝", 1800, "short"),
  row("函館", "芝", 2000, "short"),
  row("函館", "芝", 2600, "short"),
  row("函館", "ダート", 1000, "short"),
  row("函館", "ダート", 1700, "short"),
  row("函館", "ダート", 2400, "short"),

  row("福島", "芝", 1700, "short"),
  row("福島", "芝", 1800, "short"),
  row("福島", "芝", 2000, "short"),
  row("福島", "芝", 2600, "short"),
  row("福島", "ダート", 1000, "short"),
  row("福島", "ダート", 1150, "short"),
  row("福島", "ダート", 1700, "short"),
  row("福島", "ダート", 2400, "short"),

  row("小倉", "芝", 1700, "short"),
  row("小倉", "芝", 1800, "short"),
  row("小倉", "芝", 2000, "short"),
  row("小倉", "芝", 2600, "short"),
  row("小倉", "ダート", 1000, "short"),
  row("小倉", "ダート", 1700, "short"),
  row("小倉", "ダート", 2400, "short"),
];

const BY_KEY = new Map(FLAT_NEW.map((item) => [`${item.venue}:${item.track}:${item.meters}`, item]));

export function flatRow(id: string) {
  return FLAT_NEW.find((item) => item.id === id) ?? null;
}

export type FlatRace = {
  venue: string;
  track: string;
  distance: string;
  raceDate: string;
};

/** レース詳細に出す平地。未対応・後回し・障害は null */
export function flatSimId(race: FlatRace): string | null {
  if (race.raceDate < TURF_SIM_FROM) return null;
  if (race.track !== "芝" && race.track !== "ダート") return null;
  if (race.distance.includes("障害")) return null;
  const meters = parseDistanceMeters(race.distance);
  if (meters == null) return null;
  const venue = normalizeVenue(race.venue);
  const key = `${venue}:${race.track}:${meters}`;
  if (DEFERRED.has(key)) return null;
  if (race.track === "芝") {
    const legacy = turfOneTurnId(race);
    if (legacy) return legacy;
  }
  return BY_KEY.get(key)?.id ?? null;
}

export function isFlatSimRace(race: FlatRace) {
  return flatSimId(race) != null;
}
