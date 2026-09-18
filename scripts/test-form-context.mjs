/**
 * 前走着順のラップ／通過／枠読み替え。
 *   node scripts/test-form-context.mjs
 */
import assert from "node:assert/strict";
import {
  classifyPace,
  classifyTrip,
  formContextAdjust,
  formContextLabel,
  formSignalFromFormStats,
  winFormBoostFromStats,
} from "../src/domain/scoring/deriveFactors.mjs";

assert.equal(classifyPace(34.8, 36.0), "high");
assert.equal(classifyPace(36.0, 34.8), "slow");
assert.equal(classifyPace(35.0, 35.2), "mid");
assert.equal(classifyPace(null, 35), null);

assert.equal(classifyTrip(1, 16), "front");
assert.equal(classifyTrip(12, 16), "back");
assert.equal(classifyTrip(6, 16), "mid");

const baseFs = {
  lastRank: 5,
  lastPopularity: 8,
  avgSameRank: null,
};
const rankOnly = formSignalFromFormStats(baseFs);

const againstSlow = formSignalFromFormStats({
  ...baseFs,
  lastPaceFrontSec: 36.2,
  lastPaceBackSec: 35.0,
  lastPassFirst: 12,
  lastFieldSize: 16,
});
assert.ok(
  againstSlow > rankOnly,
  `スロー後方の5着は着順以上: ${againstSlow} vs ${rankOnly}`,
);
assert.ok(formContextLabel({
  lastRank: 5,
  lastPaceFrontSec: 36.2,
  lastPaceBackSec: 35.0,
  lastPassFirst: 12,
  lastFieldSize: 16,
}).includes("着順以上"));

const easyFront = formSignalFromFormStats({
  lastRank: 1,
  lastPopularity: 1,
  lastPaceFrontSec: 36.2,
  lastPaceBackSec: 35.0,
  lastPassFirst: 1,
  lastFieldSize: 16,
});
const rawWin = formSignalFromFormStats({
  lastRank: 1,
  lastPopularity: 1,
});
assert.ok(easyFront < rawWin, `スロー先行の楽勝ちは着順ほど評価しない: ${easyFront} vs ${rawWin}`);

const highFrontHold = formContextAdjust({
  lastRank: 3,
  lastPaceFrontSec: 34.5,
  lastPaceBackSec: 36.0,
  lastPassFirst: 2,
  lastFieldSize: 14,
});
assert.ok(highFrontHold >= 6, `ハイペース先行の粘り: ${highFrontHold}`);

const wideTurf = formContextAdjust({
  lastRank: 3,
  lastTrack: "芝",
  lastBracket: 8,
  lastVenue: "東京",
  lastDistanceLabel: "芝1600m",
});
assert.ok(wideTurf >= 4, `芝外枠の好走: ${wideTurf}`);

assert.equal(formSignalFromFormStats(null), null);
assert.equal(formContextAdjust({ lastRank: null }), 0);

const winEasy = winFormBoostFromStats({
  lastRank: 1,
  lastPaceFrontSec: 36.2,
  lastPaceBackSec: 35.0,
  lastPassFirst: 1,
  lastFieldSize: 16,
});
const winRaw = winFormBoostFromStats({ lastRank: 1 });
assert.ok(winEasy < winRaw, "軸補正もスロー先行の楽勝ちは抑える");

console.log("OK form-context: pace/trip/gate reread");
