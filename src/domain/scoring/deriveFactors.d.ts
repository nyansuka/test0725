export function clampScore(n: number, min?: number, max?: number): number;
export const FORM_SIGNAL_NEUTRAL: number;
export function valueGapFromPopularity(popularity: number | null | undefined): number;
export function formSignalFromFormStats(fs: {
  lastRank?: number | null;
  lastPopularity?: number | null;
  avgSameRank?: number | null;
} | null | undefined): number | null;
