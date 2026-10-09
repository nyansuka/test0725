import type { RunningStyle } from "@/domain/sim/nakayamaTurf1200Script";

export type StyleRun = {
  date: string;
  track: string;
  venue?: string;
  distanceM?: number | null;
  passFirst?: number | null;
  passLast?: number | null;
  /** 通過の全地点。無いキャッシュは passFirst / passLast だけ */
  passParts?: number[] | null;
  fieldSize?: number | null;
  /** 前半ラップ。上がりは持たない */
  paceFrontSec?: number | null;
  /** 着順。直線で詰めた幅だけに使う。脚質には使わない */
  rank?: number | null;
};

export type StyleFocus = {
  venue?: string;
  distanceM?: number | null;
  /** 無いときは芝。ダートのレースはダートの通過だけ */
  track?: "芝" | "ダート";
};

/** 同場・近い距離がこれ未満なら、その馬場の全走へ戻す */
const SIMILAR_MIN = 2;
const DISTANCE_BAND_M = 200;

function callPosition(run: StyleRun) {
  const pos = run.passFirst ?? run.passLast;
  if (pos == null || pos < 1) return null;
  return pos;
}

/**
 * 発走前の直近5走（同じ馬場・通過あり・当日より前）。新しい順。
 * 位置は最初の通過。無ければ最後の通過。
 */
export function passRunsBefore(runs: StyleRun[], raceDate: string, track: "芝" | "ダート" = "芝"): StyleRun[] {
  return runs
    .filter((run) => run.date < raceDate && run.track === track && callPosition(run) != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
}

/** 発走前の直近5走（芝） */
export function turfRunsBefore(runs: StyleRun[], raceDate: string): StyleRun[] {
  return passRunsBefore(runs, raceDate, "芝");
}

/**
 * 脚質に使う走。同場で距離差200m以内が2走以上あるときだけ、それに限る。
 * 足りなければ、その馬場の直近5走。別コースを同じ重さでは数えない。
 */
export function styleRuns(runs: StyleRun[], raceDate: string, focus?: StyleFocus): StyleRun[] {
  const track = focus?.track === "ダート" ? "ダート" : "芝";
  const all = passRunsBefore(runs, raceDate, track);
  const venue = focus?.venue;
  const meters = focus?.distanceM;
  if (!venue || meters == null) return all;
  const similar = all.filter((run) => inSimilarBand(run, venue, meters));
  return similar.length >= SIMILAR_MIN ? similar : all;
}

function inSimilarBand(run: StyleRun, venue: string, meters: number) {
  if (run.venue !== venue || run.distanceM == null) return false;
  return Math.abs(run.distanceM - meters) <= DISTANCE_BAND_M;
}

/**
 * 逃げは、同場で距離差200m以内の走が2つ以上あるときだけ。
 * 足りず馬場全体の直近5走へ戻し、別場か離れた距離が混ざるときは先行にする。
 * 場と距離が無い走だけでは別コースと分からない。場の指定が無いときは、今までどおり逃にしてよい。
 */
function escapeOnThisCourse(runs: StyleRun[], raceDate: string, focus?: StyleFocus) {
  const track = focus?.track === "ダート" ? "ダート" : "芝";
  const all = passRunsBefore(runs, raceDate, track);
  const venue = focus?.venue;
  const meters = focus?.distanceM;
  if (!venue || meters == null) return true;
  const similar = all.filter((run) => inSimilarBand(run, venue, meters));
  if (similar.length >= SIMILAR_MIN) return true;
  const otherCourse = all.some((run) => {
    if (run.venue && run.venue !== venue) return true;
    return run.distanceM != null && Math.abs(run.distanceM - meters) > DISTANCE_BAND_M;
  });
  return !otherCourse;
}

function positionRate(pos: number | null | undefined, fieldSize: number | null | undefined) {
  if (pos == null || pos < 1 || fieldSize == null || fieldSize < 1) return null;
  return pos / fieldSize;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * 3角は通過列の最後から二つ目。4角は最後。
 * 列が無いときは、3角を最初の通過、4角を最後の通過にする。
 * 着順と上がりは見ない。
 */
export function cornerRates(runs: StyleRun[]) {
  const early: number[] = [];
  const at3: number[] = [];
  const at4: number[] = [];
  const fronts: number[] = [];
  for (const run of runs) {
    const parts = run.passParts?.filter((pos) => pos >= 1);
    const fourth = parts && parts.length ? parts[parts.length - 1] : run.passLast ?? run.passFirst;
    const third = parts && parts.length >= 2 ? parts[parts.length - 2] : run.passFirst ?? run.passLast;
    const earlyRate = positionRate(callPosition(run), run.fieldSize);
    const thirdRate = positionRate(third, run.fieldSize);
    const fourthRate = positionRate(fourth, run.fieldSize);
    if (earlyRate != null) early.push(earlyRate);
    if (thirdRate != null) at3.push(thirdRate);
    if (fourthRate != null) at4.push(fourthRate);
    if (run.paceFrontSec != null && run.paceFrontSec > 0) fronts.push(run.paceFrontSec);
  }
  return {
    posRate: average(early),
    corner3Rate: average(at3),
    corner4Rate: average(at4),
    paceFrontSec: average(fronts),
  };
}

/**
 * 最後の通過から着順まで、位置率がどれだけ前へ動いたか。
 * メートルは呼び出し側で、位置率1あたり80mにして足す。
 * 着順が無い走は数えない。上がりとオッズは見ない。
 */
export function stretchGainRate(runs: StyleRun[]) {
  const gains: number[] = [];
  for (const run of runs) {
    const parts = run.passParts?.filter((pos) => pos >= 1);
    const last = parts && parts.length ? parts[parts.length - 1] : run.passLast;
    const rank = run.rank;
    const fieldSize = run.fieldSize;
    if (last == null || last < 1 || rank == null || rank < 1 || fieldSize == null || fieldSize < 1) continue;
    gains.push(last / fieldSize - rank / fieldSize);
  }
  return average(gains);
}

/**
 * 発走前の同じ馬場。同場・近い距離が2走以上ならそれだけ。足りなければ直近5走。
 * 逃げ: 2番手以内が6割以上かつ先頭が2回以上。同場・距離差200m以内に絞れたときだけ。
 * 同場が2走未満で馬場全体へ戻し、別コースが混ざるときは、同じ条件でも先行。
 * 先行: 平均位置率0.28以下、または2番手以内が6割以上。
 * 追込: 平均位置率0.58以上。それ以外は差し。
 * 位置は最初の通過。無ければ最後の通過。位置率は頭数で割る。
 * 発走日の結果では付け直さない。
 */
export function styleFromTurfRuns(
  runs: StyleRun[],
  raceDate: string,
  focus?: StyleFocus,
): { style: RunningStyle; used: number } {
  const usable = styleRuns(runs, raceDate, focus);
  // 通過が無い馬は差し。調教の掛かり・併せは未取得で、時計はメートルにしない。
  if (!usable.length) return { style: "差", used: 0 };

  const pos = usable.map((run) => callPosition(run) as number);
  const within2 = pos.filter((p) => p <= 2).length / pos.length;
  const leads = pos.filter((p) => p === 1).length;
  const rates = usable
    .filter((run) => (run.fieldSize ?? 0) > 0)
    .map((run) => (callPosition(run) as number) / (run.fieldSize as number));
  const avg = rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : null;

  if (within2 >= 0.6 && leads >= 2 && escapeOnThisCourse(runs, raceDate, focus)) {
    return { style: "逃", used: pos.length };
  }
  if ((avg != null && avg <= 0.28) || within2 >= 0.6) return { style: "先", used: pos.length };
  if (avg != null && avg >= 0.58) return { style: "追", used: pos.length };
  return { style: "差", used: pos.length };
}
