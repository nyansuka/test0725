import type { BetType, Race, RaceResult } from "./types";
import { parseSelectionNumbers } from "./betTypes";

/** 複勝圏ベースの結果判定（券種の厳密払戻とは別） */
export type PickOutcome = "win" | "place" | "miss" | "pending";

export function isInMoney(outcome: PickOutcome): boolean {
  return outcome === "win" || outcome === "place";
}

export function outcomeLabel(outcome: PickOutcome): string {
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

function relatedNumbers(pick: PickLike): number[] {
  if (pick.relatedHorseNumbers?.length) return pick.relatedHorseNumbers;
  return parseSelectionNumbers(pick.selection);
}

type PickLike = {
  selection: string;
  relatedHorseNumbers?: number[];
};

/** 関係馬のうち最良着順（未着・欠場のみなら null） */
export function bestRelatedRank(
  pick: PickLike,
  result: RaceResult | undefined,
): number | null {
  if (!result?.finishes?.length) return null;
  let best: number | null = null;
  for (const n of relatedNumbers(pick)) {
    const finish = result.finishes.find((f) => f.number === n);
    if (finish?.rank == null || finish.rank < 1) continue;
    if (best == null || finish.rank < best) best = finish.rank;
  }
  return best;
}

/**
 * 候補の結果判定（製品方針: 複勝圏ポテンシャル）
 * - 1着 → 大当たり (win)
 * - 2・3着 → 馬券内 (place) ※はずれにしない
 * - 4着以下 → はずれ (miss)
 */
export function evaluatePick(pick: PickLike, result: RaceResult | undefined): PickOutcome {
  if (!result?.finishes?.length) return "pending";
  const rank = bestRelatedRank(pick, result);
  if (rank == null) return "miss";
  if (rank === 1) return "win";
  if (rank <= 3) return "place";
  return "miss";
}

/** 単一頭の着順から複勝圏判定 */
export function evaluateHorse(
  horseNumber: number,
  result: RaceResult | undefined,
): PickOutcome {
  if (!result?.finishes?.length) return "pending";
  const finish = result.finishes.find((f) => f.number === horseNumber);
  if (finish?.rank == null || finish.rank < 1) return "miss";
  if (finish.rank === 1) return "win";
  if (finish.rank <= 3) return "place";
  return "miss";
}

export function horseFinishRank(
  horseNumber: number,
  result: RaceResult | undefined,
): number | null {
  if (!result?.finishes?.length) return null;
  const finish = result.finishes.find((f) => f.number === horseNumber);
  if (finish?.rank == null || finish.rank < 1) return null;
  return finish.rank;
}

export type FeaturedHorseSummary = {
  total: number;
  settled: number;
  hits: number;
  wins: number;
  places: number;
  misses: number;
  pending: number;
  /** 確定頭に対する複勝圏的中率（%）。確定0は null */
  hitRatePercent: number | null;
};

/**
 * 表示中候補の関係馬をレース単位でユニークに数え、複勝圏的中を集計する。
 * （同一馬が複数買い目に出ても1頭として扱う）
 */
export function summarizeFeaturedHorses(
  picks: { raceId: string; relatedHorseNumbers: number[] }[],
  raceById: Map<string, Race>,
): FeaturedHorseSummary {
  const seen = new Set<string>();
  let hits = 0;
  let wins = 0;
  let places = 0;
  let misses = 0;
  let pending = 0;

  for (const pick of picks) {
    for (const n of pick.relatedHorseNumbers) {
      const key = `${pick.raceId}#${n}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const outcome = evaluateHorse(n, raceById.get(pick.raceId)?.result);
      if (outcome === "pending") pending += 1;
      else if (outcome === "win") {
        wins += 1;
        hits += 1;
      } else if (outcome === "place") {
        places += 1;
        hits += 1;
      } else {
        misses += 1;
      }
    }
  }

  const total = seen.size;
  const settled = total - pending;
  return {
    total,
    settled,
    hits,
    wins,
    places,
    misses,
    pending,
    hitRatePercent: settled === 0 ? null : Math.round((hits / settled) * 1000) / 10,
  };
}

export function formatFinishLine(result: RaceResult): string {
  const top = result.finishes
    .filter((f) => f.rank != null && f.rank <= 3)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  if (top.length === 0) return "結果待ち";
  return top.map((f) => `${f.rank}着 ${f.number}番 ${f.name}`).join(" · ");
}

export function payoutLabel(betType: BetType): string {
  const map: Record<BetType, string> = {
    win: "単勝",
    place: "複勝",
    bracket_quinella: "枠連",
    quinella: "馬連",
    wide: "ワイド",
    exacta: "馬単",
    trio: "3連複",
    trifecta: "3連単",
  };
  return map[betType];
}

export function raceHasResult(race: Race): boolean {
  return Boolean(race.result?.finishes?.length);
}

function payoutNormKey(betType: BetType, selection: string): string {
  const nums = parseSelectionNumbers(selection);
  return `${betType}:${nums.join("-")}`;
}

/** 確定払戻テーブルから券種・買い目の払戻円を探す（無ければ null） */
export function findPayoutYen(
  result: RaceResult | undefined,
  betType: BetType,
  selection: string,
): number | null {
  if (!result?.payouts?.length) return null;
  const key = payoutNormKey(betType, selection);
  const hit = result.payouts.find((p) => payoutNormKey(p.betType, p.selection) === key);
  return hit ? hit.payoutYen : null;
}
