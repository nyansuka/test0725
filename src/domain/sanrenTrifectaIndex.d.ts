export const TRIFECTA_HIT_WEIGHTS: {
  axisWin: number;
  secondPlace: number;
  thirdPlace: number;
};
export const TRIFECTA_EV_ODDS_MIN: number;
export const TRIFECTA_EV_ODDS_MAX: number;
export const TRIFECTA_EV_ODDS_REF: number;
export const TRIFECTA_WATCH_TOP_N: number;

export function clipTrifectaEvOdds(odds: number): number;
export function trifectaHitScore(input: {
  axisWin: number;
  secondPlace: number;
  thirdPlace: number;
}): number;
export function trifectaEvScore(hit: number, odds: number | null | undefined): number;
