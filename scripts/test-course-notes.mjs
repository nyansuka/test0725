/**
 * 検証済みコース参考と枠オーバーレイのユニット確認。
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
assert.equal(courseProfile("京都", "芝", "芝1600m"), null);
assert.equal(courseNoteLines("京都", "芝", "芝1600m").length, 0);

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

const nk1200 = courseProfile("中山", "芝", "芝1200m");
assert.ok(nk1200);
assert.equal(nk1200.scoreInGate, true);
assert.equal(nk1200.frontBias, true);
assert.ok(nk1200.summary.includes("外回り"));
assert.ok(nk1200.bullets.some((b) => b.includes("275")));

const nk1600 = courseProfile("中山", "芝", "芝1600m");
assert.equal(nk1600?.scoreInGate, true);
assert.equal(nk1600?.frontBias, true);
assert.equal(nk1600?.gate.mode, "inner");

const nk1800 = courseProfile("中山", "芝", "芝1800m");
assert.equal(nk1800?.scoreInGate, true);
assert.equal(nk1800?.frontBias, true);
assert.ok(nk1800.bullets.some((b) => b.includes("205")));

const nk2000 = courseProfile("中山", "芝", "芝2000m");
assert.equal(nk2000?.scoreInGate, false);
assert.equal(nk2000?.frontBias, false);
assert.ok(nk2000.summary.includes("内回り"));
assert.ok(nk2000.bullets.some((b) => b.includes("差し一辺倒にはしない")));

const nk2200 = courseProfile("中山", "芝", "芝2200m");
assert.equal(nk2200?.scoreInGate, false);
assert.equal(nk2200?.frontBias, false);
assert.ok(nk2200.summary.includes("外回り"));
assert.ok(nk2200.bullets.some((b) => b.includes("こちらは外回り")));

const nk2500 = courseProfile("中山", "芝", "芝2500m");
assert.equal(nk2500?.scoreInGate, false);
assert.ok(nk2500.bullets.some((b) => b.includes("初出走")));

const nkD12 = courseProfile("中山", "ダート", "ダート1200m");
assert.equal(nkD12?.gate.mode, "outer");
assert.equal(nkD12?.frontBias, true);
assert.equal(nkD12?.scoreInGate, true);

const nkD18 = courseProfile("中山", "ダート", "ダート1800m");
assert.equal(nkD18?.scoreInGate, false);
assert.equal(nkD18?.frontBias, true);
assert.ok(nkD18.bullets.some((b) => b.includes("関西馬")));

assert.equal(courseProfile("中山競馬場", "芝", "芝1800m")?.venue, "中山");
assert.ok(courseProfile("中山", "芝", "障害3200m")?.summary.includes("高低差"));

assert.equal(favFront("中山", "芝", "芝1800m"), true);
assert.equal(favFront("中山", "芝", "芝2000m"), false);
assert.equal(favFront("中山", "ダート", "ダート1800m"), true);
assert.equal(favFront("中山", "ダート", "ダート1200m"), true);

assert.equal(trackGateBiasScore("芝", 1, "中山", "芝1200m"), 65);
assert.equal(trackGateBiasScore("芝", 8, "中山", "芝1200m"), 52);
assert.equal(trackGateBiasScore("芝", 1, "中山", "芝1600m"), 64);
assert.equal(trackGateBiasScore("芝", 8, "中山", "芝1600m"), 52);
assert.equal(trackGateBiasScore("芝", 1, "中山", "芝1800m"), 65);
assert.equal(trackGateBiasScore("芝", 1, "中山", "芝2000m"), 62);
assert.equal(trackGateBiasScore("芝", 8, "中山", "芝2000m"), 54);
assert.equal(trackGateBiasScore("ダート", 8, "中山", "ダート1200m"), 65);
assert.equal(trackGateBiasScore("ダート", 1, "中山", "ダート1200m"), 52);
assert.equal(trackGateBiasScore("ダート", 8, "中山", "ダート1800m"), 62);

assert.ok(Math.abs(gateOverlayDelta("芝", 1, "中山", "芝1200m")) <= GATE_OVERLAY_MAX);
assert.equal(gateOverlayDelta("芝", 1, "中山", "芝2000m"), 0);

const spGeneric = courseProfile("札幌", "芝", "障害3200m");
assert.ok(spGeneric?.summary.includes("平坦") || spGeneric?.summary.includes("0.7"));
assert.equal(courseProfile("札幌競馬場", "芝", "芝1800m")?.venue, "札幌");

const sp1200 = courseProfile("札幌", "芝", "芝1200m");
assert.equal(sp1200?.scoreInGate, false);
assert.equal(sp1200?.frontBias, true);
assert.ok(sp1200?.bullets.some((b) => b.includes("差し追い込み一辺倒にはしない")));

const sp1500 = courseProfile("札幌", "芝", "芝1500m");
assert.equal(sp1500?.scoreInGate, false);
assert.equal(sp1500?.frontBias, true);
assert.ok(sp1500?.summary.includes("1500"));
assert.ok(sp1500?.bullets.some((b) => b.includes("170")));

const sp1800 = courseProfile("札幌", "芝", "芝1800m");
assert.equal(sp1800?.scoreInGate, true);
assert.equal(sp1800?.frontBias, true);
assert.equal(sp1800?.gate.mode, "inner");
assert.ok(sp1800?.bullets.some((b) => b.includes("180")));
assert.ok(sp1800?.bullets.some((b) => b.includes("函館転戦")));

const sp2000 = courseProfile("札幌", "芝", "芝2000m");
assert.equal(sp2000?.scoreInGate, false);
assert.equal(sp2000?.frontBias, false);
assert.ok(sp2000?.bullets.some((b) => b.includes("差し最有利にはならない")));

const sp2600 = courseProfile("札幌", "芝", "芝2600m");
assert.equal(sp2600?.scoreInGate, false);
assert.ok(sp2600?.bullets.some((b) => b.includes("初出走")));

const spD10 = courseProfile("札幌", "ダート", "ダート1000m");
assert.equal(spD10?.gate.mode, "outer");
assert.equal(spD10?.frontBias, true);
assert.equal(spD10?.scoreInGate, true);

const spD17 = courseProfile("札幌", "ダート", "ダート1700m");
assert.equal(spD17?.scoreInGate, false);
assert.equal(spD17?.frontBias, true);
assert.ok(spD17?.bullets.some((b) => b.includes("捲り")));
assert.ok(spD17?.bullets.some((b) => b.includes("関西馬")));

assert.equal(favFront("札幌", "芝", "芝1200m"), true);
assert.equal(favFront("札幌", "芝", "芝1500m"), true);
assert.equal(favFront("札幌", "芝", "芝1800m"), true);
assert.equal(favFront("札幌", "芝", "芝2000m"), false);
assert.equal(favFront("札幌", "ダート", "ダート1000m"), true);
assert.equal(favFront("札幌", "ダート", "ダート1700m"), true);

assert.equal(trackGateBiasScore("芝", 1, "札幌", "芝1800m"), 64);
assert.equal(trackGateBiasScore("芝", 8, "札幌", "芝1800m"), 52);
assert.equal(trackGateBiasScore("芝", 1, "札幌", "芝1200m"), 62);
assert.equal(trackGateBiasScore("芝", 8, "札幌", "芝1200m"), 54);
assert.equal(trackGateBiasScore("芝", 1, "札幌", "芝2000m"), 62);
assert.equal(trackGateBiasScore("ダート", 8, "札幌", "ダート1000m"), 65);
assert.equal(trackGateBiasScore("ダート", 1, "札幌", "ダート1000m"), 52);
assert.equal(trackGateBiasScore("ダート", 8, "札幌", "ダート1700m"), 62);

assert.ok(Math.abs(gateOverlayDelta("芝", 1, "札幌", "芝1800m")) <= GATE_OVERLAY_MAX);
assert.equal(gateOverlayDelta("芝", 1, "札幌", "芝2000m"), 0);
assert.equal(gateOverlayDelta("ダート", 8, "札幌", "ダート1700m"), 0);

const tkGeneric = courseProfile("東京", "芝", "障害3200m");
assert.ok(tkGeneric?.summary.includes("525.9") || tkGeneric?.summary.includes("直線"));
assert.equal(courseProfile("東京競馬場", "芝", "芝1600m")?.venue, "東京");

const tk1400 = courseProfile("東京", "芝", "芝1400m");
assert.equal(tk1400?.scoreInGate, false);
assert.equal(tk1400?.frontBias, true);

const tk1600n = courseProfile("東京", "芝", "芝1600m");
assert.equal(tk1600n?.scoreInGate, false);
assert.equal(tk1600n?.frontBias, false);
assert.ok(tk1600n?.bullets.some((b) => b.includes("差し")));

const tk2000 = courseProfile("東京", "芝", "芝2000m");
assert.equal(tk2000?.scoreInGate, false);
assert.equal(tk2000?.frontBias, true);
assert.ok(tk2000?.bullets.some((b) => b.includes("18頭") || b.includes("多頭数")));

const tk2400 = courseProfile("東京", "芝", "芝2400m");
assert.equal(tk2400?.frontBias, true);
assert.ok(tk2400?.bullets.some((b) => b.includes("公平") || b.includes("後方")));

const tkD14 = courseProfile("東京", "ダート", "ダート1400m");
assert.equal(tkD14?.scoreInGate, false);
assert.equal(tkD14?.frontBias, true);
assert.ok(tkD14?.bullets.some((b) => b.includes("ダート発走")));

const tkD16 = courseProfile("東京", "ダート", "ダート1600m");
assert.equal(tkD16?.gate.mode, "outer");
assert.equal(tkD16?.frontBias, true);
assert.equal(tkD16?.scoreInGate, true);

assert.equal(favFront("東京", "芝", "芝1400m"), true);
assert.equal(favFront("東京", "芝", "芝1600m"), false);
assert.equal(favFront("東京", "芝", "芝2000m"), true);
assert.equal(favFront("東京", "ダート", "ダート1600m"), true);
assert.equal(favFront("東京", "ダート", "ダート1400m"), true);

assert.equal(trackGateBiasScore("芝", 1, "東京", "芝1600m"), 62);
assert.equal(trackGateBiasScore("芝", 1, "東京", "芝2000m"), 62);
assert.equal(trackGateBiasScore("ダート", 8, "東京", "ダート1600m"), 64);
assert.equal(trackGateBiasScore("ダート", 1, "東京", "ダート1600m"), 52);
assert.equal(trackGateBiasScore("ダート", 8, "東京", "ダート1400m"), 62);
assert.equal(gateOverlayDelta("芝", 1, "東京", "芝1600m"), 0);
assert.equal(gateOverlayDelta("芝", 1, "東京", "芝2000m"), 0);

const hkGeneric = courseProfile("函館", "芝", "障害3200m");
assert.ok(hkGeneric?.summary.includes("262.1") || hkGeneric?.summary.includes("最短"));
assert.ok(hkGeneric?.bullets.some((b) => b.includes("5.3")));

const hk1200 = courseProfile("函館", "芝", "芝1200m");
assert.equal(hk1200?.scoreInGate, false);
assert.equal(hk1200?.frontBias, true);

const hk1800 = courseProfile("函館", "芝", "芝1800m");
assert.equal(hk1800?.scoreInGate, true);
assert.equal(hk1800?.frontBias, true);
assert.equal(hk1800?.gate.mode, "inner");

const hk2000 = courseProfile("函館", "芝", "芝2000m");
assert.equal(hk2000?.scoreInGate, false);
assert.equal(hk2000?.frontBias, false);
assert.ok(hk2000?.bullets.some((b) => b.includes("差し")));

const hkD10 = courseProfile("函館", "ダート", "ダート1000m");
assert.equal(hkD10?.scoreInGate, false);
assert.equal(hkD10?.frontBias, true);
assert.ok(hkD10?.bullets.some((b) => b.includes("67")));

const hkD17 = courseProfile("函館", "ダート", "ダート1700m");
assert.equal(hkD17?.frontBias, true);
assert.ok(hkD17?.bullets.some((b) => b.includes("関西馬")));

assert.equal(favFront("函館", "芝", "芝1200m"), true);
assert.equal(favFront("函館", "芝", "芝1800m"), true);
assert.equal(favFront("函館", "芝", "芝2000m"), false);
assert.equal(favFront("函館", "ダート", "ダート1000m"), true);
assert.equal(trackGateBiasScore("芝", 1, "函館", "芝1800m"), 64);
assert.equal(trackGateBiasScore("芝", 8, "函館", "芝1800m"), 52);
assert.equal(trackGateBiasScore("芝", 1, "函館", "芝1200m"), 62);
assert.equal(trackGateBiasScore("ダート", 8, "函館", "ダート1000m"), 62);

const fkGeneric = courseProfile("福島", "芝", "障害3200m");
assert.ok(fkGeneric?.summary.includes("1600"));
assert.equal(courseProfile("福島競馬場", "芝", "芝1800m")?.venue, "福島");

const fk1800 = courseProfile("福島", "芝", "芝1800m");
assert.equal(fk1800?.gate.mode, "inner");
assert.equal(fk1800?.frontBias, true);
assert.equal(fk1800?.scoreInGate, true);

const fk2000 = courseProfile("福島", "芝", "芝2000m");
assert.equal(fk2000?.scoreInGate, false);
assert.equal(fk2000?.frontBias, false);

const fk2600 = courseProfile("福島", "芝", "芝2600m");
assert.ok(fk2600?.bullets.some((b) => b.includes("ゴールドシップ")));

const fkD11 = courseProfile("福島", "ダート", "ダート1150m");
assert.equal(fkD11?.gate.mode, "outer");
assert.equal(fkD11?.frontBias, true);
assert.equal(fkD11?.scoreInGate, true);

const fkD17 = courseProfile("福島", "ダート", "ダート1700m");
assert.equal(fkD17?.frontBias, true);
assert.equal(fkD17?.scoreInGate, false);

assert.equal(favFront("福島", "芝", "芝1200m"), true);
assert.equal(favFront("福島", "芝", "芝1800m"), true);
assert.equal(favFront("福島", "芝", "芝2000m"), false);
assert.equal(favFront("福島", "ダート", "ダート1150m"), true);
assert.equal(trackGateBiasScore("芝", 1, "福島", "芝1800m"), 64);
assert.equal(trackGateBiasScore("ダート", 8, "福島", "ダート1150m"), 63);
assert.equal(trackGateBiasScore("ダート", 1, "福島", "ダート1150m"), 53);

const ckGeneric = courseProfile("中京", "芝", "障害3200m");
assert.ok(ckGeneric?.summary.includes("412.5") || ckGeneric?.summary.includes("急坂") || ckGeneric?.summary.includes("坂"));
assert.ok(ckGeneric?.bullets.some((b) => b.includes("内枠")));

const ck1200 = courseProfile("中京", "芝", "芝1200m");
assert.equal(ck1200?.scoreInGate, false);
assert.equal(ck1200?.frontBias, false);

const ck2000 = courseProfile("中京", "芝", "芝2000m");
assert.equal(ck2000?.frontBias, true);
assert.equal(ck2000?.scoreInGate, false);

const ck2200 = courseProfile("中京", "芝", "芝2200m");
assert.equal(ck2200?.frontBias, false);
assert.ok(ck2200?.bullets.some((b) => b.includes("差し")));

const ckD14 = courseProfile("中京", "ダート", "ダート1400m");
assert.equal(ckD14?.gate.mode, "outer");
assert.equal(ckD14?.scoreInGate, true);
assert.equal(ckD14?.frontBias, false);

const ckD18 = courseProfile("中京", "ダート", "ダート1800m");
assert.equal(ckD18?.frontBias, true);
assert.equal(ckD18?.scoreInGate, false);
assert.ok(ckD18?.bullets.some((b) => b.includes("キズナ")));

assert.equal(favFront("中京", "芝", "芝2000m"), true);
assert.equal(favFront("中京", "芝", "芝2200m"), false);
assert.equal(favFront("中京", "ダート", "ダート1800m"), true);
assert.equal(favFront("中京", "ダート", "ダート1400m"), false);
assert.equal(trackGateBiasScore("ダート", 8, "中京", "ダート1400m"), 64);
assert.equal(trackGateBiasScore("ダート", 1, "中京", "ダート1400m"), 52);
assert.equal(trackGateBiasScore("ダート", 8, "中京", "ダート1800m"), 62);
assert.equal(trackGateBiasScore("芝", 1, "中京", "芝1200m"), 62);

const koGeneric = courseProfile("小倉", "芝", "障害3200m");
assert.ok(koGeneric?.summary.includes("1615") || koGeneric?.summary.includes("293"));
assert.ok(koGeneric?.bullets.some((b) => b.includes("夏冬") || b.includes("平坦")));

const ko1200 = courseProfile("小倉", "芝", "芝1200m");
assert.equal(ko1200?.frontBias, true);
assert.equal(ko1200?.scoreInGate, false);
assert.ok(ko1200?.bullets.some((b) => b.includes("中山")));

const ko1800 = courseProfile("小倉", "芝", "芝1800m");
assert.equal(ko1800?.gate.mode, "inner");
assert.equal(ko1800?.frontBias, true);
assert.equal(ko1800?.scoreInGate, true);

const ko2000 = courseProfile("小倉", "芝", "芝2000m");
assert.equal(ko2000?.frontBias, false);
assert.ok(ko2000?.bullets.some((b) => b.includes("まくり")));

const koD10 = courseProfile("小倉", "ダート", "ダート1000m");
assert.equal(koD10?.frontBias, true);
assert.equal(koD10?.scoreInGate, false);

const koD17 = courseProfile("小倉", "ダート", "ダート1700m");
assert.equal(koD17?.frontBias, true);

assert.equal(favFront("小倉", "芝", "芝1200m"), true);
assert.equal(favFront("小倉", "芝", "芝1800m"), true);
assert.equal(favFront("小倉", "芝", "芝2000m"), false);
assert.equal(favFront("小倉", "ダート", "ダート1000m"), true);
assert.equal(trackGateBiasScore("芝", 1, "小倉", "芝1800m"), 64);
assert.equal(trackGateBiasScore("芝", 8, "小倉", "芝1800m"), 52);
assert.equal(trackGateBiasScore("芝", 1, "小倉", "芝1200m"), 62);
assert.equal(trackGateBiasScore("ダート", 8, "小倉", "ダート1000m"), 62);
assert.equal(gateOverlayDelta("芝", 1, "京都", "芝1600m"), 0);

console.log("course-notes: ok");
