export type Authority = "JRA";

export type BetType =
  | "win"
  | "place"
  | "bracket_quinella"
  | "quinella"
  | "wide"
  | "exacta"
  | "trio"
  | "trifecta";

export type HorseFactors = {
  courseFit: number;
  paceFit: number;
  conditionFit: number;
  formSignal: number;
  valueGap: number;
  gateJockey?: number;
};

/** 過去走から導出した同条件・近況サマリ（fetcher が付与） */
export type HorseFormStats = {
  horseId?: string;
  pastStarts: number;
  /** 同場×同芝ダ×同距離 */
  sameCourseStarts: number;
  /** 同芝ダ×同距離（会場不問のフォールバック含む） */
  sameDistanceStarts?: number;
  /** venue = 同場 / distance = 同距離のみ / none */
  courseMatch?: "venue" | "distance" | "none";
  bestTimeSec: number | null;
  avgSameRank: number | null;
  lastRank: number | null;
  lastPopularity: number | null;
  lastDate: string | null;
};

export type Horse = {
  number: number;
  bracket?: number;
  name: string;
  jockey: string;
  /** netkeiba horse id（成績ページ接続用） */
  horseId?: string;
  oddsWin: number;
  oddsPlace?: { min: number; max: number };
  /** 事前埋め込み可。未設定時は Scorer が算出 */
  placePotential?: number;
  factors: HorseFactors;
  comment: string;
  runningStyle?: "逃" | "先" | "差" | "追";
  /** 同条件タイム等。courseFit / formSignal の根拠 */
  formStats?: HorseFormStats;
};

export type OddsEntry = {
  betType: BetType;
  selection: string;
  odds: number;
};

export type RaceExpectationRank = "S" | "A" | "B" | "C" | "D";

export type HorseFinish = {
  rank: number | null;
  number: number;
  bracket?: number;
  name: string;
  jockey?: string;
  time?: string;
  margin?: string;
  popularity?: number;
  oddsWin?: number;
};

export type PayoutLine = {
  betType: BetType;
  selection: string;
  payoutYen: number;
  popularity?: number;
};

export type RaceResult = {
  status: "official" | "provisional";
  finishedAt?: string;
  finishes: HorseFinish[];
  payouts: PayoutLine[];
};

export type Race = {
  id: string;
  authority: Authority;
  /** 開催日 YYYY-MM-DD（JST） */
  raceDate: string;
  venue: string;
  raceNumber: number;
  title: string;
  distance: string;
  track: "芝" | "ダート";
  startTime: string;
  weather: string;
  condition: string;
  featured?: boolean;
  fieldSize?: number;
  horses: Horse[];
  oddsBoard: OddsEntry[];
  /** netkeiba レースID（12桁）。結果取得用 */
  sourceRaceId?: string;
  /** 確定／速報のレース結果 */
  result?: RaceResult;
};

export type LongshotLabel = "注目穴" | "抑え候補";

export type LongshotPick = {
  raceId: string;
  venue: string;
  raceNumber: number;
  startTime: string;
  track: "芝" | "ダート";
  title: string;
  betType: BetType;
  selection: string;
  odds: number;
  relatedHorseNumbers: number[];
  relatedPlacePotential: number;
  label: LongshotLabel;
  comment: string;
};

export type UserSelectionSettings = {
  oddsThreshold: number;
  /** 上限（この値を超えるオッズは候補外）。null/未設定は無制限 */
  oddsMax: number | null;
  scoreMin: number;
  enabledBetTypes: BetType[];
};

export type Tipster = {
  id: string;
  name: string;
  channelOrMedia?: string;
};

export type BetSlipSource = "self" | "tipster";
export type TipsterKind = "purchased" | "prediction_only";

export type BetSlip = {
  id: string;
  source: BetSlipSource;
  raceId: string;
  betType: BetType;
  selection: string;
  stakeYen: number;
  oddsAtPurchase?: number;
  payoutYen: number | null;
  hit?: boolean;
  tipsterId?: string;
  tipsterKind?: TipsterKind;
  referenceUrl?: string;
  referencedTipsterIds?: string[];
  longshotPickKey?: string;
  note?: string;
  createdAt: string;
  settledAt?: string;
};

export type JournalSummary = {
  from: string;
  to: string;
  sourceFilter: "self" | "tipster" | "all";
  stakeTotal: number;
  payoutTotal: number;
  returnRatePercent: number;
  profitYen: number;
  betCount: number;
  hitCount: number;
  /** 確定件に対する的中率（%）。確定0件は null */
  hitRatePercent: number | null;
  settledCount: number;
  pendingCount: number;
};

export type JournalSettings = {
  excludePendingFromReturnRate: boolean;
  defaultVirtualStakeYen: number;
};
