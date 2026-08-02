/**
 * 同条件タイム / 前走 → courseFit・formSignal の回帰テスト。
 *   node scripts/test-horse-form.mjs
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyFormToRace,
  courseKey,
  parseDistanceCell,
  parseHorseResultHtml,
  parseVenueCell,
  timeToSec,
} from "./lib/horse-form.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "fixtures", "horse-result-sample.html");

assert.equal(timeToSec("1:00.3"), 60.3);
assert.equal(timeToSec("59.8"), 59.8);
assert.equal(timeToSec("**"), null);

assert.deepEqual(parseDistanceCell("ダ1000"), {
  track: "ダート",
  distanceM: 1000,
  label: "ダート1000m",
  steeple: false,
});
assert.equal(parseVenueCell("1札幌1"), "札幌");
assert.equal(courseKey("札幌", "ダート", "ダート1000m"), "札幌|ダート|1000");

const html = await readFile(fixturePath, "utf8");
const runs = parseHorseResultHtml(html);
assert.ok(runs.length >= 2, `expected past runs, got ${runs.length}`);
assert.equal(runs[0].venue, "札幌");
assert.equal(runs[0].track, "ダート");
assert.equal(runs[0].distanceM, 1000);
assert.equal(runs[0].timeSec, 60.3);
assert.equal(runs[0].rank, 6);

const race = {
  raceDate: "2026-07-25",
  venue: "札幌",
  track: "ダート",
  distance: "ダート1000m",
  horses: [
    {
      number: 1,
      name: "A",
      horseId: "2023102282",
      oddsWin: 18.4,
      factors: {
        courseFit: 70,
        paceFit: 60,
        conditionFit: 60,
        formSignal: 60,
        valueGap: 68,
        gateJockey: 54,
      },
    },
    {
      number: 2,
      name: "B",
      horseId: "other",
      oddsWin: 5,
      factors: {
        courseFit: 70,
        paceFit: 60,
        conditionFit: 60,
        formSignal: 60,
        valueGap: 50,
        gateJockey: 54,
      },
    },
  ],
};

const runsByHorseId = new Map([
  ["2023102282", { horseId: "2023102282", runs }],
  [
    "other",
    {
      horseId: "other",
      runs: [
        {
          date: "2026-07-05",
          venue: "札幌",
          track: "ダート",
          distanceM: 1000,
          distanceLabel: "ダート1000m",
          rank: 2,
          popularity: 4,
          timeSec: 59.9,
        },
      ],
    },
  ],
]);

applyFormToRace(race, runsByHorseId);

// 当日(7/25)走は除外 → A の同場は無し、函館ダ1000で同距離フォールバック
assert.equal(race.horses[0].formStats.sameCourseStarts, 0);
assert.ok(race.horses[0].formStats.sameDistanceStarts >= 1);
assert.equal(race.horses[0].formStats.courseMatch, "distance");
// B は札幌ダ1000で同場マッチ、好タイム・好走
assert.ok(race.horses[1].formStats.sameCourseStarts >= 1);
assert.equal(race.horses[1].formStats.courseMatch, "venue");
assert.ok(race.horses[1].factors.courseFit >= 70);
assert.ok(race.horses[1].factors.formSignal >= 70, "好走前走で formSignal 上昇");
assert.ok(
  race.horses[1].factors.courseFit > race.horses[0].factors.courseFit,
  "同場好タイムの方が courseFit 高い",
);
// paceFit は触らない
assert.equal(race.horses[0].factors.paceFit, 60);

console.log("OK horse-form: parse + same-course scoring");
