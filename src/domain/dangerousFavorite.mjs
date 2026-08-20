/**
 * 危険1人気フラグ（仮）。
 * 1番人気を無条件では消さない。根拠があるときだけ印を付ける。
 * 軸選定・買い目生成からはまだ除外しない（週次1変更）。
 */

export const DANGEROUS_FAV_REASONS = [
  "factor_win_below_median",
  "closer_on_front_course",
];

export const DANGEROUS_FAV_REASON_LABELS = {
  factor_win_below_median: "人気を除いた1着適性がレース中央値未満",
  closer_on_front_course: "先行有利コースの差し・追込",
};

const CLOSER_STYLES = new Set(["差", "追"]);

/**
 * 先行有利とみなすコース（仮・Derive）。
 * 初期は新潟芝のみ。距離細分は出現率を見て後続。
 */
export function isFrontBiasedCourse(venue, track, _distance) {
  return track === "芝" && String(venue ?? "").includes("新潟");
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

function lookup(mapLike, key) {
  if (mapLike == null) return undefined;
  if (typeof mapLike.get === "function") return mapLike.get(key);
  return mapLike[key];
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
 * }}
 */
export function assessDangerousFirstFavorite({
  raceId,
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
  const reasons = [];

  if (factorWin < factorWinMedian) {
    reasons.push("factor_win_below_median");
  }
  if (isCloserStyle(first.runningStyle) && isFrontBiasedCourse(venue, track, distance)) {
    reasons.push("closer_on_front_course");
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
  };
}
