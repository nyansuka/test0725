import type { Horse, HorseFactors, Race } from "../types";
import { trackGateBiasScore } from "./trackGateBias.mjs";

export type ScoreResult = {
  placePotential: number;
  factors: HorseFactors;
  rationale: string;
};

export type Scorer = {
  score(horse: Horse, race: Race): ScoreResult;
};

const WEIGHTS = {
  courseFit: 0.25,
  paceFit: 0.2,
  conditionFit: 0.15,
  formSignal: 0.2,
  valueGap: 0.1,
  gateJockey: 0.1,
} as const;

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(n)));
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

    const placePotential = clamp(
      factors.courseFit * WEIGHTS.courseFit +
        factors.paceFit * WEIGHTS.paceFit +
        factors.conditionFit * WEIGHTS.conditionFit +
        factors.formSignal * WEIGHTS.formSignal +
        factors.valueGap * WEIGHTS.valueGap +
        (factors.gateJockey ?? 50) * WEIGHTS.gateJockey,
    );

    const highlights = topFactors(factors);
    const rationale = `${horse.name}は複勝圏ポテンシャル${placePotential}。${highlights.join("・")}が牽引。単勝${horse.oddsWin.toFixed(1)}倍。`;

    return { placePotential, factors, rationale };
  },
};
