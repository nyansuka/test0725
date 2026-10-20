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

/**
 * 単勝だけこの値未満（2026-10-13）。
 * 21開催で 40 倍以上は複勝圏 5.1%・券種的中 0.66%。25–40 倍は 11.0% / 2.62%。
 */
export const WIN_ODDS_MAX = 40;

/**
 * ワイドだけこの値未満（2026-10-20）。
 * 8/15–10/18 の 17 開催で 50–80 倍は 3/583・回収 31%。
 * 同じ帯の枠連は 136%、馬連は 115% なので共通上限は動かさない。
 */
export const WIDE_ODDS_MAX = 50;

/** 共通上限を超える、単勝が {@link WIN_ODDS_MAX} 以上、またはワイドが {@link WIDE_ODDS_MAX} 以上。 */
export function isAboveOddsCap(
  betType: BetType | string,
  odds: number,
  oddsMax: number | null,
): boolean {
  if (oddsMax != null && odds > oddsMax) return true;
  if (betType === "win" && odds >= WIN_ODDS_MAX) return true;
  if (betType === "wide" && odds >= WIDE_ODDS_MAX) return true;
  return false;
}

export const DEFAULT_SETTINGS = {
  oddsThreshold: 25,
  /** B3: 上限80（感度スイープ推奨。null で上限なし）。単勝は WIN_ODDS_MAX 未満、ワイドは WIDE_ODDS_MAX 未満 */
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
