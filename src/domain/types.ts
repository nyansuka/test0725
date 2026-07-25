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

export type Horse = {
  number: number;
  bracket?: number;
  name: string;
  jockey: string;
  oddsWin: number;
  oddsPlace?: { min: number; max: number };
  /** 事前埋め込み可。未設定時は Scorer が算出 */
  placePotential?: number;
  factors: HorseFactors;
  comment: string;
  runningStyle?: "逃" | "先" | "差" | "追";
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
  pendingCount: number;
};

export type JournalSettings = {
  excludePendingFromReturnRate: boolean;
  defaultVirtualStakeYen: number;
};
