/**
 * 3連単コンボ指数 v1 の回帰。
 *   node scripts/test-sanren-trifecta-index.mjs
 */
import assert from "node:assert/strict";
import {
  TRIFECTA_WATCH_TOP_N,
  clipTrifectaEvOdds,
  trifectaEvScore,
  trifectaHitScore,
} from "../src/domain/sanrenTrifectaIndex.mjs";

assert.equal(TRIFECTA_WATCH_TOP_N, 3);

assert.equal(clipTrifectaEvOdds(150), 200);
assert.equal(clipTrifectaEvOdds(300), 300);
assert.equal(clipTrifectaEvOdds(900), 500);

const strongAxis = trifectaHitScore({ axisWin: 90, secondPlace: 70, thirdPlace: 60 });
const weakAxis = trifectaHitScore({ axisWin: 50, secondPlace: 90, thirdPlace: 90 });
assert.ok(strongAxis > weakAxis, "axisWin を主にする");

const secondBetter = trifectaHitScore({ axisWin: 70, secondPlace: 90, thirdPlace: 50 });
const thirdBetter = trifectaHitScore({ axisWin: 70, secondPlace: 50, thirdPlace: 90 });
assert.ok(secondBetter > thirdBetter, "2着 place を3着より重くする");

const ev250 = trifectaEvScore(50, 250);
const ev200 = trifectaEvScore(50, 200);
const ev500 = trifectaEvScore(50, 500);
const ev900 = trifectaEvScore(50, 900);
assert.equal(ev250, 50);
assert.ok(ev200 < ev250);
assert.ok(ev500 > ev250);
assert.equal(ev500, ev900, "500+ is clipped");

console.log("OK sanren-trifecta-index: axis>legs, 2nd>3rd, ev clip 200-500");
