/**
 * 平地の入口。ワンターンは従来の id、それ以外は共有台本。
 * 障害と、内・外が同じ距離の芝は出さない。
 *   npx tsx scripts/test-flat-sim.mts
 */
import assert from "node:assert/strict";
import { STRETCH_CAP } from "../src/domain/sim/fieldShape.ts";
import { DEFERRED_FLAT, FLAT_NEW, flatSimId } from "../src/domain/sim/flatSimCatalog.ts";
import { flatCourseView } from "../src/domain/sim/flatCourse.ts";
import { simFieldFromRuns } from "../src/domain/sim/nakayamaTurf1200Field.ts";
import type { StyleRun } from "../src/domain/sim/runningStyle.ts";
import { isTurfOneTurnSimRace } from "../src/domain/nakayamaTurf1200Sim.ts";

const sample = {
  venue: "中山",
  track: "芝",
  distance: "芝1200",
  raceDate: "2026-09-01",
};

assert.equal(flatSimId(sample), "nakayama-turf-1200");
assert.equal(isTurfOneTurnSimRace(sample), true);
assert.equal(flatSimId({ ...sample, raceDate: "2026-08-31" }), null);
assert.equal(flatSimId({ ...sample, track: "障害", distance: "障害2880" }), null);
assert.equal(flatSimId({ venue: "阪神", track: "芝", distance: "障害2970m", raceDate: "2026-09-27" }), null);
assert.equal(flatSimId({ venue: "阪神", track: "芝", distance: "芝1400", raceDate: "2026-09-02" }), null);
assert.equal(flatSimId({ venue: "京都", track: "芝", distance: "芝2000", raceDate: "2026-09-02" }), null);
assert.equal(flatSimId({ venue: "新潟", track: "芝", distance: "芝2000", raceDate: "2026-09-02" }), null);
assert.equal(flatSimId({ venue: "中山", track: "芝", distance: "芝2000", raceDate: "2026-09-02" }), "nakayama-turf-2000");
assert.equal(flatSimId({ venue: "中山", track: "ダート", distance: "ダート1800", raceDate: "2026-09-02" }), "nakayama-dirt-1800");

for (const key of DEFERRED_FLAT) {
  const [venue, track, meters] = key.split(":");
  assert.equal(flatSimId({ venue, track, distance: `${track}${meters}`, raceDate: "2026-09-02" }), null, key);
}

const kyotoDay = { venue: "京都", track: "芝", raceDate: "2026-10-10" };
assert.equal(flatSimId({ ...kyotoDay, distance: "芝1600m", courseRail: "内" }), "kyoto-turf-1600");
assert.equal(flatSimId({ ...kyotoDay, distance: "芝1600m", courseRail: "外" }), "kyoto-turf-1600-outer");
assert.equal(flatSimId({ ...kyotoDay, distance: "芝1400m", courseRail: "外" }), "kyoto-turf-1400-outer");
assert.equal(flatSimId({ ...kyotoDay, distance: "芝2000m", courseRail: "内" }), "kyoto-turf-2000");
assert.equal(flatSimId({ ...kyotoDay, distance: "芝2000m", courseRail: "外" }), "kyoto-turf-2000-outer");
assert.equal(flatSimId({ venue: "阪神", track: "芝", distance: "芝1400m", raceDate: "2026-10-10", courseRail: "外" }), null);

const horses = [
  { number: 1, bracket: 1, name: "逃げ", style: "逃" as const, stretchGainM: 80 },
  { number: 2, bracket: 2, name: "差し", style: "差" as const, stretchGainM: 80 },
  { number: 3, bracket: 3, name: "追込", style: "追" as const, stretchGainM: 80 },
];

for (const id of ["kyoto-turf-1400", "kyoto-turf-1400-outer", "kyoto-turf-2000", "kyoto-turf-2000-outer"]) {
  const view = flatCourseView(id);
  assert.ok(view, id);
  const play = view.play(horses);
  const meters = play.phases.map((phase) => phase.m);
  assert.equal(meters[0], 0, id);
  assert.equal(meters.at(-1), view.raceMeters, id);
  for (let i = 1; i < meters.length; i += 1) assert.ok(meters[i] > meters[i - 1], `${id} ${meters.join(",")}`);
}

for (const row of FLAT_NEW) {
  const view = flatCourseView(row.id);
  assert.ok(view, row.id);
  assert.equal(view.raceMeters, row.meters, row.id);
  const end = view.pointAt(row.meters);
  const start = view.pointAt(0);
  const early = view.pointAt(80);
  const step = Math.hypot(early.x - start.x, early.y - start.y);
  assert.ok(Number.isFinite(end.x) && step > 40 && step < 160, `${row.id} 最初の80mが${step.toFixed(0)}px`);
  const play = view.play(horses);
  const at4 = play.phases.find((phase) => phase.id === "c4");
  assert.ok(at4, `${row.id} c4`);
  assert.ok(at4.m > 40 && at4.m < row.meters - 12, `${row.id} c4m ${at4.m}`);
  const field = play.fieldAt(row.meters);
  const leader = field.find((item) => item.horse.style === "逃");
  const closer = field.find((item) => item.horse.style === "差");
  const deep = field.find((item) => item.horse.style === "追");
  assert.ok(leader && closer && deep, row.id);
  assert.ok(leader.behindM <= 1, `${row.id} leader ${leader.behindM}`);
  assert.ok(closer.behindM + 0.2 >= leader.behindM, row.id);
  const cap = STRETCH_CAP[row.stretch];
  const atCorner = play.fieldAt(at4.m);
  const closerAt4 = atCorner.find((item) => item.horse.number === 2);
  assert.ok(closerAt4, row.id);
  const gained = closerAt4.behindM - closer.behindM;
  assert.ok(gained <= cap.差 + 0.6, `${row.id} 差 gained ${gained.toFixed(1)} cap ${cap.差}`);
  assert.ok(gained + 0.6 >= cap.差 * 0.6, `${row.id} 差 floor ${gained.toFixed(1)}`);
}

const dirt = simFieldFromRuns(
  [{ number: 1, bracket: 1, name: "ダート逃げ" }],
  new Map<number, StyleRun[]>([
    [
      1,
      [
        { date: "2026-08-01", track: "ダート", passFirst: 1, passLast: 1, fieldSize: 14, rank: 1 },
        { date: "2026-08-08", track: "ダート", passFirst: 1, passLast: 1, fieldSize: 14, rank: 1 },
        { date: "2026-08-15", track: "芝", passFirst: 12, passLast: 12, fieldSize: 16, rank: 14 },
      ],
    ],
  ]),
  "2026-09-02",
  { track: "ダート", venue: "中山", distanceM: 1800 },
);
assert.equal(dirt.horses[0].style, "逃");
assert.equal(dirt.withoutPass.length, 0);

const open = flatCourseView("nakayama-dirt-1200");
assert.ok(open);
const pack = open.play([
  { number: 1, bracket: 1, name: "先行", style: "先" },
  { number: 2, bracket: 2, name: "差し", style: "差" },
  { number: 3, bracket: 3, name: "不明", style: "差", passUnknown: true },
]);
const openCorner = pack.phases.find((phase) => phase.id === "c4");
assert.ok(openCorner);
const openRows = pack.fieldAt(openCorner.m);
const openLead = openRows.find((row) => row.horse.number === 1);
const openCloser = openRows.find((row) => row.horse.number === 2);
const openMissing = openRows.find((row) => row.horse.number === 3);
assert.equal(openLead?.behindM, 0);
assert.ok(openCloser && openLead && openCloser.behindM > openLead.behindM);
assert.ok(openMissing && openCloser && openMissing.behindM > openCloser.behindM);
assert.equal(openLead?.lane, 0);

console.log(`flat sim ok (${FLAT_NEW.length})`);
