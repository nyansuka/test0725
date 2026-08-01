import type { BetType } from "./types";

export const ALL_BET_TYPES: BetType[] = [
  "win",
  "place",
  "bracket_quinella",
  "quinella",
  "wide",
  "exacta",
  "trio",
  "trifecta",
];

export const BET_TYPE_LABELS: Record<BetType, string> = {
  win: "単勝",
  place: "複勝",
  bracket_quinella: "枠連",
  quinella: "馬連",
  wide: "ワイド",
  exacta: "馬単",
  trio: "3連複",
  trifecta: "3連単",
};

export const DEFAULT_SETTINGS = {
  oddsThreshold: 25,
  scoreMin: 75,
  enabledBetTypes: [...ALL_BET_TYPES] as BetType[],
};

/** 買い目文字列から関係馬番を抽出（枠連は枠番として扱い、呼び出し側で馬に解決） */
export function parseSelectionNumbers(selection: string): number[] {
  return selection
    .split(/[-–—/]/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}
