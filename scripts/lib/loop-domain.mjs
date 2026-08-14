/**
 * 改善ループ用の選別・的中判定（ドメイン層の薄い移植）。
 * src/domain の TypeScript と挙動を揃えること。
 */

import { trackGateBiasScore } from "../../src/domain/scoring/trackGateBias.mjs";
import {
  FORM_SIGNAL_NEUTRAL,
  formSignalFromFormStats,
  valueGapFromPopularity,
} from "../../src/domain/scoring/deriveFactors.mjs";

export const ALL_BET_TYPES = [
  "win",
  "place",
  "bracket_quinella",
  "bracket_exacta",
  "quinella",
  "wide",
  "exacta",
  "trio",
  "trifecta",
];

export const DEFAULT_SETTINGS = {
  oddsThreshold: 25,
  /** B3: 上限80（感度スイープ推奨。null で上限なし） */
  oddsMax: 80,
  /**
   * 2026-08-13: 60→65（凍結6日 scoreMin スイープ）。
   * 70 は注目穴帯を空にし密度 1.3。65 は dens≈6.6 · ticket≈1.62%。
   */
  scoreMin: 65,
  enabledBetTypes: [...ALL_BET_TYPES],
};

export const LABEL_SCORE_THRESHOLD = 65;
/** 注目穴スコア帯（C3）。下限含む・上限含まず */
export const HOT_SCORE_MIN = 65;
export const HOT_SCORE_MAX = 70;

export function labelFor(score) {
  if (score >= HOT_SCORE_MIN && score < HOT_SCORE_MAX) return "注目穴";
  return "抑え候補";
}

function isHotScore(score) {
  return score >= HOT_SCORE_MIN && score < HOT_SCORE_MAX;
}
export const AXIS_TOP_N = 3;

const PLACE_WEIGHTS = {
  courseFit: 0.25,
  paceFit: 0.2,
  conditionFit: 0.15,
  formSignal: 0.2,
  valueGap: 0.1,
  gateJockey: 0.1,
};

const WIN_WEIGHTS = {
  courseFit: 0.28,
  paceFit: 0.25,
  conditionFit: 0.12,
  formSignal: 0.28,
  valueGap: 0.02,
  gateJockey: 0.05,
};

/** TFJV Race Results2000（〜2026-07）に基づく人気事前（src/domain/scoring/popularityPrior.ts と同期） */
const WIN_POP_BLEND = 0.62;
const MID_COMPOSITE_MIN = 65;
let MID_REPLACE_GAP = 18;
const MID_TIME_TOP_PCT = 0.2;

export function getMidReplaceGap() {
  return MID_REPLACE_GAP;
}

export function setMidReplaceGap(gap) {
  MID_REPLACE_GAP = gap;
}

function isRaceTopTime(horse, horses, topPct = MID_TIME_TOP_PCT) {
  const timed = (horses ?? [])
    .map((h) => ({ number: h.number, t: h.formStats?.bestTimeSec ?? null }))
    .filter((x) => x.t != null && Number.isFinite(x.t));
  if (timed.length < 2) return false;
  timed.sort((a, b) => a.t - b.t || a.number - b.number);
  const cutoff = Math.max(1, Math.ceil(timed.length * topPct));
  const idx = timed.findIndex((x) => x.number === horse.number);
  return idx >= 0 && idx < cutoff;
}

function popularityWinScore(popularity) {
  if (popularity == null || popularity < 1) return 40;
  if (popularity === 1) return 92;
  if (popularity === 2) return 78;
  if (popularity === 3) return 68;
  if (popularity === 4) return 58;
  if (popularity === 5) return 50;
  if (popularity === 6) return 42;
  if (popularity === 7) return 34;
  if (popularity === 8) return 28;
  if (popularity === 9) return 22;
  if (popularity === 10) return 16;
  return 8;
}

function midLongshotComposite(horse) {
  const f = horse.factors ?? {};
  const form =
    formSignalFromFormStats(horse.formStats) ?? f.formSignal ?? FORM_SIGNAL_NEUTRAL;
  return form * 0.5 + (f.courseFit ?? 50) * 0.35 + (f.paceFit ?? 50) * 0.15;
}

function qualifiesMidLongshot(horse, popularity, field) {
  if (popularity < 6 || popularity > 10) return false;
  const fs = horse.formStats;
  const comp = midLongshotComposite(horse);
  if (fs?.lastRank === 1) return true;
  if (fs?.lastRank != null && fs.lastRank <= 3 && comp >= 58) return true;
  if (isRaceTopTime(horse, field)) return true;
  return comp >= MID_COMPOSITE_MIN;
}

export function popularityByNumber(horses) {
  const sorted = [...horses].sort(
    (a, b) => a.oddsWin - b.oddsWin || a.number - b.number,
  );
  const map = new Map();
  sorted.forEach((h, i) => map.set(h.number, i + 1));
  return map;
}

export function parseSelectionNumbers(selection) {
  return String(selection)
    .split(/[-–—/]/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function clamp(n, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function prepareFactors(horse, race) {
  const factors = { ...horse.factors };
  factors.gateJockey = trackGateBiasScore(race.track, horse.bracket);
  const pop = popularityByNumber(race.horses ?? []).get(horse.number) ?? null;
  factors.valueGap = valueGapFromPopularity(pop);
  const derivedForm = formSignalFromFormStats(horse.formStats);
  factors.formSignal = derivedForm ?? FORM_SIGNAL_NEUTRAL;
  if (String(race.condition).includes("稍") || String(race.condition).includes("重")) {
    factors.conditionFit = clamp(factors.conditionFit + (factors.conditionFit >= 65 ? 4 : -2));
  }
  return factors;
}

function weighted(factors, weights) {
  return (
    factors.courseFit * weights.courseFit +
    factors.paceFit * weights.paceFit +
    factors.conditionFit * weights.conditionFit +
    factors.formSignal * weights.formSignal +
    factors.valueGap * weights.valueGap +
    (factors.gateJockey ?? 50) * weights.gateJockey
  );
}

function winFormBoost(horse) {
  const fs = horse.formStats;
  if (!fs) return 0;
  let boost = 0;
  if (fs.lastRank === 1) boost += 8;
  else if (fs.lastRank === 2) boost += 3;
  else if (fs.lastRank != null && fs.lastRank >= 8) boost -= 4;
  if (fs.avgSameRank != null && fs.avgSameRank > 0 && fs.avgSameRank <= 2.5) boost += 5;
  else if (fs.avgSameRank != null && fs.avgSameRank >= 6) boost -= 3;
  return boost;
}

export function scoreHorse(horse, race) {
  return clamp(weighted(prepareFactors(horse, race), PLACE_WEIGHTS));
}

export function scoreWinPotential(horse, race) {
  const factors = prepareFactors(horse, race);
  const factorWin = weighted(factors, WIN_WEIGHTS);
  const pop = popularityByNumber(race.horses ?? []).get(horse.number) ?? null;
  const popWin = popularityWinScore(pop);
  return clamp(factorWin * (1 - WIN_POP_BLEND) + popWin * WIN_POP_BLEND + winFormBoost(horse));
}

function resolveRelatedHorses(race, selection, betType) {
  const nums = parseSelectionNumbers(selection);
  if (betType === "bracket_quinella" || betType === "bracket_exacta") {
    return race.horses.filter((h) => h.bracket != null && nums.includes(h.bracket));
  }
  return race.horses.filter((h) => nums.includes(h.number));
}

function combinePlacePotential(scores) {
  if (scores.length === 0) return 0;
  return Math.min(...scores);
}

function pickComment(race, related) {
  if (related.length === 0) return "関係馬の評価が不足しています。";
  const best = [...related].sort((a, b) => scoreHorse(b, race) - scoreHorse(a, race))[0];
  return best.comment ?? "";
}

export function classifyOddsEntry(race, entry, settings) {
  const enabled = new Set(settings.enabledBetTypes);
  if (!enabled.has(entry.betType)) {
    return { status: "disabled_bet", relatedHorseNumbers: [], relatedPlacePotential: 0 };
  }
  if (entry.odds < settings.oddsThreshold) {
    return { status: "below_threshold", relatedHorseNumbers: [], relatedPlacePotential: 0 };
  }
  if (settings.oddsMax != null && entry.odds > settings.oddsMax) {
    return { status: "above_max", relatedHorseNumbers: [], relatedPlacePotential: 0 };
  }
  const related = resolveRelatedHorses(race, entry.selection, entry.betType);
  if (related.length === 0) {
    return { status: "no_related", relatedHorseNumbers: [], relatedPlacePotential: 0 };
  }
  const relatedPlacePotential = combinePlacePotential(related.map((h) => scoreHorse(h, race)));
  if (relatedPlacePotential < settings.scoreMin) {
    return {
      status: "pass",
      relatedHorseNumbers: related.map((h) => h.number),
      relatedPlacePotential,
      comment: pickComment(race, related),
    };
  }
  return {
    status: "candidate",
    relatedHorseNumbers: related.map((h) => h.number),
    relatedPlacePotential,
    label: labelFor(relatedPlacePotential),
    comment: pickComment(race, related),
  };
}

/** レース内 winPotential Top3。中穴は条件付きで 3枠目差し替え */
export function selectAxisHorses(race, longshotPicks) {
  if (race.authority !== "JRA" || !(race.horses?.length > 0)) return [];
  const pops = popularityByNumber(race.horses);
  const scored = race.horses.map((horse) => ({
    horse,
    winPotential: scoreWinPotential(horse, race),
    popularity: pops.get(horse.number) ?? 99,
    midComposite: midLongshotComposite(horse),
    promoted: false,
  }));
  scored.sort((a, b) => {
    if (b.winPotential !== a.winPotential) return b.winPotential - a.winPotential;
    return a.horse.oddsWin - b.horse.oddsWin;
  });
  const axis = scored.slice(0, Math.min(AXIS_TOP_N, scored.length));
  const hasMid = axis.some((a) => a.popularity >= 6 && a.popularity <= 10);
  if (!hasMid && axis.length === AXIS_TOP_N) {
    const candidates = scored
      .filter((a) => qualifiesMidLongshot(a.horse, a.popularity, race.horses))
      .sort((a, b) => b.midComposite - a.midComposite || b.winPotential - a.winPotential);
    const cand = candidates[0];
    const third = axis[2];
    if (
      cand &&
      third &&
      cand.winPotential + MID_REPLACE_GAP >= third.winPotential &&
      !axis.some((a) => a.horse.number === cand.horse.number)
    ) {
      axis[2] = { ...cand, promoted: true };
    }
  }
  const watch = new Set();
  if (longshotPicks?.length) {
    for (const pick of longshotPicks) {
      if (pick.label !== "注目穴") continue;
      if (pick.raceId && pick.raceId !== race.id) continue;
      for (const n of pick.relatedHorseNumbers ?? []) watch.add(n);
    }
  }
  return axis.map((item, index) => ({
    raceId: race.id,
    horseNumber: item.horse.number,
    winPotential: item.winPotential,
    rankInRace: index + 1,
    isSuperWatch: watch.has(item.horse.number),
    midPromoted: Boolean(item.promoted),
  }));
}

export function selectLongshots(races, settings) {
  const picks = [];
  for (const race of races) {
    if (race.authority !== "JRA") continue;
    const axisNums = new Set(selectAxisHorses(race).map((a) => a.horseNumber));
    for (const entry of race.oddsBoard ?? []) {
      const row = classifyOddsEntry(race, entry, settings);
      if (row.status !== "candidate" || !row.label) continue;
      const hasSuperWatch =
        row.label === "注目穴" && row.relatedHorseNumbers.some((n) => axisNums.has(n));
      picks.push({
        raceId: race.id,
        venue: race.venue,
        raceNumber: race.raceNumber,
        startTime: race.startTime,
        track: race.track,
        title: race.title,
        betType: entry.betType,
        selection: entry.selection,
        odds: entry.odds,
        relatedHorseNumbers: row.relatedHorseNumbers,
        relatedPlacePotential: row.relatedPlacePotential,
        label: row.label,
        comment: row.comment ?? "",
        hasSuperWatch,
      });
    }
  }
  return picks.sort((a, b) => {
    if (Boolean(b.hasSuperWatch) !== Boolean(a.hasSuperWatch)) {
      return a.hasSuperWatch ? -1 : 1;
    }
    return b.relatedPlacePotential - a.relatedPlacePotential;
  });
}

function relatedNumbers(pick) {
  if (pick.relatedHorseNumbers?.length) return pick.relatedHorseNumbers;
  return parseSelectionNumbers(pick.selection);
}

/** 関係馬のうち最良着順（未着・欠場のみなら null） */
export function bestRelatedRank(pick, result) {
  if (!result?.finishes?.length) return null;
  let best = null;
  for (const n of relatedNumbers(pick)) {
    const finish = result.finishes.find((f) => f.number === n);
    if (finish?.rank == null || finish.rank < 1) continue;
    if (best == null || finish.rank < best) best = finish.rank;
  }
  return best;
}

export function isInMoney(outcome) {
  return outcome === "win" || outcome === "place";
}

export function outcomeLabel(outcome) {
  switch (outcome) {
    case "win":
      return "大当たり";
    case "place":
      return "馬券内";
    case "miss":
      return "はずれ";
    default:
      return "待ち";
  }
}

/**
 * 複勝圏ベース判定（券種の厳密払戻とは別）
 * @returns {"win"|"place"|"miss"|"pending"}
 * - win … 1着（大当たり）
 * - place … 2・3着（馬券内）
 * - miss … 4着以下（はずれ）
 */
export function evaluatePick(pick, result) {
  if (!result?.finishes?.length) return "pending";
  const rank = bestRelatedRank(pick, result);
  if (rank == null) return "miss";
  if (rank === 1) return "win";
  if (rank <= 3) return "place";
  return "miss";
}

function normKey(betType, selection) {
  const nums = parseSelectionNumbers(selection);
  // 順不同券種は昇順で突合（オッズ板と払戻の並び差を吸収）
  const unordered = new Set(["quinella", "wide", "bracket_quinella", "trio"]);
  const legs = unordered.has(betType) ? [...nums].sort((a, b) => a - b) : nums;
  return `${betType}:${legs.join("-")}`;
}

export function findPayoutYen(result, betType, selection) {
  if (!result?.payouts?.length) return null;
  const key = normKey(betType, selection);
  const hit = result.payouts.find((p) => normKey(p.betType, p.selection) === key);
  return hit ? hit.payoutYen : null;
}

export function pickKey(pick) {
  return `${pick.raceId}|${pick.betType}|${parseSelectionNumbers(pick.selection).join("-")}`;
}

/** 軸馬が実際に1着か */
export function evaluateAxisHorse(axisPick, result) {
  if (!result?.finishes?.length) return "pending";
  const finish = result.finishes.find((f) => f.number === axisPick.horseNumber);
  if (finish?.rank == null || finish.rank < 1) return "miss";
  if (finish.rank === 1) return "win";
  if (finish.rank <= 3) return "place";
  return "miss";
}
