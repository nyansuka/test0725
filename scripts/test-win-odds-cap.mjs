/**
 * 単勝は 40 倍未満。ワイドは 50 倍未満。他券種は共通上限のまま。
 *   node scripts/test-win-odds-cap.mjs
 */
import assert from "node:assert/strict";
import { classifyOddsEntry, DEFAULT_SETTINGS } from "./lib/loop-domain.mjs";

const race = { id: "t", horses: [] };
const settings = { ...DEFAULT_SETTINGS, oddsThreshold: 25, oddsMax: 80, scoreMin: 65 };

function status(betType, odds) {
  return classifyOddsEntry(race, { betType, selection: "1", odds }, settings).status;
}

assert.equal(status("win", 39.9), "no_related");
assert.equal(status("win", 40), "above_max");
assert.equal(status("win", 79), "above_max");
assert.equal(status("win", 24), "below_threshold");
assert.equal(status("quinella", 79), "no_related");
assert.equal(status("wide", 35.6), "no_related");
assert.equal(status("wide", 49.9), "no_related");
assert.equal(status("wide", 50), "above_max");
assert.equal(status("wide", 79), "above_max");
assert.equal(status("bracket_quinella", 79), "no_related");
assert.equal(status("quinella", 81), "above_max");

const open = { ...settings, oddsMax: null };
assert.equal(
  classifyOddsEntry(race, { betType: "win", selection: "1", odds: 50 }, open).status,
  "above_max",
);
assert.equal(
  classifyOddsEntry(race, { betType: "quinella", selection: "1-2", odds: 50 }, open).status,
  "no_related",
);
assert.equal(
  classifyOddsEntry(race, { betType: "wide", selection: "1-2", odds: 50 }, open).status,
  "above_max",
);
assert.equal(
  classifyOddsEntry(race, { betType: "wide", selection: "1-2", odds: 49.9 }, open).status,
  "no_related",
);

console.log("win odds cap ok");
