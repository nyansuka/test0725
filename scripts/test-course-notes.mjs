/**
 * 阪神コース参考と枠オーバーレイのユニット確認。
 *   node scripts/test-course-notes.mjs
 */
import assert from "node:assert/strict";
import {
  courseProfile,
  courseNoteLines,
  gateOverlayDelta,
  GATE_OVERLAY_MAX,
  isFrontBiasedCourse,
  parseDistanceMeters,
} from "../src/domain/courseNotes.mjs";
import { trackGateBiasScore } from "../src/domain/scoring/trackGateBias.mjs";
import { isFrontBiasedCourse as favFront } from "../src/domain/dangerousFavorite.mjs";

assert.equal(parseDistanceMeters("芝1200m"), 1200);
assert.equal(parseDistanceMeters("ダート1800m"), 1800);
assert.equal(courseProfile("東京", "芝", "芝1600m"), null);
assert.equal(courseNoteLines("東京", "芝", "芝1600m").length, 0);

const t1200 = courseProfile("阪神", "芝", "芝1200m");
assert.ok(t1200);
assert.equal(t1200.scoreInGate, true);
assert.equal(t1200.frontBias, true);
assert.ok(t1200.summary.includes("内回り"));
assert.ok(t1200.bullets.some((b) => b.includes("243")));

const t1600 = courseProfile("阪神", "芝", "芝1600m");
assert.equal(t1600?.scoreInGate, false);
assert.equal(t1600?.frontBias, false);

const t1800 = courseProfile("阪神", "芝", "芝1800m");
assert.equal(t1800?.gate.mode, "flatten");

assert.equal(isFrontBiasedCourse("新潟", "芝", "芝1800m"), true);
assert.equal(isFrontBiasedCourse("新潟", "ダート", "ダート1800m"), false);
assert.equal(favFront("阪神", "芝", "芝1200m"), true);
assert.equal(favFront("阪神", "芝", "芝1600m"), false);
assert.equal(favFront("阪神", "芝", "芝2200m"), false);
assert.equal(favFront("阪神", "ダート", "ダート1800m"), true);
assert.equal(favFront("東京", "芝", "芝1600m"), false);

assert.equal(trackGateBiasScore("芝", 1), 62);
assert.equal(trackGateBiasScore("芝", 8), 54);
assert.equal(trackGateBiasScore("ダート", 8), 62);
assert.equal(trackGateBiasScore("ダート", 2), 54);

const hsInner = trackGateBiasScore("芝", 1, "阪神", "芝1200m");
const hsOuter = trackGateBiasScore("芝", 8, "阪神", "芝1200m");
assert.equal(hsInner, 65);
assert.equal(hsOuter, 52);
assert.ok(hsInner - 62 <= GATE_OVERLAY_MAX);
assert.ok(54 - hsOuter <= GATE_OVERLAY_MAX);

assert.equal(trackGateBiasScore("芝", 1, "阪神", "芝1600m"), 62);
assert.equal(trackGateBiasScore("芝", 8, "阪神", "芝1600m"), 54);

const flatInner = trackGateBiasScore("芝", 1, "阪神", "芝1800m");
const flatOuter = trackGateBiasScore("芝", 8, "阪神", "芝1800m");
assert.equal(flatInner, 58);
assert.equal(flatOuter, 56);

const d18mid = trackGateBiasScore("ダート", 5, "阪神", "ダート1800m");
const d18wide = trackGateBiasScore("ダート", 8, "阪神", "ダート1800m");
assert.equal(d18mid, 58);
assert.equal(d18wide, 58);

assert.ok(Math.abs(gateOverlayDelta("芝", 1, "阪神", "芝1200m")) <= GATE_OVERLAY_MAX);
assert.equal(gateOverlayDelta("芝", 1, "東京", "芝1600m"), 0);

const tokyoUnchanged = trackGateBiasScore("芝", 1, "東京", "芝1600m");
assert.equal(tokyoUnchanged, 62);

console.log("course-notes: ok");
