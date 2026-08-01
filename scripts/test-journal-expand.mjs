/**
 * expandSelectionTickets の回帰テスト。
 *   node scripts/test-journal-expand.mjs
 */
import assert from "node:assert/strict";
import { expandSelectionTickets } from "./lib/journal-expand.mjs";

assert.deepEqual(expandSelectionTickets("quinella", "1-2,3,4"), ["1-2", "1-3", "1-4"]);
assert.deepEqual(expandSelectionTickets("wide", "5=7,8"), ["5-7", "5-8"]);
assert.deepEqual(expandSelectionTickets("exacta", "1-2,3"), ["1-2", "1-3"]);
assert.deepEqual(expandSelectionTickets("quinella", "1-2,3-4"), ["1-2", "3-4"]);
assert.deepEqual(expandSelectionTickets("win", "1,3,5"), ["1", "3", "5"]);
assert.deepEqual(expandSelectionTickets("trio", "1-2-3,4"), ["1-2-3", "1-2-4"]);
assert.deepEqual(expandSelectionTickets("quinella", "7-9"), ["7-9"]);

console.log("OK journal expandSelectionTickets");
