/**
 * 中山芝1200の走行口。馬番・枠・馬名と、発走前の芝の通過。
 *   npx tsx scripts/test-sim-field.mts
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { simFieldFromRuns } from "../src/domain/sim/nakayamaTurf1200Field.ts";
import { HORSES } from "../src/domain/sim/nakayamaTurf1200Script.ts";
import type { StyleRun } from "../src/domain/sim/runningStyle.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(partial: Partial<StyleRun> & Pick<StyleRun, "date">): StyleRun {
  return {
    track: "芝",
    passFirst: 1,
    passLast: 1,
    fieldSize: 16,
    ...partial,
  };
}

const empty = simFieldFromRuns(
  [{ number: 2, name: "通過なし" }, { number: 1, bracket: 4, name: "芝あり" }],
  new Map<number, StyleRun[]>([
    [1, [run({ date: "2026-09-01", passFirst: 8, passLast: 10, fieldSize: 12 })]],
    [
      2,
      [
        run({ date: "2026-09-20", track: "ダート", passFirst: 1 }),
        run({ date: "2026-09-26", passFirst: 1 }),
        run({ date: "2026-09-10", passFirst: null, passLast: null }),
      ],
    ],
  ]),
  "2026-09-26",
);
assert.deepEqual(
  empty.horses.map((horse) => [horse.number, horse.bracket, horse.name, horse.style, horse.turfPasses.length]),
  [
    [1, 4, "芝あり", "追", 1],
    [2, 1, "通過なし", "差", 0],
  ],
);
assert.deepEqual(empty.withoutPass, ["通過なし"]);
assert.equal(empty.horses[0].turfPasses[0].date, "2026-09-01");
assert.equal(empty.horses[0].turfPasses[0].passFirst, 8);

const leaders = [1, 1, 2, 1, 3].map((pass, index) =>
  run({ date: `2026-0${index + 1}-01`, passFirst: pass, fieldSize: 14 }),
);
const stalkers = [2, 3, 2, 3, 2].map((pass, index) =>
  run({ date: `2026-0${index + 1}-02`, passFirst: pass, fieldSize: 16 }),
);
const closers = [12, 14, 11, 13, 15].map((pass, index) =>
  run({ date: `2026-0${index + 1}-03`, passFirst: pass, fieldSize: 16 }),
);
const styled = simFieldFromRuns(
  [
    { number: 1, bracket: 1, name: "逃げ" },
    { number: 2, bracket: 2, name: "先行" },
    { number: 3, bracket: 3, name: "追込" },
  ],
  new Map([
    [1, leaders],
    [2, stalkers],
    [3, closers],
  ]),
  "2026-09-26",
);
assert.deepEqual(
  styled.horses.map((horse) => horse.style),
  ["逃", "先", "追"],
);
assert.equal(styled.horses[0].turfPasses.length, 5);
assert.deepEqual(styled.withoutPass, []);

const mixed = [
  run({ date: "2026-09-01", venue: "東京", distanceM: 1800, passFirst: 1, fieldSize: 16 }),
  run({ date: "2026-08-01", venue: "東京", distanceM: 1600, passFirst: 1, fieldSize: 16 }),
  run({ date: "2026-07-01", venue: "中山", distanceM: 1200, passFirst: 14, passLast: 14, fieldSize: 16 }),
  run({ date: "2026-06-01", venue: "中山", distanceM: 1200, passFirst: 14, fieldSize: 16 }),
  run({ date: "2026-05-01", venue: "阪神", distanceM: 1400, passFirst: 14, fieldSize: 16 }),
];
const sameShape = simFieldFromRuns(
  [{ number: 1, bracket: 8, name: "同型" }],
  new Map([[1, mixed]]),
  "2026-09-26",
  { venue: "東京", distanceM: 1800 },
);
assert.equal(sameShape.horses[0].style, "逃");
assert.ok((sameShape.horses[0].posRate ?? 1) < 0.2);

const thin = simFieldFromRuns(
  [{ number: 1, bracket: 1, name: "足りない" }],
  new Map([[1, mixed.slice(1)]]),
  "2026-09-26",
  { venue: "東京", distanceM: 1800 },
);
assert.notEqual(thin.horses[0].style, "逃");

const snap = JSON.parse(await readFile(path.join(root, "src/data/snapshots/2026-09-26.json"), "utf8"));
const race = snap.races.find((item: { id: string }) => item.id === "nakayama-20260926-10");
assert.equal(race.title, "勝浦特別");
assert.equal(race.horses.length, 16);

const runsByNumber = new Map<number, StyleRun[]>();
for (const horse of race.horses) {
  const cached = JSON.parse(
    await readFile(path.join(root, "src/data/cache/horse-form", `${horse.horseId}.json`), "utf8"),
  );
  assert.equal(cached.schema, 2, horse.name);
  runsByNumber.set(horse.number, cached.runs);
}

const field = simFieldFromRuns(
  race.horses.map((horse: { number: number; bracket: number; name: string }) => ({
    number: horse.number,
    bracket: horse.bracket,
    name: horse.name,
  })),
  runsByNumber,
  race.raceDate,
);

assert.equal(field.horses.length, 16);
assert.deepEqual(field.withoutPass, []);
for (const horse of field.horses) {
  const sample = HORSES.find((item) => item.number === horse.number);
  assert.ok(sample, String(horse.number));
  assert.equal(horse.name, sample.name);
  assert.equal(horse.bracket, sample.bracket);
  assert.equal(horse.style, sample.style, `${horse.number} ${horse.name}`);
  assert.ok(horse.turfPasses.length > 0 && horse.turfPasses.length <= 5);
  assert.ok(horse.turfPasses.every((pass) => pass.date < race.raceDate));
}

console.log("sim field ok");
