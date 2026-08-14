import type { BetType } from "./types";

export const ALL_BET_TYPES: BetType[] = [
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

export const BET_TYPE_LABELS: Record<BetType, string> = {
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

export const DEFAULT_SETTINGS = {
  oddsThreshold: 25,
  /** B3: 上限80（感度スイープ推奨。null で上限なし） */
  oddsMax: 80 as number | null,
  /**
   * 2026-08-13: 60→65（VERIFY 8/9 の次の1変更）。
   * 70 は注目穴帯 [65,70) をボードから消し、密度 1.3 で過厳選。
   */
  scoreMin: 65,
  enabledBetTypes: [...ALL_BET_TYPES] as BetType[],
};

/** 買い目文字列から関係馬番を抽出（枠連は枠番として扱い、呼び出し側で馬に解決） */
export function parseSelectionNumbers(selection: string): number[] {
  return selection
    .split(/[-–—/]/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}
