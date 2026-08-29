/**
 * スコア外補足ノートのユニット確認。
 *   node --experimental-strip-types scripts/test-supplement-notes.mts
 */
import assert from "node:assert/strict";
import {
  buildSupplementNotes,
  isStayRaceVenue,
  isSummerRaceDate,
} from "../src/domain/supplementNotes.ts";

assert.equal(isStayRaceVenue("函館"), true);
assert.equal(isStayRaceVenue("札幌"), true);
assert.equal(isStayRaceVenue("小倉"), true);
assert.equal(isStayRaceVenue("東京"), false);

assert.equal(isSummerRaceDate("2026-08-23"), true);
assert.equal(isSummerRaceDate("2026-06-01"), true);
assert.equal(isSummerRaceDate("2026-01-05"), false);

const hakodate = buildSupplementNotes({ venue: "函館", raceDate: "2026-08-23" });
assert.equal(hakodate.scoreExcluded, true);
assert.equal(hakodate.raceHints.length, 2);
assert.ok(hakodate.workout.items.length >= 4);
assert.ok(hakodate.weight.items.some((s) => s.includes("2桁")));
assert.ok(hakodate.weight.items.some((s) => s.includes("−20kg")));

const tokyo = buildSupplementNotes({ venue: "東京", raceDate: "2026-01-05" });
assert.equal(tokyo.raceHints.length, 0);

console.log("supplement-notes: ok");
