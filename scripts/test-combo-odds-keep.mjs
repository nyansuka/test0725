/**
 * 3連系の板間引き（最高オッズ順をやめる）の回帰。
 *   node scripts/test-combo-odds-keep.mjs
 */
import assert from "node:assert/strict";
import {
  DEFAULT_COMBO_KEEP,
  TRIO_COMBO_KEEP,
  TRIFECTA_COMBO_KEEP,
  comboKeepPolicy,
  keepComboOdds,
} from "./lib/combo-odds-keep.mjs";

function entry(betType, selection, odds) {
  return { betType, selection, odds };
}

{
  assert.deepEqual(comboKeepPolicy("quinella"), DEFAULT_COMBO_KEEP);
  assert.deepEqual(comboKeepPolicy("trio"), TRIO_COMBO_KEEP);
  assert.deepEqual(comboKeepPolicy("trifecta"), TRIFECTA_COMBO_KEEP);
}

{
  const rows = [
    entry("quinella", "1-2", 5),
    entry("quinella", "1-3", 12),
    entry("quinella", "1-4", 40),
    entry("quinella", "1-5", 90),
    entry("quinella", "1-6", 200),
  ];
  const kept = keepComboOdds(rows, DEFAULT_COMBO_KEEP);
  assert.equal(kept.length, 4, "odds<8 dropped");
  assert.deepEqual(
    kept.map((e) => e.selection),
    ["1-6", "1-5", "1-4", "1-3"],
    "default keeps highest first",
  );
}

{
  const many = Array.from({ length: 50 }, (_, i) =>
    entry("quinella", `1-${i + 2}`, 8 + i),
  );
  const kept = keepComboOdds(many, DEFAULT_COMBO_KEEP);
  assert.equal(kept.length, 40);
  assert.equal(kept[0].odds, 57);
  assert.equal(kept[39].odds, 18);
}

{
  const rows = [
    entry("trio", "1-2-3", 40),
    entry("trio", "1-2-4", 80),
    entry("trio", "1-2-5", 100),
    entry("trio", "1-2-6", 223),
    entry("trio", "1-2-7", 400),
    entry("trio", "1-2-8", 401),
    entry("trio", "1-2-9", 592),
  ];
  const kept = keepComboOdds(rows, TRIO_COMBO_KEEP);
  assert.deepEqual(
    kept.map((e) => e.selection),
    ["1-2-4", "1-2-5", "1-2-6", "1-2-7"],
    "trio keeps 80-400 cheapest-first; drops tail and sub-gate",
  );
}

{
  const rows = [
    entry("trifecta", "1-2-3", 100),
    entry("trifecta", "1-2-4", 150),
    entry("trifecta", "1-2-5", 190),
    entry("trifecta", "1-2-6", 800),
    entry("trifecta", "1-2-7", 833),
    entry("trifecta", "1-2-8", 1514),
  ];
  const kept = keepComboOdds(rows, TRIFECTA_COMBO_KEEP);
  assert.deepEqual(
    kept.map((e) => e.selection),
    ["1-2-4", "1-2-5", "1-2-6"],
    "trifecta keeps 150-800 cheapest-first",
  );
}

{
  const many = Array.from({ length: 180 }, (_, i) =>
    entry("trio", `1-2-${i + 3}`, 80 + i),
  );
  const kept = keepComboOdds(many, TRIO_COMBO_KEEP);
  assert.equal(kept.length, 150);
  assert.equal(kept[0].odds, 80);
  assert.equal(kept[149].odds, 229);
  assert.ok(
    !kept.some((e) => e.odds > 400),
    "trio cap still respects maxOdds",
  );
}

{
  const winner = entry("trio", "4-9-10", 223);
  const tail = Array.from({ length: 40 }, (_, i) =>
    entry("trio", `10-11-${i + 1}`, 631 + i),
  );
  const kept = keepComboOdds([winner, ...tail], TRIO_COMBO_KEEP);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].selection, "4-9-10");
}

console.log("OK combo-odds-keep: default desc40 / trio 80-400 asc / trifecta 150-800 asc");
