export const PAIR_PRIOR_VALUE: Record<string, number>;
export const HOLE_PRIOR_VALUE: Record<number, number>;
export const TRIO_HIT_WEIGHTS: { pair: number; holePop: number; holePlace: number };
export const TRIO_EV_ODDS_MIN: number;
export const TRIO_EV_ODDS_MAX: number;
export const TRIO_EV_ODDS_REF: number;
export const TRIO_WATCH_TOP_N: number;

export function pairPriorValue(popA: number, popB: number): number;
export function holePriorValue(holePop: number): number;
export function scalePlaceInRace(place: number, racePlaces: number[]): number;
export function clipTrioEvOdds(odds: number): number;
export function trioHitScore(input: {
  favPopA: number;
  favPopB: number;
  holePop: number;
  holePlace: number;
  racePlaces: number[];
}): number;
export function trioEvScore(hit: number, odds: number | null | undefined): number;
export function comboSortScore(pick: { evScore?: number; relatedScore?: number }): number;
