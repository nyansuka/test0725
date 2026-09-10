import type { BetType, Horse, Race, RaceResult } from "./types";
import { parseSelectionNumbers } from "./betTypes";
import {
  formatWinOdds,
  oddsFromPayoutYen,
  placeOddsLabel,
  popularityByNumber,
} from "./odds";

/** 複勝圏ベースの結果判定（券種の厳密払戻とは別） */
export type PickOutcome = "win" | "place" | "miss" | "pending";

export function isInMoney(outcome: PickOutcome): boolean {
  return outcome === "win" || outcome === "place";
}

export function outcomeLabel(outcome: PickOutcome): string {
  switch (outcome) {
    case "win":
      return "1着";
    case "place":
      return "複勝圏";
    case "miss":
      return "圏外";
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
 * 関係馬の着順判定（券種払戻とは別。参考表示・ループ互換）
 * - 1着 → win
 * - 2・3着 → place
 * - 4着以下 → miss
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
    bracket_exacta: "枠単",
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
  const unordered = new Set<BetType>(["quinella", "wide", "bracket_quinella", "trio"]);
  const legs = unordered.has(betType) ? [...nums].sort((a, b) => a - b) : nums;
  return `${betType}:${legs.join("-")}`;
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

type TicketOddsLike = {
  betType: BetType;
  selection: string;
  odds?: number | null;
};

/**
 * 画面に出す買い目オッズ。的中時は確定払戻（100円あたり）に合わせる。
 * 板なし（odds == null）は集計どおり板なしのまま。凍結オッズ自体は変えない。
 */
export function displayTicketOdds(
  pick: TicketOddsLike,
  result: RaceResult | undefined,
): number | null {
  if (pick.odds == null) return null;
  const yen = findPayoutYen(result, pick.betType, pick.selection);
  if (yen != null && yen > 0) return oddsFromPayoutYen(yen);
  return pick.odds;
}

/** 単勝の画面表示。1着払戻があれば確定オッズ、なければ公開オッズ。 */
export function displayHorseWinOdds(
  horse: Pick<Horse, "number" | "oddsWin">,
  race: Race | undefined,
): number {
  const yen = findPayoutYen(race?.result, "win", String(horse.number));
  if (yen != null && yen > 0) return oddsFromPayoutYen(yen);
  return horse.oddsWin;
}

/** 複勝の画面表示。複勝払戻があれば確定、なければ公開レンジ。 */
export function displayHorsePlaceOddsLabel(
  horse: Horse,
  race: Race | undefined,
): string {
  const yen = findPayoutYen(race?.result, "place", String(horse.number));
  if (yen != null && yen > 0) return formatWinOdds(oddsFromPayoutYen(yen));
  return placeOddsLabel(horse, race);
}

/** 人気の画面表示。確定着順の人気があればそれを使い、なければ公開オッズ順。 */
export function displayPopularityMap(race: Race): Map<number, number> {
  const fromOdds = popularityByNumber(race.horses);
  if (!race.result?.finishes?.length) return fromOdds;
  const map = new Map(fromOdds);
  for (const finish of race.result.finishes) {
    if (finish.popularity != null) map.set(finish.number, finish.popularity);
  }
  return map;
}

/** 券種払戻ベース。ヒット＝その券種の買い目が的中 */
export type TicketOutcome = "hit" | "miss" | "pending";

type TicketPickLike = {
  betType: BetType;
  selection: string;
};

export function evaluateTicket(
  pick: TicketPickLike,
  result: RaceResult | undefined,
): TicketOutcome {
  if (!result?.finishes?.length) return "pending";
  const yen = findPayoutYen(result, pick.betType, pick.selection);
  if (yen != null && yen > 0) return "hit";
  return "miss";
}

export function ticketOutcomeLabel(outcome: TicketOutcome): string {
  switch (outcome) {
    case "hit":
      return "ヒット";
    case "miss":
      return "はずれ";
    default:
      return "待ち";
  }
}

export function formatTicketOutcome(
  pick: TicketPickLike,
  result: RaceResult | undefined,
): { outcome: TicketOutcome; label: string } {
  const outcome = evaluateTicket(pick, result);
  if (outcome === "hit") {
    const yen = findPayoutYen(result, pick.betType, pick.selection);
    return {
      outcome,
      label: yen != null ? `ヒット · ¥${yen.toLocaleString("ja-JP")}` : "ヒット",
    };
  }
  return { outcome, label: ticketOutcomeLabel(outcome) };
}

export type TicketHitSummary = {
  total: number;
  settled: number;
  hits: number;
  misses: number;
  pending: number;
  hitRatePercent: number | null;
};

/** 表示中の買い目を券種払戻で集計する（ヒット＝その券種の的中） */
export function summarizeTicketHits(
  picks: { raceId: string; betType: BetType; selection: string }[],
  raceById: Map<string, Race>,
): TicketHitSummary {
  let hits = 0;
  let misses = 0;
  let pending = 0;
  for (const pick of picks) {
    const outcome = evaluateTicket(pick, raceById.get(pick.raceId)?.result);
    if (outcome === "pending") pending += 1;
    else if (outcome === "hit") hits += 1;
    else misses += 1;
  }
  const total = picks.length;
  const settled = hits + misses;
  return {
    total,
    settled,
    hits,
    misses,
    pending,
    hitRatePercent: settled === 0 ? null : Math.round((hits / settled) * 1000) / 10,
  };
}
