/**
 * 3連複コンボ指数 v1（人気×人気×穴）。
 * hit = 0.45·pairPrior + 0.35·holePrior + 0.20·holePlace
 * ev  = hit × clip(odds, 100, 400) / 150
 *
 * pair/hole は 100倍以上の同型決着（スナップ 513R 中 157R）から仮置き。
 * 下限合成は使わない。scoreMin のゲートはセレクタ側の min(place) のまま。
 */

/** 万馬券モード: 2-4=100。1-3 は当たりやすいが安いので下げる */
export const PAIR_PRIOR_VALUE = {
  "1-2": 86,
  "1-3": 27,
  "1-4": 73,
  "1-5": 91,
  "2-3": 77,
  "2-4": 100,
  "2-5": 54,
  "3-4": 64,
  "3-5": 73,
  "4-5": 69,
};

/** 万馬券モード: 7人気=100。11+は0にしない */
export const HOLE_PRIOR_VALUE = {
  6: 80,
  7: 100,
  8: 52,
  9: 68,
  10: 76,
  11: 64,
  12: 48,
  13: 28,
  14: 56,
  15: 36,
  16: 12,
  17: 8,
  18: 8,
};

export const TRIO_HIT_WEIGHTS = {
  pair: 0.45,
  holePop: 0.35,
  holePlace: 0.2,
};

export const TRIO_EV_ODDS_MIN = 100;
export const TRIO_EV_ODDS_MAX = 400;
export const TRIO_EV_ODDS_REF = 150;

/** レース内 ev 上位この件数を「研究所注目」 */
export const TRIO_WATCH_TOP_N = 3;

const PAIR_PRIOR_FALLBACK = 40;
const HOLE_PRIOR_FALLBACK = 8;

export function pairPriorValue(popA, popB) {
  const a = Math.min(popA, popB);
  const b = Math.max(popA, popB);
  const key = `${a}-${b}`;
  return PAIR_PRIOR_VALUE[key] ?? PAIR_PRIOR_FALLBACK;
}

export function holePriorValue(holePop) {
  if (holePop <= 5) return HOLE_PRIOR_FALLBACK;
  if (HOLE_PRIOR_VALUE[holePop] != null) return HOLE_PRIOR_VALUE[holePop];
  return HOLE_PRIOR_FALLBACK;
}

export function scalePlaceInRace(place, racePlaces) {
  if (!racePlaces?.length) return 50;
  let min = racePlaces[0];
  let max = racePlaces[0];
  for (const p of racePlaces) {
    if (p < min) min = p;
    if (p > max) max = p;
  }
  if (max <= min) return 50;
  return ((place - min) / (max - min)) * 100;
}

export function clipTrioEvOdds(odds) {
  if (!Number.isFinite(odds)) return TRIO_EV_ODDS_MIN;
  if (odds < TRIO_EV_ODDS_MIN) return TRIO_EV_ODDS_MIN;
  if (odds > TRIO_EV_ODDS_MAX) return TRIO_EV_ODDS_MAX;
  return odds;
}

export function trioHitScore({
  favPopA,
  favPopB,
  holePop,
  holePlace,
  racePlaces,
}) {
  const pair = pairPriorValue(favPopA, favPopB);
  const hole = holePriorValue(holePop);
  const place = scalePlaceInRace(holePlace, racePlaces);
  const hit =
    TRIO_HIT_WEIGHTS.pair * pair +
    TRIO_HIT_WEIGHTS.holePop * hole +
    TRIO_HIT_WEIGHTS.holePlace * place;
  return Number(hit.toFixed(1));
}

export function trioEvScore(hit, odds) {
  if (odds == null || !Number.isFinite(odds)) return hit;
  const clipped = clipTrioEvOdds(odds);
  return Number(((hit * clipped) / TRIO_EV_ODDS_REF).toFixed(1));
}

export function comboSortScore(pick) {
  if (typeof pick?.evScore === "number") return pick.evScore;
  return pick?.relatedScore ?? 0;
}
