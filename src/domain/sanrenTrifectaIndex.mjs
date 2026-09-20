/**
 * 3連単コンボ指数 v1（1着固定 formation）。
 * hit = 0.50·axisWin + 0.30·secondPlace + 0.20·thirdPlace
 * ev  = hit × clip(odds, 200, 500) / 250
 *
 * 研究所注目 = レース内 ev 上位 TRIFECTA_WATCH_TOP_N。
 * HOT_SCORE（place下限の [65,70)）は使わない。
 */

export const TRIFECTA_HIT_WEIGHTS = {
  axisWin: 0.5,
  secondPlace: 0.3,
  thirdPlace: 0.2,
};

export const TRIFECTA_EV_ODDS_MIN = 200;
export const TRIFECTA_EV_ODDS_MAX = 500;
export const TRIFECTA_EV_ODDS_REF = 250;

/** レース内 ev 上位この件数を「研究所注目」 */
export const TRIFECTA_WATCH_TOP_N = 3;

export function clipTrifectaEvOdds(odds) {
  if (!Number.isFinite(odds)) return TRIFECTA_EV_ODDS_MIN;
  if (odds < TRIFECTA_EV_ODDS_MIN) return TRIFECTA_EV_ODDS_MIN;
  if (odds > TRIFECTA_EV_ODDS_MAX) return TRIFECTA_EV_ODDS_MAX;
  return odds;
}

export function trifectaHitScore({ axisWin, secondPlace, thirdPlace }) {
  const hit =
    TRIFECTA_HIT_WEIGHTS.axisWin * (axisWin ?? 0) +
    TRIFECTA_HIT_WEIGHTS.secondPlace * (secondPlace ?? 0) +
    TRIFECTA_HIT_WEIGHTS.thirdPlace * (thirdPlace ?? 0);
  return Number(hit.toFixed(1));
}

export function trifectaEvScore(hit, odds) {
  if (odds == null || !Number.isFinite(odds)) return hit;
  const clipped = clipTrifectaEvOdds(odds);
  return Number(((hit * clipped) / TRIFECTA_EV_ODDS_REF).toFixed(1));
}
