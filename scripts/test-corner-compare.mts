/**
 * 4角の絵と通過順。着順は使わない。
 *   npx tsx scripts/test-corner-compare.mts
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { actualFourthPass, meanAbsRankError } from "../src/domain/sim/cornerCompare.ts";
import { shapeFieldScript } from "../src/domain/sim/fieldShape.ts";
import { createTurf1200 } from "../src/domain/sim/nakayamaTurf1200Play.ts";
import { heavyGoingKeepsFront, isHeavyGoing } from "../src/domain/sim/heavyFront.ts";
import { buildPhases, buildScript, byStyle, HORSES, type SimHorse } from "../src/domain/sim/nakayamaTurf1200Script.ts";
import { simFieldFromRuns } from "../src/domain/sim/nakayamaTurf1200Field.ts";
import type { StyleRun } from "../src/domain/sim/runningStyle.ts";
import { turfOneTurnId } from "../src/domain/sim/turfOneTurn.ts";
import { turfCourseView } from "../src/domain/sim/turfOneTurnCourse.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

assert.equal(actualFourthPass({ passParts: [3, 5, 8], passLast: 1 }), 8);
assert.equal(actualFourthPass({ passLast: 6 }), 6);
assert.equal(actualFourthPass({}), null);

const error = meanAbsRankError(
  [
    { number: 1, behindM: 0 },
    { number: 2, behindM: 10 },
    { number: 3, behindM: 20 },
  ],
  [
    { number: 1, pass: 3 },
    { number: 2, pass: 1 },
    { number: 3, pass: 2 },
  ],
);
assert.ok(error);
assert.equal(error.horses, 3);
assert.equal(error.meanAbs, (2 + 1 + 1) / 3);
assert.equal(
  meanAbsRankError(
    [{ number: 1, behindM: 0 }],
    [{ number: 1, pass: 4 }],
  ),
  null,
);

const plain = buildScript(HORSES);
assert.deepEqual(plain[8].behind, [0, 4, 7, 30, 38, 42]);
const untouched = shapeFieldScript(buildPhases(HORSES), plain, HORSES);
assert.deepEqual(untouched[8].behind, plain[8].behind);

const phases = buildPhases(HORSES);
const one: SimHorse = {
  number: 1,
  bracket: 8,
  name: "位置",
  style: "差",
  corner3Rate: 0.5,
  corner4Rate: 0.4,
};
const shaped = shapeFieldScript(phases, { 1: { behind: [0, 10, 20, 30, 40, 28], lane: [1, 1, 1, 1, 1, 1] } }, [one]);
assert.equal(shaped[1].behind[2], 40);
assert.equal(shaped[1].behind[3], 32);
assert.equal(shaped[1].behind[5] - shaped[1].behind[3], 28 - 30);

const early = shapeFieldScript(
  phases,
  { 1: { behind: [0, 10, 20, 30, 40, 28], lane: [0, 0, 0, 0, 0, 0] } },
  [{ number: 1, bracket: 1, name: "逃", style: "逃", paceFrontSec: 33 }],
);
assert.equal(early[1].behind[1], 8);
assert.equal(early[1].behind[2], 20);
assert.equal(early[1].behind[3], 30);

const slow = shapeFieldScript(
  phases,
  { 1: { behind: [0, 10, 20, 30, 40, 28], lane: [0, 0, 0, 0, 0, 0] } },
  [{ number: 1, bracket: 1, name: "逃", style: "逃", paceFrontSec: 37 }],
);
assert.equal(slow[1].behind[1], 12);
assert.equal(slow[1].behind[3], 30);

const tight = shapeFieldScript(
  phases,
  { 1: { behind: [0, 10, 20, 30, 40, 28], lane: [1, 1, 1, 1, 1, 1] } },
  [{ number: 1, bracket: 1, name: "差", style: "差", squeezeStraight: true }],
);
assert.equal(tight[1].behind[3], 30);
assert.equal(tight[1].behind[4], 38);
assert.equal(tight[1].behind[5], 28);

const stretchLane = [1, 1, 1, 1, 1, 1];
const stretchRow = { behind: [0, 10, 20, 30, 40, 28], lane: stretchLane };
const weakClose = shapeFieldScript(
  phases,
  { 1: stretchRow },
  [{ number: 1, bracket: 1, name: "差", style: "差", corner4Rate: 0.45, stretchGainM: 5 }],
  "long",
);
assert.equal(weakClose[1].behind[3], 36);
assert.equal(weakClose[1].behind[5], 23);
const strongClose = shapeFieldScript(
  phases,
  { 1: stretchRow },
  [{ number: 1, bracket: 1, name: "差", style: "差", corner4Rate: 0.45, stretchGainM: 20 }],
  "long",
);
assert.equal(strongClose[1].behind[5], 16);
const capped = shapeFieldScript(
  phases,
  { 1: stretchRow },
  [{ number: 1, bracket: 1, name: "差", style: "差", corner4Rate: 0.45, stretchGainM: 20 }],
  "short",
);
assert.equal(capped[1].behind[5], 30);
const stalk = shapeFieldScript(
  phases,
  { 1: stretchRow },
  [{ number: 1, bracket: 1, name: "先", style: "先", corner4Rate: 0.2 }],
  "long",
);
assert.equal(stalk[1].behind[3], 16);
assert.equal(stalk[1].behind[5], 20);
const leader = shapeFieldScript(
  phases,
  { 1: { behind: [0, 0, 0, 0, 0, 0], lane: [0, 0, 0, 0, 0, 0] } },
  [{ number: 1, bracket: 1, name: "逃", style: "逃", corner4Rate: 0 }],
  "long",
);
assert.deepEqual(leader[1].behind, [0, 0, 0, 0, 0, 0]);

const outerEscape = shapeFieldScript(
  phases,
  { 8: { behind: [0, 4, 7, 30, 38, 42], lane: [2, 2, 2, 3, 3, 3] } },
  [{ number: 8, bracket: 4, name: "外", style: "逃", corner3Rate: 0.5, corner4Rate: 0.8 }],
);
assert.equal(outerEscape[8].behind[2], 7);
assert.equal(outerEscape[8].behind[3], 30);
assert.deepEqual(outerEscape[8].lane, [2, 2, 2, 3, 3, 3]);

const ordered = byStyle(
  [
    { number: 2, bracket: 1, name: "後", style: "先", posRate: 0.4 },
    { number: 8, bracket: 8, name: "前", style: "先", posRate: 0.05 },
  ],
  "先",
);
assert.deepEqual(
  ordered.map((horse) => horse.number),
  [8, 2],
);

assert.equal(heavyGoingKeepsFront("福島", "ダート", "ダート1700m"), true);
assert.equal(heavyGoingKeepsFront("東京", "芝", "芝1800m"), false);
assert.equal(isHeavyGoing("重"), true);
assert.equal(isHeavyGoing("良"), false);

async function measureRace(raceId: string) {
  const snap = JSON.parse(await readFile(path.join(root, "src/data/snapshots/2026-10-04.json"), "utf8"));
  const race = snap.races.find((item: { id: string }) => item.id === raceId);
  const courseId = turfOneTurnId(race);
  if (!race || !courseId) return null;
  const runsByNumber = new Map<number, StyleRun[]>();
  const actual: { number: number; pass: number }[] = [];
  for (const horse of race.horses) {
    if (!horse.horseId) continue;
    let cached: { runs?: StyleRun[] };
    try {
      cached = JSON.parse(
        await readFile(path.join(root, "src/data/cache/horse-form", `${horse.horseId}.json`), "utf8"),
      );
    } catch {
      continue;
    }
    const runs = cached.runs ?? [];
    runsByNumber.set(horse.number, runs);
    const onDay = runs.find((run) => run.date === race.raceDate && run.track === "芝");
    const pass = onDay ? actualFourthPass(onDay) : null;
    if (pass != null) actual.push({ number: horse.number, pass });
  }
  if (actual.length < 2) return { raceId, horses: actual.length, meanAbs: null as number | null };
  const field = simFieldFromRuns(
    race.horses.map((horse: { number: number; bracket?: number; name: string }) => ({
      number: horse.number,
      bracket: horse.bracket,
      name: horse.name,
    })),
    runsByNumber,
    race.raceDate,
    { venue: race.venue, distanceM: Number(String(race.distance).match(/(\d+)/)?.[1]) },
  );
  const bare = field.horses.map((horse) => ({
    number: horse.number,
    bracket: horse.bracket,
    name: horse.name,
    style: horse.style,
  }));
  const playOf = (horses: typeof bare) =>
    courseId === "nakayama-turf-1200" ? createTurf1200(horses) : turfCourseView(courseId).play(horses);
  const corner = playOf(bare).phases.find((phase) => phase.id === "c4");
  if (!corner) return null;
  const at = (horses: typeof bare) =>
    playOf(horses)
      .fieldAt(corner.m)
      .map((row) => ({ number: row.horse.number, behindM: row.behindM }));
  const before = meanAbsRankError(at(bare), actual);
  const after = meanAbsRankError(at(field.horses), actual);
  if (!before || !after) return null;
  return { raceId, horses: after.horses, before: before.meanAbs, meanAbs: after.meanAbs };
}

const tokyo = await measureRace("tokyo-20261004-11");
const kyoto = await measureRace("kyoto-20261004-11");
for (const row of [tokyo, kyoto]) {
  if (row?.meanAbs != null) {
    assert.ok(row.meanAbs >= 0 && row.before >= 0);
    assert.ok(row.horses >= 2);
  }
}
const line = (label: string, row: Awaited<ReturnType<typeof measureRace>>) =>
  row?.meanAbs == null
    ? `${label}は発走日の通過がキャッシュに無い`
    : `${label} 4角 順位差 ${row.before.toFixed(2)} → ${row.meanAbs.toFixed(2)}（${row.horses}頭・最後の通過）`;
console.log("corner compare ok", line("東京11R", tokyo), line("京都11R", kyoto));
