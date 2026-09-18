export type FormPaceClass = "high" | "mid" | "slow";
export type FormTripClass = "front" | "mid" | "back";

export type FormStatsInput = {
  lastRank?: number | null;
  lastPopularity?: number | null;
  avgSameRank?: number | null;
  lastFieldSize?: number | null;
  lastBracket?: number | null;
  lastVenue?: string | null;
  lastTrack?: "芝" | "ダート" | string | null;
  lastDistanceLabel?: string | null;
  lastPassFirst?: number | null;
  lastPassLast?: number | null;
  lastPaceFrontSec?: number | null;
  lastPaceBackSec?: number | null;
  lastLast3fSec?: number | null;
};

export function clampScore(n: number, min?: number, max?: number): number;
export const FORM_SIGNAL_NEUTRAL: number;
export function valueGapFromPopularity(popularity: number | null | undefined): number;
export function classifyPace(
  frontSec: number | null | undefined,
  backSec: number | null | undefined,
): FormPaceClass | null;
export function classifyTrip(
  passFirst: number | null | undefined,
  fieldSize: number | null | undefined,
): FormTripClass | null;
export function formContextAdjust(fs: FormStatsInput | null | undefined): number;
export function formContextLabel(fs: FormStatsInput | null | undefined): string;
export function formSignalFromFormStats(fs: FormStatsInput | null | undefined): number | null;
export function winFormBoostFromStats(fs: FormStatsInput | null | undefined): number;
