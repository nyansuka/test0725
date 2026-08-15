/**
 * 3連複コンボ指数 v1 の回帰。
 *   node scripts/test-sanren-trio-index.mjs
 */
import assert from "node:assert/strict";
import {
  PAIR_PRIOR_VALUE,
  clipTrioEvOdds,
  holePriorValue,
  pairPriorValue,
  scalePlaceInRace,
  trioEvScore,
  trioHitScore,
} from "../src/domain/sanrenTrioIndex.mjs";

assert.equal(pairPriorValue(2, 4), 100);
assert.equal(pairPriorValue(4, 2), 100);
assert.equal(pairPriorValue(1, 3), 27);
assert.ok(pairPriorValue(1, 2) < PAIR_PRIOR_VALUE["2-4"]);
assert.equal(pairPriorValue(9, 10), 40, "unknown pair falls back");

assert.equal(holePriorValue(7), 100);
assert.ok(holePriorValue(11) > 0, "11+ must not be zero");
assert.equal(holePriorValue(18), 8);
assert.equal(holePriorValue(3), 8);

assert.equal(scalePlaceInRace(50, [0, 100]), 50);
assert.equal(scalePlaceInRace(80, [80, 80, 80]), 50);
assert.ok(scalePlaceInRace(90, [10, 90]) > scalePlaceInRace(20, [10, 90]));

assert.equal(clipTrioEvOdds(80), 100);
assert.equal(clipTrioEvOdds(150), 150);
assert.equal(clipTrioEvOdds(900), 400);

const hit24 = trioHitScore({
  favPopA: 2,
  favPopB: 4,
  holePop: 7,
  holePlace: 80,
  racePlaces: [40, 80, 90],
});
const hit13 = trioHitScore({
  favPopA: 1,
  favPopB: 3,
  holePop: 7,
  holePlace: 80,
  racePlaces: [40, 80, 90],
});
assert.ok(hit24 > hit13, "万馬券モードでは 2-4 が 1-3 より高い");

const ev150 = trioEvScore(60, 150);
const ev100 = trioEvScore(60, 100);
const ev400 = trioEvScore(60, 400);
const ev900 = trioEvScore(60, 900);
assert.equal(ev150, 60);
assert.ok(ev100 < ev150);
assert.ok(ev400 > ev150);
assert.equal(ev400, ev900, "500+ is clipped to 400");

console.log("OK sanren-trio-index: pair 2-4>1-3, hole 11+>0, ev clip 100-400");
