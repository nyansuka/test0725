import type { BetType } from "./types";
import { ALL_BET_TYPES } from "./betTypes";
import catalogJson from "@/data/loop/hits/catalog.json";
import conditionsJson from "@/data/loop/hits/conditions.json";

export type HitLane = "main" | "trio" | "trifecta";

export type HitHorse = {
  number: number;
  name: string;
  popularity: number | null;
};

export type GatedHit = {
  id: string;
  lane: HitLane;
  raceDate: string;
  raceId: string;
  venue: string;
  raceNumber: number;
  title: string;
  track: string;
  distanceM: number | null;
  distanceBand: string;
  classBand: string;
  fieldSize: number;
  fieldBand: string;
  weather: string | null;
  condition: string | null;
  weekday: string;
  startTime: string | null;
  betType: BetType;
  selection: string;
  horses: HitHorse[];
  odds: number;
  oddsBand: string;
  payoutYen: number;
  score: number | null;
  label: string | null;
  pattern: string | null;
  axisHorseNumber: number | null;
  picked: boolean;
  pickKnown: boolean;
  gateStatus: string;
  settings: {
    oddsThreshold: number;
    oddsMax: number | null;
    scoreMin: number | null;
  };
};

export type ConditionBucket = {
  n: number;
  picked: number;
  payoutYen: number;
  catchRate: number | null;
};

export type LaneCoverage = {
  payouts: number;
  onBoard: number;
  gated: number;
  knownGated: number;
  picked: number;
  boardRate: number | null;
  gateRate: number | null;
  catchRate: number | null;
};

export type LaneConditions = {
  lane: HitLane;
  settings: {
    oddsThreshold: number;
    oddsMax: number | null;
    scoreMin: number | null;
  };
  n: number;
  picked: number;
  missed: number;
  catchRate: number | null;
  payoutYen: number;
  coverage: LaneCoverage;
  byVenue: Record<string, ConditionBucket>;
  byTrack: Record<string, ConditionBucket>;
  byBetType: Record<string, ConditionBucket>;
  byOddsBand: Record<string, ConditionBucket>;
  byClass: Record<string, ConditionBucket>;
  byDistance: Record<string, ConditionBucket>;
  byField: Record<string, ConditionBucket>;
  byWeekday: Record<string, ConditionBucket>;
  byWeather: Record<string, ConditionBucket>;
  byLabel: Record<string, ConditionBucket>;
  byDay: Record<string, ConditionBucket>;
  coverageByBetType?: Record<string, LaneCoverage>;
  byBetTypeDetail?: Record<string, LaneConditions>;
};

export type HitCatalog = {
  builtAt: string | null;
  kind: string;
  note: string;
  scannedDates?: string[];
  dates: string[];
  hitCount: number;
  hits: GatedHit[];
};

export type HitConditions = {
  builtAt: string | null;
  kind: string;
  note: string;
  scannedDates?: string[];
  dates: string[];
  byLane: Record<HitLane, LaneConditions>;
};

export const HIT_LANE_LABELS: Record<HitLane, string> = {
  main: "本体",
  trio: "3連複",
  trifecta: "3連単",
};

export const HIT_LANE_GATES: Record<HitLane, string> = {
  main: "オッズ 25–80（3連系以外）",
  trio: "3連複 ≥100",
  trifecta: "3連単 ≥200",
};

export const MAIN_HIT_BET_TYPES: BetType[] = ALL_BET_TYPES.filter(
  (t) => t !== "trio" && t !== "trifecta",
);

const EMPTY_COVERAGE: LaneCoverage = {
  payouts: 0,
  onBoard: 0,
  gated: 0,
  knownGated: 0,
  picked: 0,
  boardRate: null,
  gateRate: null,
  catchRate: null,
};

function emptyLane(lane: HitLane): LaneConditions {
  return {
    lane,
    settings: { oddsThreshold: 0, oddsMax: null, scoreMin: null },
    n: 0,
    picked: 0,
    missed: 0,
    catchRate: null,
    payoutYen: 0,
    coverage: EMPTY_COVERAGE,
    byVenue: {},
    byTrack: {},
    byBetType: {},
    byOddsBand: {},
    byClass: {},
    byDistance: {},
    byField: {},
    byWeekday: {},
    byWeather: {},
    byLabel: {},
    byDay: {},
  };
}

export function getHitCatalog(): HitCatalog {
  const c = catalogJson as HitCatalog;
  if (!Array.isArray(c?.hits)) {
    return {
      builtAt: null,
      kind: "gated-ticket-hits",
      note: "",
      dates: [],
      hitCount: 0,
      hits: [],
    };
  }
  return c;
}

export function getHitConditions(): HitConditions {
  const c = conditionsJson as HitConditions;
  if (!c?.byLane) {
    return {
      builtAt: null,
      kind: "gated-hit-conditions",
      note: "",
      dates: [],
      byLane: {
        main: emptyLane("main"),
        trio: emptyLane("trio"),
        trifecta: emptyLane("trifecta"),
      },
    };
  }
  return c;
}

export function formatCatchRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatYen(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}
