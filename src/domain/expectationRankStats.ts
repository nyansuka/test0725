import type {
  LongshotPick,
  Race,
  RaceExpectationRank,
  UserSelectionSettings,
} from "./types";
import { selectLongshots, raceExpectationRank } from "./longshots";
import { evaluatePick, findPayoutYen, isInMoney } from "./results";

export const EXPECTATION_RANKS: RaceExpectationRank[] = ["S", "A", "B", "C", "D"];

export type ExpectationRankBucket = {
  rank: RaceExpectationRank;
  raceCount: number;
  candidates: number;
  settled: number;
  pending: number;
  placeHits: number;
  /** 複勝圏的中率（%）。確定0は null */
  hitRatePercent: number | null;
  stakeYen: number;
  payoutYen: number;
  /** 仮想回収率（%）。投資0は null */
  returnRatePercent: number | null;
  ticketHits: number;
};

export type ExpectationRankStats = {
  settings: Pick<UserSelectionSettings, "oddsThreshold" | "scoreMin">;
  raceCount: number;
  candidateCount: number;
  dates: string[];
  byRank: ExpectationRankBucket[];
  overall: Omit<ExpectationRankBucket, "rank">;
};

const VIRTUAL_STAKE = 100;

function emptyBucket(rank: RaceExpectationRank): ExpectationRankBucket {
  return {
    rank,
    raceCount: 0,
    candidates: 0,
    settled: 0,
    pending: 0,
    placeHits: 0,
    hitRatePercent: null,
    stakeYen: 0,
    payoutYen: 0,
    returnRatePercent: null,
    ticketHits: 0,
  };
}

function finalizeBucket(b: ExpectationRankBucket): ExpectationRankBucket {
  return {
    ...b,
    hitRatePercent:
      b.settled === 0 ? null : Math.round((b.placeHits / b.settled) * 1000) / 10,
    returnRatePercent:
      b.stakeYen === 0 ? null : Math.round((b.payoutYen / b.stakeYen) * 1000) / 10,
  };
}

function accumulatePick(
  bucket: ExpectationRankBucket,
  pick: LongshotPick,
  race: Race | undefined,
) {
  bucket.candidates += 1;
  const outcome = evaluatePick(pick, race?.result);
  if (outcome === "pending") {
    bucket.pending += 1;
    return;
  }
  bucket.settled += 1;
  bucket.stakeYen += VIRTUAL_STAKE;
  if (isInMoney(outcome)) {
    bucket.placeHits += 1;
    const pay = findPayoutYen(race?.result, pick.betType, pick.selection);
    if (pay != null && pay > 0) {
      bucket.ticketHits += 1;
      bucket.payoutYen += pay;
    } else if (outcome === "win" && pick.betType === "win") {
      bucket.ticketHits += 1;
      bucket.payoutYen += Math.round(pick.odds * VIRTUAL_STAKE);
    }
  }
}

/**
 * 現行設定で候補を選別し、レース期待度ランクごとの複勝圏的中率・仮想回収率を集計する。
 * オッズは引数 races の oddsBoard（検証用は凍結オッズ）を使う。
 */
export function summarizeByExpectationRank(
  races: Race[],
  settings: UserSelectionSettings,
): ExpectationRankStats {
  const picks = selectLongshots(races, settings);
  const raceById = new Map(races.map((r) => [r.id, r]));
  const picksByRace = new Map<string, LongshotPick[]>();

  for (const race of races) {
    if (race.authority !== "JRA") continue;
    picksByRace.set(race.id, []);
  }
  for (const pick of picks) {
    const list = picksByRace.get(pick.raceId);
    if (list) list.push(pick);
    else picksByRace.set(pick.raceId, [pick]);
  }

  const buckets = Object.fromEntries(
    EXPECTATION_RANKS.map((r) => [r, emptyBucket(r)]),
  ) as Record<RaceExpectationRank, ExpectationRankBucket>;

  for (const [raceId, racePicks] of picksByRace) {
    const rank = raceExpectationRank(racePicks);
    const bucket = buckets[rank];
    bucket.raceCount += 1;
    const race = raceById.get(raceId);
    for (const pick of racePicks) {
      accumulatePick(bucket, pick, race);
    }
  }

  const byRank = EXPECTATION_RANKS.map((r) => finalizeBucket(buckets[r]));
  const overallAcc = emptyBucket("D");
  for (const b of byRank) {
    overallAcc.raceCount += b.raceCount;
    overallAcc.candidates += b.candidates;
    overallAcc.settled += b.settled;
    overallAcc.pending += b.pending;
    overallAcc.placeHits += b.placeHits;
    overallAcc.stakeYen += b.stakeYen;
    overallAcc.payoutYen += b.payoutYen;
    overallAcc.ticketHits += b.ticketHits;
  }
  const overallFinal = finalizeBucket(overallAcc);
  const { rank: _rank, ...overall } = overallFinal;

  const dates = [...new Set(races.map((r) => r.raceDate))].sort();

  return {
    settings: {
      oddsThreshold: settings.oddsThreshold,
      scoreMin: settings.scoreMin,
    },
    raceCount: races.filter((r) => r.authority === "JRA").length,
    candidateCount: picks.length,
    dates,
    byRank,
    overall,
  };
}
