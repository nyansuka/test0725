/**
 * 危険1人気フラグ（仮）。
 * 1番人気を無条件では消さない。根拠があるときだけ印を付ける。
 * 軸選定・買い目生成からはまだ除外しない（週次1変更）。
 */

import { isFrontBiasedCourse as courseFrontBias } from "./courseNotes.mjs";

export const DANGEROUS_FAV_REASONS = [
  "factor_win_below_median",
  "closer_on_front_course",
  "layoff_over_6_months",
];

export const DANGEROUS_FAV_REASON_LABELS = {
  factor_win_below_median: "人気を除いた1着適性がレース中央値未満",
  closer_on_front_course: "先行有利コースの差し・追込",
  layoff_over_6_months: "前走から半年以上の休み明け",
};

/** 半年以上。lastDate が無いときはこの枝は発火しない */
export const LAYOFF_DAYS_MIN = 180;

const CLOSER_STYLES = new Set(["差", "追"]);
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 先行有利とみなすコース。
 * 新潟芝は従来どおり全距離。ほかは検証済み距離だけ。京都は未検証。
 */
export function isFrontBiasedCourse(venue, track, distance) {
  return courseFrontBias(venue, track, distance);
}

export function isCloserStyle(runningStyle) {
  return CLOSER_STYLES.has(runningStyle);
}

export function lowerMedian(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

export function dangerousFavReasonLabels(reasons) {
  return (reasons ?? [])
    .map((r) => DANGEROUS_FAV_REASON_LABELS[r])
    .filter(Boolean);
}

/** YYYY-MM-DD 同士の暦日差。不正なら null */
export function calendarDaysBetween(fromIso, toIso) {
  const parse = (iso) => {
    if (typeof iso !== "string") return null;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  const a = parse(fromIso);
  const b = parse(toIso);
  if (a == null || b == null) return null;
  return Math.round((b - a) / DAY_MS);
}

export function isLongLayoff(lastDate, raceDate, minDays = LAYOFF_DAYS_MIN) {
  const days = calendarDaysBetween(lastDate, raceDate);
  return days != null && days >= minDays;
}

function lookup(mapLike, key) {
  if (mapLike == null) return undefined;
  if (typeof mapLike.get === "function") return mapLike.get(key);
  return mapLike[key];
}

function lastDateOf(horse) {
  return horse?.formStats?.lastDate ?? null;
}

/**
 * @returns {null | {
 *   raceId: string,
 *   horseNumber: number,
 *   flagged: boolean,
 *   reasons: string[],
 *   popularity: 1,
 *   factorWin: number,
 *   factorWinMedian: number,
 *   runningStyle: string | null,
 *   layoffDays: number | null,
 * }}
 */
export function assessDangerousFirstFavorite({
  raceId,
  raceDate,
  venue,
  track,
  distance,
  horses,
  popularity,
  factorWins,
}) {
  if (!horses?.length) return null;

  const first = horses.find((h) => lookup(popularity, h.number) === 1);
  if (!first) return null;

  const wins = horses.map((h) => Number(lookup(factorWins, h.number) ?? 0));
  const factorWin = Number(lookup(factorWins, first.number) ?? 0);
  const factorWinMedian = lowerMedian(wins);
  const layoffDays = calendarDaysBetween(lastDateOf(first), raceDate);
  const reasons = [];

  if (factorWin < factorWinMedian) {
    reasons.push("factor_win_below_median");
  }
  if (isCloserStyle(first.runningStyle) && isFrontBiasedCourse(venue, track, distance)) {
    reasons.push("closer_on_front_course");
  }
  if (isLongLayoff(lastDateOf(first), raceDate)) {
    reasons.push("layoff_over_6_months");
  }

  return {
    raceId,
    horseNumber: first.number,
    flagged: reasons.length > 0,
    reasons,
    popularity: 1,
    factorWin,
    factorWinMedian,
    runningStyle: first.runningStyle ?? null,
    layoffDays,
  };
}
