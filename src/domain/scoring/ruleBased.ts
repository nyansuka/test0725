import type { Horse, HorseFactors, Race } from "../types";
import { popularityByNumber } from "../odds";
import { trackGateBiasScore } from "./trackGateBias.mjs";
import { popularityWinScore, WIN_POP_BLEND } from "./popularityPrior";

export type ScoreResult = {
  placePotential: number;
  winPotential: number;
  factors: HorseFactors;
  rationale: string;
};

export type Scorer = {
  score(horse: Horse, race: Race): ScoreResult;
};

/** 複勝圏（1〜3着）向け */
const PLACE_WEIGHTS = {
  courseFit: 0.25,
  paceFit: 0.2,
  conditionFit: 0.15,
  formSignal: 0.2,
  valueGap: 0.1,
  gateJockey: 0.1,
} as const;

/** 1着特化の因子側（人気事前とブレンド） */
const WIN_WEIGHTS = {
  courseFit: 0.28,
  paceFit: 0.25,
  conditionFit: 0.12,
  formSignal: 0.28,
  valueGap: 0.02,
  gateJockey: 0.05,
} as const;

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function weighted(factors: HorseFactors, weights: typeof PLACE_WEIGHTS | typeof WIN_WEIGHTS) {
  return (
    factors.courseFit * weights.courseFit +
    factors.paceFit * weights.paceFit +
    factors.conditionFit * weights.conditionFit +
    factors.formSignal * weights.formSignal +
    factors.valueGap * weights.valueGap +
    (factors.gateJockey ?? 50) * weights.gateJockey
  );
}

/** 前走・同条件から1着向きの軽い補正（データが無いときは 0） */
function winFormBoost(horse: Horse): number {
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

function topFactors(factors: HorseFactors, limit = 2): string[] {
  const entries: [string, number][] = [
    ["コース適性", factors.courseFit],
    ["展開適性", factors.paceFit],
    ["馬場適性", factors.conditionFit],
    ["近況", factors.formSignal],
    ["人気乖離", factors.valueGap],
    ["枠・騎手", factors.gateJockey ?? 50],
  ];
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, score]) => `${label}${score}`);
}

export const ruleBasedScorer: Scorer = {
  score(horse, race) {
    const factors: HorseFactors = { ...horse.factors };
    // track 依存の枠バイアスは常に上書き（スナップショットの仮値に依存しない）
    factors.gateJockey = trackGateBiasScore(race.track, horse.bracket);

    // 当日条件との軽い補正（サンプル用）
    if (race.condition.includes("稍") || race.condition.includes("重")) {
      factors.conditionFit = clamp(factors.conditionFit + (factors.conditionFit >= 65 ? 4 : -2));
    }
    if (horse.oddsWin >= 12) {
      factors.valueGap = clamp(factors.valueGap + 3);
    }

    const placePotential = clamp(weighted(factors, PLACE_WEIGHTS));

    const pop = popularityByNumber(race.horses).get(horse.number) ?? null;
    const factorWin = weighted(factors, WIN_WEIGHTS);
    const popWin = popularityWinScore(pop);
    const winPotential = clamp(
      factorWin * (1 - WIN_POP_BLEND) + popWin * WIN_POP_BLEND + winFormBoost(horse),
    );

    const highlights = topFactors(factors);
    const popNote = pop != null ? `${pop}番人気` : "人気不明";
    const rationale = `${horse.name}は複勝圏${placePotential}／1着見込み${winPotential}（${popNote}）。${highlights.join("・")}が牽引。単勝${horse.oddsWin.toFixed(1)}倍。`;

    return { placePotential, winPotential, factors, rationale };
  },
};
