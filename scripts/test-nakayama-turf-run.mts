/**
 * 中山芝1600・1800の点列と、芝の走行。
 * 見本16頭の中山芝1200の位置は変えない。他の型へその台本をコピーしない。
 *   npx tsx scripts/test-nakayama-turf-run.mts
 */
import assert from "node:assert/strict";
import { nakayamaTurf1600Run, nakayamaTurf1800Run } from "../src/domain/sim/nakayamaCourse.ts";
import { TURF1200_CORNER4 } from "../src/domain/sim/nakayamaTurf1200Path.ts";
import { createTurf1200 } from "../src/domain/sim/nakayamaTurf1200Play.ts";
import { buildScript, HORSES } from "../src/domain/sim/nakayamaTurf1200Script.ts";
import { chukyoTurf1200Run, chukyoTurf1400Run, chukyoTurf1600Run } from "../src/domain/sim/chukyoCourse.ts";
import { buildCornerHillScript } from "../src/domain/sim/cornerHillScript.ts";
import { buildFinishHillScript } from "../src/domain/sim/finishHillScript.ts";
import { fukushimaTurf1200Run } from "../src/domain/sim/fukushimaCourse.ts";
import { hakodateTurf1200Run } from "../src/domain/sim/hakodateCourse.ts";
import { hanshinTurf1200Run, hanshinTurf1600Run, hanshinTurf1800Run } from "../src/domain/sim/hanshinCourse.ts";
import { buildHomeUphillScript } from "../src/domain/sim/homeUphillScript.ts";
import { buildInnerFlatScript } from "../src/domain/sim/innerFlatScript.ts";
import { kokuraTurf1200Run } from "../src/domain/sim/kokuraCourse.ts";
import { kyotoTurf1200Run, kyotoTurf1800Run, kyotoTurf2400Run } from "../src/domain/sim/kyotoCourse.ts";
import { buildLongChuteScript } from "../src/domain/sim/longChuteScript.ts";
import { buildLongPocketScript } from "../src/domain/sim/longPocketScript.ts";
import { buildLongStraightScript } from "../src/domain/sim/longStraightScript.ts";
import { niigataTurf1200Run, niigataTurf1600Run, niigataTurf1800Run } from "../src/domain/sim/niigataCourse.ts";
import { buildOpeningHillScript } from "../src/domain/sim/openingHillLapScript.ts";
import { buildOuterLapScript } from "../src/domain/sim/outerLapScript.ts";
import { buildRoundFlatScript } from "../src/domain/sim/roundFlatScript.ts";
import { sapporoTurf1200Run } from "../src/domain/sim/sapporoCourse.ts";
import { buildShortPocketScript } from "../src/domain/sim/shortPocketScript.ts";
import { buildStraightHillScript } from "../src/domain/sim/straightHillScript.ts";
import { buildTightFlatScript } from "../src/domain/sim/tightFlatScript.ts";
import { tokyoTurf1400Run, tokyoTurf1600Run, tokyoTurf1800Run, tokyoTurf2000Run } from "../src/domain/sim/tokyoCourse.ts";
import { RELEASE_M } from "../src/domain/sim/turfCoursePlay.ts";
import { turfCourseView } from "../src/domain/sim/turfOneTurnCourse.ts";
import { turfOneTurnId, type TurfOneTurnId } from "../src/domain/sim/turfOneTurn.ts";

const mile = nakayamaTurf1600Run();
assert.equal(mile.run.at(-1)?.m, 1600);
assert.equal(mile.pocketJoin, 120);
assert.ok(Math.abs(mile.railStart - 240) < 1, `発走 ${mile.railStart}`);
assert.ok(Math.abs(mile.corner3 - 838) < 1, `3角 ${mile.corner3}`);
assert.equal(mile.hillFrom, 1420);
assert.equal(mile.hillTo, 1530);
assert.equal(1600 - mile.straightFrom, 310);
assert.ok(mile.corner3 < mile.corner4 && mile.corner4 < mile.straightFrom);
assert.ok(mile.run.every((point, index) => index === 0 || point.m > mile.run[index - 1].m));

const inner = nakayamaTurf1800Run();
assert.equal(inner.run.at(-1)?.m, 1800);
assert.ok(Math.abs(inner.corner1 - 205) < 1, `1角 ${inner.corner1}`);
assert.ok(Math.abs(inner.openingHillTo - 63) < 1, `序盤の坂 ${inner.openingHillTo}`);
assert.ok(inner.openingHillTo < inner.corner1);
assert.equal(inner.hillFrom, 1620);
assert.equal(inner.hillTo, 1730);
assert.equal(1800 - inner.straightFrom, 310);
assert.ok(inner.corner1 < inner.corner3 && inner.corner3 < inner.corner4 && inner.corner4 < inner.straightFrom);
assert.ok(inner.run.every((point, index) => index === 0 || point.m > inner.run[index - 1].m));

const sample = buildScript(HORSES);
assert.deepEqual(sample[3].behind, [0, 0, 0, 0, 2, 0]);
assert.deepEqual(sample[8].behind, [0, 4, 7, 30, 38, 42]);
assert.deepEqual(sample[16].behind, [0, 6, 10, 38, 46, 50]);

const corner = buildCornerHillScript(HORSES);
const straight = buildLongStraightScript(HORSES);
const roundFlat = buildRoundFlatScript(HORSES);
const homeUphill = buildHomeUphillScript(HORSES);
const tightFlat = buildTightFlatScript(HORSES);
const innerFlat = buildInnerFlatScript(HORSES);
const straightHill = buildStraightHillScript(HORSES);
const finishHill = buildFinishHillScript(HORSES);
const mileScript = buildShortPocketScript(HORSES);
const pocketScript = buildLongPocketScript(HORSES);
const innerLap = buildOpeningHillScript(HORSES);
const outerLap = buildOuterLapScript(HORSES);
const longChute = buildLongChuteScript(HORSES);
assert.notDeepEqual(corner[8].behind, sample[8].behind);
assert.notDeepEqual(straight[8].behind, sample[8].behind);
assert.notDeepEqual(corner[8].behind, straight[8].behind);
assert.notDeepEqual(mileScript[8].behind, sample[8].behind);
assert.notDeepEqual(pocketScript[8].behind, sample[8].behind);
assert.notDeepEqual(pocketScript[8].behind, straight[8].behind);
assert.notDeepEqual(innerLap[8].behind, sample[8].behind);
assert.notDeepEqual(outerLap[8].behind, sample[8].behind);
assert.notDeepEqual(mileScript[8].behind, pocketScript[8].behind);
assert.notDeepEqual(innerLap[8].behind, outerLap[8].behind);
assert.notDeepEqual(longChute[8].behind, sample[8].behind);
for (const other of [corner, straight, roundFlat, homeUphill, tightFlat, innerFlat, straightHill, finishHill, mileScript, pocketScript, innerLap, outerLap]) {
  assert.notDeepEqual(longChute[8].behind, other[8].behind);
}
assert.ok(longChute[8].behind[4] < 12);
assert.ok(longChute[8].behind[6] - longChute[8].behind[1] < 4);
for (const other of [roundFlat, homeUphill, tightFlat, innerFlat, straightHill]) {
  assert.notDeepEqual(other[8].behind, sample[8].behind);
  assert.notDeepEqual(other[8].behind, corner[8].behind);
  assert.notDeepEqual(other[8].behind, straight[8].behind);
}
assert.notDeepEqual(roundFlat[8].behind, homeUphill[8].behind);
assert.notDeepEqual(roundFlat[8].behind, tightFlat[8].behind);
assert.notDeepEqual(homeUphill[8].behind, tightFlat[8].behind);
assert.notDeepEqual(innerFlat[8].behind, straightHill[8].behind);
assert.notDeepEqual(finishHill[8].behind, sample[8].behind);
assert.notDeepEqual(finishHill[8].behind, straight[8].behind);
assert.notDeepEqual(finishHill[8].behind, corner[8].behind);
for (const other of [roundFlat, homeUphill, tightFlat, innerFlat, straightHill, mileScript, pocketScript, innerLap, outerLap]) {
  assert.notDeepEqual(finishHill[8].behind, other[8].behind);
}
assert.ok(finishHill[8].behind[3] < 16);
assert.ok(finishHill[8].behind[5] - finishHill[8].behind[3] < 4);
assert.ok(finishHill[9].behind[5] > straight[9].behind[5]);
assert.ok(finishHill[9].behind[5] - finishHill[9].behind[3] < 4);
assert.ok(straightHill[9].behind[5] < straight[9].behind[5]);
assert.ok(innerFlat[9].behind[5] > straight[9].behind[5]);
assert.ok(homeUphill[9].behind[5] - homeUphill[9].behind[3] < 4);
assert.ok(tightFlat[9].behind[5] - tightFlat[9].behind[3] < 4);
assert.ok(roundFlat[8].behind[3] < 12);
assert.ok(sample[8].behind[3] - sample[8].behind[2] > 15);
assert.ok(corner[8].behind[3] < 16);
assert.ok(corner[8].behind[5] - corner[8].behind[3] < 4);
assert.ok(straight[8].behind[3] < 8);
assert.ok(straight[9].behind[5] < corner[9].behind[5]);
assert.ok(mileScript[8].behind[3] < 16);
assert.ok(mileScript[8].lane[3] >= 2);
assert.ok(pocketScript[8].behind[3] < 12);
assert.ok(outerLap[3].behind[5] > outerLap[3].behind[2]);
assert.ok(outerLap[9].behind[5] < outerLap[9].behind[3]);
assert.ok(outerLap[1].behind[5] < outerLap[3].behind[5]);

const nakayamaPlay = createTurf1200(HORSES);
const nakayamaAt4 = nakayamaPlay.fieldAt(TURF1200_CORNER4).find((row) => row.horse.number === 8);
assert.equal(nakayamaAt4?.behindM, 30);

function behindAt(id: Exclude<TurfOneTurnId, "nakayama-turf-1200">, phaseId: string) {
  const play = turfCourseView(id).play(HORSES);
  const phase = play.phases.find((item) => item.id === phaseId);
  assert.ok(phase);
  return play.fieldAt(phase.m).find((row) => row.horse.number === 8)?.behindM;
}

assert.equal(behindAt("kyoto-turf-1200", "c4"), behindAt("hanshin-turf-1200", "c4"));
assert.equal(behindAt("hanshin-turf-1600", "c4"), behindAt("hanshin-turf-1800", "c4"));
assert.equal(behindAt("hanshin-turf-1600", "c4"), finishHill[8].behind[3]);
assert.notEqual(behindAt("hanshin-turf-1600", "c4"), behindAt("hanshin-turf-1200", "c4"));
assert.notEqual(behindAt("hanshin-turf-1600", "c4"), behindAt("tokyo-turf-1400", "c4"));
assert.notEqual(behindAt("hanshin-turf-1600", "c4"), nakayamaAt4?.behindM);
assert.equal(behindAt("tokyo-turf-1400", "c4"), behindAt("tokyo-turf-1600", "c4"));
assert.equal(behindAt("tokyo-turf-1800", "c4"), behindAt("tokyo-turf-2000", "c4"));
assert.notEqual(behindAt("kyoto-turf-1200", "c4"), nakayamaAt4?.behindM);
assert.notEqual(behindAt("tokyo-turf-1400", "c4"), nakayamaAt4?.behindM);
assert.notEqual(behindAt("tokyo-turf-1800", "c4"), behindAt("tokyo-turf-1400", "c4"));
assert.notEqual(behindAt("nakayama-turf-1600", "c4"), nakayamaAt4?.behindM);
assert.notEqual(behindAt("nakayama-turf-1800", "c4"), nakayamaAt4?.behindM);
assert.equal(behindAt("nakayama-turf-1600", "c4"), mileScript[8].behind[3]);
assert.equal(behindAt("kyoto-turf-2400", "goal"), outerLap[8].behind[5]);
assert.ok(turfCourseView("kyoto-turf-2400").play(HORSES).phases.some((phase) => phase.id === "c4"));
assert.equal(behindAt("sapporo-turf-1000", "c4"), behindAt("sapporo-turf-1200", "c4"));
assert.equal(behindAt("sapporo-turf-1200", "c4"), roundFlat[8].behind[3]);
assert.equal(behindAt("hakodate-turf-1000", "c4"), behindAt("hakodate-turf-1200", "c4"));
assert.equal(behindAt("hakodate-turf-1200", "c4"), behindAt("kyoto-turf-1200", "c4"));
assert.equal(behindAt("fukushima-turf-1000", "c4"), behindAt("fukushima-turf-1200", "c4"));
assert.equal(behindAt("fukushima-turf-1200", "c4"), homeUphill[8].behind[3]);
assert.equal(behindAt("kokura-turf-1000", "c4"), behindAt("kokura-turf-1200", "c4"));
assert.equal(behindAt("kokura-turf-1200", "c4"), tightFlat[8].behind[3]);
assert.equal(behindAt("niigata-turf-1600", "c4"), behindAt("niigata-turf-1800", "c4"));
assert.equal(behindAt("niigata-turf-1800", "c4"), behindAt("tokyo-turf-1400", "c4"));
assert.notEqual(behindAt("niigata-turf-1200", "c4"), behindAt("tokyo-turf-1400", "c4"));
assert.equal(behindAt("niigata-turf-1200", "c4"), innerFlat[8].behind[3]);
assert.equal(behindAt("kyoto-turf-1800", "c4"), behindAt("chukyo-turf-1600", "c4"));
assert.equal(behindAt("kyoto-turf-1800", "c4"), longChute[8].behind[4]);
assert.notEqual(behindAt("kyoto-turf-1800", "c4"), nakayamaAt4?.behindM);
assert.notEqual(behindAt("kyoto-turf-1800", "c4"), behindAt("kyoto-turf-1200", "c4"));
assert.notEqual(behindAt("kyoto-turf-1800", "c4"), behindAt("chukyo-turf-1400", "c4"));
assert.notEqual(behindAt("kyoto-turf-1800", "c4"), behindAt("tokyo-turf-1800", "c4"));
assert.equal(behindAt("chukyo-turf-1200", "c4"), behindAt("chukyo-turf-1400", "c4"));
assert.equal(behindAt("chukyo-turf-1400", "c4"), straightHill[8].behind[3]);
assert.notEqual(behindAt("sapporo-turf-1200", "c4"), nakayamaAt4?.behindM);
assert.notEqual(behindAt("chukyo-turf-1200", "c4"), nakayamaAt4?.behindM);

const sapporo1200 = sapporoTurf1200Run();
const hakodate1200 = hakodateTurf1200Run();
const fukushima1200 = fukushimaTurf1200Run();
const kokura1200 = kokuraTurf1200Run();
assert.ok(sapporo1200.pocketJoin > 40 && sapporo1200.pocketJoin < 140);
assert.ok(hakodate1200.pocketJoin > 40 && hakodate1200.pocketJoin < 140);
assert.ok(fukushima1200.pocketJoin > 40 && fukushima1200.pocketJoin < 140);
assert.ok(kokura1200.pocketJoin > 40 && kokura1200.pocketJoin < 140);
assert.ok(fukushima1200.straightFrom < fukushima1200.homeFrom);
assert.equal(kokura1200.hills.length > 0, true);
assert.equal(niigataTurf1200Run().hills.length, 0);
assert.ok(Math.abs(1600 - niigataTurf1600Run().straightFrom - 658.7) < 1);
assert.ok(Math.abs(1800 - niigataTurf1800Run().straightFrom - 658.7) < 1);
assert.ok(Math.abs(1200 - niigataTurf1200Run().straightFrom - 358.7) < 1);
assert.ok(chukyoTurf1200Run().straightFrom < chukyoTurf1200Run().homeFrom);
assert.ok(chukyoTurf1400Run().straightFrom < chukyoTurf1400Run().homeFrom);

for (const id of [
  "sapporo-turf-1000",
  "sapporo-turf-1200",
  "hakodate-turf-1000",
  "hakodate-turf-1200",
  "fukushima-turf-1000",
  "fukushima-turf-1200",
  "niigata-turf-1200",
  "niigata-turf-1600",
  "niigata-turf-1800",
  "chukyo-turf-1200",
  "chukyo-turf-1300",
  "chukyo-turf-1400",
  "chukyo-turf-1600",
  "kyoto-turf-1800",
  "kokura-turf-1000",
  "kokura-turf-1200",
] as const) {
  const play = turfCourseView(id).play(HORSES);
  const meters = play.phases.map((phase) => phase.m);
  assert.equal(meters[0], 0, id);
  assert.equal(meters.at(-1), turfCourseView(id).raceMeters, id);
  for (let i = 1; i < meters.length; i += 1) assert.ok(meters[i] > meters[i - 1], `${id} ${meters[i - 1]}→${meters[i]}`);
}

for (const id of [
  "nakayama-turf-1600",
  "nakayama-turf-1800",
  "kyoto-turf-2400",
  "tokyo-turf-1800",
  "tokyo-turf-2000",
  "hanshin-turf-1600",
  "hanshin-turf-1800",
] as const) {
  const play = turfCourseView(id).play(HORSES);
  const meters = play.phases.map((phase) => phase.m);
  assert.equal(meters[0], 0);
  assert.equal(meters.at(-1), turfCourseView(id).raceMeters);
  for (let i = 1; i < meters.length; i += 1) assert.ok(meters[i] > meters[i - 1], id);
}

const kyoto = kyotoTurf1200Run();
assert.equal(kyoto.run.at(-1)?.m, 1200);
assert.ok(kyoto.hillFrom < kyoto.corner3 && kyoto.corner3 < kyoto.hillTo && kyoto.hillTo < kyoto.corner4);
assert.ok(Math.abs(1200 - kyoto.straightFrom - 328.4) < 0.05);
assert.ok(kyoto.run.every((point, index) => index === 0 || point.m > kyoto.run[index - 1].m));

const hanshin = hanshinTurf1200Run();
assert.equal(hanshin.run.at(-1)?.m, 1200);
assert.ok(Math.abs(hanshin.turnFrom - 370) < 1, `3角入口 ${hanshin.turnFrom}`);
assert.ok(hanshin.corner4 < hanshin.straightFrom && hanshin.straightFrom < hanshin.hillFrom);
assert.ok(Math.abs(1200 - hanshin.straightFrom - 356.5) < 0.05);
assert.ok(hanshin.run.every((point, index) => index === 0 || point.m > hanshin.run[index - 1].m));

const hanshin1600 = hanshinTurf1600Run();
const hanshin1800 = hanshinTurf1800Run();
assert.equal(hanshin1600.run.at(-1)?.m, 1600);
assert.equal(hanshin1800.run.at(-1)?.m, 1800);
assert.ok(hanshin1600.backFrom < 5, `1600の発走 ${hanshin1600.backFrom}`);
assert.ok(Math.abs(hanshin1800.backFrom - 200) < 5, `1800の向正面 ${hanshin1800.backFrom}`);
assert.ok(Math.abs(hanshin1800.corner3 - hanshin1600.corner3 - 200) < 1);
assert.ok(hanshin1600.corner3 < hanshin1600.corner4 && hanshin1600.corner4 < hanshin1600.straightFrom);
assert.ok(hanshin1800.corner3 < hanshin1800.corner4 && hanshin1800.corner4 < hanshin1800.straightFrom);
assert.ok(hanshin1600.straightFrom < hanshin1600.hillFrom && hanshin1600.hillTo < 1600);
assert.ok(hanshin1800.straightFrom < hanshin1800.hillFrom && hanshin1800.hillTo < 1800);
assert.ok(Math.abs(1600 - hanshin1600.straightFrom - 473.6) < 0.05);
assert.ok(Math.abs(1800 - hanshin1800.straightFrom - 473.6) < 0.05);
assert.ok(hanshin1600.run.every((point, index) => index === 0 || point.m > hanshin1600.run[index - 1].m));
assert.ok(hanshin1800.run.every((point, index) => index === 0 || point.m > hanshin1800.run[index - 1].m));

const tokyo1400 = tokyoTurf1400Run();
const tokyo1600 = tokyoTurf1600Run();
assert.equal(tokyo1400.run.at(-1)?.m, 1400);
assert.equal(tokyo1600.run.at(-1)?.m, 1600);
assert.ok(Math.abs(1400 - tokyo1400.straightFrom - 525.9) < 0.05);
assert.ok(Math.abs(1600 - tokyo1600.straightFrom - 525.9) < 0.05);
assert.ok(Math.abs(tokyo1600.corner3 - tokyo1400.corner3 - 200) < 1);
assert.ok(tokyo1400.straightFrom < tokyo1400.hillFrom && tokyo1400.hillTo < 1400);
assert.ok(tokyo1400.run.every((point, index) => index === 0 || point.m > tokyo1400.run[index - 1].m));
assert.ok(tokyo1600.run.every((point, index) => index === 0 || point.m > tokyo1600.run[index - 1].m));

const tokyo1800 = tokyoTurf1800Run();
const tokyo2000 = tokyoTurf2000Run();
assert.equal(tokyo1800.run.at(-1)?.m, 1800);
assert.equal(tokyo2000.run.at(-1)?.m, 2000);
assert.equal(tokyo1800.pocketJoin, 150);
assert.equal(tokyo2000.pocketJoin, 100);
assert.ok(Math.abs(tokyo1800.railStart - (2083.1 - 1800)) < 1);
assert.ok(Math.abs(tokyo2000.railStart - (2083.1 - 2000)) < 1);
assert.ok(Math.abs(1800 - tokyo1800.straightFrom - 525.9) < 0.05);
assert.ok(Math.abs(2000 - tokyo2000.straightFrom - 525.9) < 0.05);
assert.ok(tokyo1800.pocketJoin < tokyo1800.corner3 && tokyo1800.straightFrom < tokyo1800.hillFrom);
assert.ok(tokyo2000.pocketJoin < tokyo2000.corner3 && tokyo2000.straightFrom < tokyo2000.hillFrom);
assert.ok(Math.abs(tokyo2000.corner3 - tokyo1800.corner3 - 200) < 1);
assert.ok(tokyo1800.run.every((point, index) => index === 0 || point.m > tokyo1800.run[index - 1].m));
assert.ok(tokyo2000.run.every((point, index) => index === 0 || point.m > tokyo2000.run[index - 1].m));

const kyoto2400 = kyotoTurf2400Run();
assert.equal(kyoto2400.run.at(-1)?.m, 2400);
assert.ok(kyoto2400.passFinish < 600, `最初のゴール通過 ${kyoto2400.passFinish}`);
assert.ok(2400 - kyoto2400.passFinish > 1800);
assert.ok(Math.abs(2400 - kyoto2400.straightFrom - 403.7) < 0.05);
assert.ok(kyoto2400.passFinish < kyoto2400.corner1 && kyoto2400.hillTo < kyoto2400.straightFrom);
assert.ok(kyoto2400.run.every((point, index) => index === 0 || point.m > kyoto2400.run[index - 1].m));

const kyoto1800 = kyotoTurf1800Run();
const chukyo1600 = chukyoTurf1600Run();
assert.equal(kyoto1800.run.at(-1)?.m, 1800);
assert.equal(chukyo1600.run.at(-1)?.m, 1600);
assert.ok(kyoto1800.join > RELEASE_M, `京都1800の引き込み ${kyoto1800.join}`);
assert.ok(chukyo1600.join > RELEASE_M, `中京1600の引き込み ${chukyo1600.join}`);
assert.ok(kyoto1800.join < kyoto1800.corner3 && kyoto1800.corner4 < kyoto1800.straightFrom);
assert.ok(chukyo1600.join < chukyo1600.corner3 && chukyo1600.corner4 < chukyo1600.straightFrom);
assert.ok(kyoto1800.hillFrom < kyoto1800.corner3 && kyoto1800.hillTo < kyoto1800.corner4);
assert.ok(chukyo1600.straightFrom < chukyo1600.homeFrom && chukyo1600.homeTo < 1600);
assert.ok(Math.abs(1800 - kyoto1800.straightFrom - 403.7) < 0.05);
assert.ok(Math.abs(1600 - chukyo1600.straightFrom - 412.5) < 0.05);
assert.ok(kyoto1800.run.every((point, index) => index === 0 || point.m > kyoto1800.run[index - 1].m));
assert.ok(chukyo1600.run.every((point, index) => index === 0 || point.m > chukyo1600.run[index - 1].m));
for (const id of ["kyoto-turf-1800", "chukyo-turf-1600"] as const) {
  const play = turfCourseView(id).play(HORSES);
  assert.equal(play.phaseAt(RELEASE_M).id, "chute", id);
  const join = play.phases.find((phase) => phase.id === "join");
  assert.ok(join && join.m > RELEASE_M, id);
}

const on = (venue: string, distance: string, raceDate = "2026-10-04") =>
  turfOneTurnId({ venue, track: "芝", distance, raceDate });
assert.equal(on("中山", "芝1200m"), "nakayama-turf-1200");
assert.equal(on("中山", "芝1600m"), "nakayama-turf-1600");
assert.equal(on("中山", "芝1800m"), "nakayama-turf-1800");
assert.equal(on("京都", "芝1200m"), "kyoto-turf-1200");
assert.equal(on("京都", "芝1800m"), "kyoto-turf-1800");
assert.equal(on("京都", "芝2400m"), "kyoto-turf-2400");
assert.equal(on("阪神", "芝1200m"), "hanshin-turf-1200");
assert.equal(on("阪神", "芝1600m"), "hanshin-turf-1600");
assert.equal(on("阪神", "芝1800m"), "hanshin-turf-1800");
assert.equal(on("東京", "芝1400m"), "tokyo-turf-1400");
assert.equal(on("東京", "芝1600m"), "tokyo-turf-1600");
assert.equal(on("東京", "芝1800m"), "tokyo-turf-1800");
assert.equal(on("東京", "芝2000m"), "tokyo-turf-2000");
assert.equal(on("中山", "芝1200m", "2026-08-31"), null);
assert.equal(on("中山", "芝1600m", "2026-08-31"), null);
assert.equal(on("中山", "芝2000m"), null);
assert.equal(on("中山", "芝2200m"), null);
assert.equal(on("京都", "芝1400m"), null);
assert.equal(on("京都", "芝1600m"), null);
assert.equal(on("京都", "芝2200m"), null);
assert.equal(on("京都", "芝3000m"), null);
assert.equal(on("阪神", "芝1400m"), null);
assert.equal(on("阪神", "芝2000m"), null);
assert.equal(on("阪神", "芝2400m"), null);
assert.equal(on("東京", "芝2400m"), null);
assert.equal(on("札幌", "芝1000m"), "sapporo-turf-1000");
assert.equal(on("札幌", "芝1200m"), "sapporo-turf-1200");
assert.equal(on("函館", "芝1000m"), "hakodate-turf-1000");
assert.equal(on("函館", "芝1200m"), "hakodate-turf-1200");
assert.equal(on("福島", "芝1000m"), "fukushima-turf-1000");
assert.equal(on("福島", "芝1200m"), "fukushima-turf-1200");
assert.equal(on("新潟", "芝1200m"), "niigata-turf-1200");
assert.equal(on("新潟", "芝1600m"), "niigata-turf-1600");
assert.equal(on("新潟", "芝1800m"), "niigata-turf-1800");
assert.equal(on("中京", "芝1200m"), "chukyo-turf-1200");
assert.equal(on("中京", "芝1300m"), "chukyo-turf-1300");
assert.equal(on("中京", "芝1400m"), "chukyo-turf-1400");
assert.equal(on("中京", "芝1600m"), "chukyo-turf-1600");
assert.equal(on("小倉", "芝1000m"), "kokura-turf-1000");
assert.equal(on("小倉", "芝1200m"), "kokura-turf-1200");
assert.equal(on("新潟", "芝1400m"), null);
assert.equal(on("新潟", "芝1000m"), null);
assert.equal(on("新潟", "芝2000m"), null);
assert.equal(on("札幌", "芝1500m"), null);
assert.equal(on("札幌", "芝1800m"), null);
assert.equal(on("札幌", "芝2000m"), null);
assert.equal(on("函館", "芝1800m"), null);
assert.equal(on("福島", "芝1800m"), null);
assert.equal(on("中京", "芝2000m"), null);
assert.equal(on("小倉", "芝1800m"), null);
assert.equal(on("札幌", "芝1200m", "2026-08-31"), null);
assert.equal(turfOneTurnId({ venue: "阪神", track: "芝", distance: "障害2970m", raceDate: "2026-10-04" }), null);
assert.equal(turfOneTurnId({ venue: "阪神", track: "芝", distance: "障害1600m", raceDate: "2026-10-04" }), null);
assert.equal(turfOneTurnId({ venue: "京都", track: "芝", distance: "障害1800m", raceDate: "2026-10-04" }), null);
assert.equal(turfOneTurnId({ venue: "中京", track: "芝", distance: "障害1600m", raceDate: "2026-10-04" }), null);
assert.equal(turfOneTurnId({ venue: "中山", track: "ダート", distance: "ダート1200m", raceDate: "2026-10-04" }), null);

console.log(
  `nakayama turf run ok  1600 ポケット${mile.pocketJoin}m 3角${mile.corner3.toFixed(0)} 坂${mile.hillFrom}` +
    `  1800 坂${inner.openingHillTo.toFixed(0)}m 1角${inner.corner1.toFixed(0)} 坂${inner.hillFrom}` +
    `  京都1200 3角${kyoto.corner3.toFixed(0)} 1800 引き込み${kyoto1800.join.toFixed(0)} 2400 通過${kyoto2400.passFinish.toFixed(0)} 直線${(2400 - kyoto2400.straightFrom).toFixed(0)}` +
    `  中京1600 引き込み${chukyo1600.join.toFixed(0)}` +
    `  阪神1200 3角${hanshin.corner3.toFixed(0)}` +
    `  1600 入口${hanshin1600.turnFrom.toFixed(0)} 3角${hanshin1600.corner3.toFixed(0)} 4角${hanshin1600.corner4.toFixed(0)}` +
    `  1800 入口${hanshin1800.turnFrom.toFixed(0)} 3角${hanshin1800.corner3.toFixed(0)} 直線${(1600 - hanshin1600.straightFrom).toFixed(1)}` +
    `  東京1400 3角${tokyo1400.corner3.toFixed(0)} 1600 3角${tokyo1600.corner3.toFixed(0)}` +
    `  1800 ポケット${tokyo1800.pocketJoin} 2000 ポケット${tokyo2000.pocketJoin}`,
);
