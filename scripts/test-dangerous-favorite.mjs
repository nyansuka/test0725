/**
 * 危険1人気フラグのユニット確認。
 *   node scripts/test-dangerous-favorite.mjs
 */
import assert from "node:assert/strict";
import {
  assessDangerousFirstFavorite,
  isCloserStyle,
  isFrontBiasedCourse,
} from "../src/domain/dangerousFavorite.mjs";
import { findDangerousFirstFavorite } from "./lib/loop-domain.mjs";

assert.equal(isFrontBiasedCourse("新潟", "芝"), true);
assert.equal(isFrontBiasedCourse("新潟", "ダート"), false);
assert.equal(isFrontBiasedCourse("東京", "芝"), false);
assert.equal(isCloserStyle("差"), true);
assert.equal(isCloserStyle("逃"), false);

function horses(rows) {
  return rows.map((r) => ({
    number: r.n,
    runningStyle: r.style,
  }));
}

const weakFirst = assessDangerousFirstFavorite({
  raceId: "r1",
  venue: "東京",
  track: "芝",
  horses: horses([{ n: 1, style: "逃" }, { n: 2 }, { n: 3 }, { n: 4 }]),
  popularity: new Map([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
  ]),
  factorWins: new Map([
    [1, 40],
    [2, 70],
    [3, 65],
    [4, 60],
  ]),
});
assert.equal(weakFirst?.flagged, true);
assert.deepEqual(weakFirst?.reasons, ["factor_win_below_median"]);
assert.equal(weakFirst?.horseNumber, 1);

const strongFirst = assessDangerousFirstFavorite({
  raceId: "r2",
  venue: "東京",
  track: "芝",
  horses: horses([{ n: 3, style: "逃" }, { n: 5 }, { n: 7 }]),
  popularity: { 3: 1, 5: 2, 7: 3 },
  factorWins: { 3: 80, 5: 50, 7: 40 },
});
assert.equal(strongFirst?.flagged, false);
assert.deepEqual(strongFirst?.reasons, []);

const closerNiigata = assessDangerousFirstFavorite({
  raceId: "r3",
  venue: "新潟",
  track: "芝",
  distance: "1800m",
  horses: horses([{ n: 2, style: "追" }, { n: 4, style: "先" }, { n: 6, style: "逃" }]),
  popularity: new Map([
    [2, 1],
    [4, 2],
    [6, 3],
  ]),
  factorWins: new Map([
    [2, 70],
    [4, 60],
    [6, 50],
  ]),
});
assert.equal(closerNiigata?.flagged, true);
assert.deepEqual(closerNiigata?.reasons, ["closer_on_front_course"]);

const secondFavWeak = assessDangerousFirstFavorite({
  raceId: "r4",
  venue: "新潟",
  track: "芝",
  horses: horses([{ n: 1 }, { n: 8, style: "差" }]),
  popularity: new Map([
    [1, 1],
    [8, 2],
  ]),
  factorWins: new Map([
    [1, 90],
    [8, 10],
  ]),
});
assert.equal(secondFavWeak?.flagged, false);
assert.equal(secondFavWeak?.horseNumber, 1);

function dummyFactors() {
  return {
    courseFit: 50,
    paceFit: 50,
    conditionFit: 50,
    formSignal: 50,
    valueGap: 50,
  };
}

const liveRace = {
  id: "live",
  authority: "JRA",
  raceDate: "2026-08-01",
  venue: "新潟",
  raceNumber: 8,
  title: "テスト",
  distance: "芝1800m",
  track: "芝",
  startTime: "15:00",
  weather: "晴",
  condition: "良",
  horses: [
    {
      number: 2,
      name: "ガービー",
      jockey: "A",
      oddsWin: 2.4,
      runningStyle: "差",
      factors: { ...dummyFactors(), courseFit: 40, paceFit: 38, formSignal: 40 },
      comment: "",
      formStats: { pastStarts: 3, sameCourseStarts: 0, bestTimeSec: null, avgSameRank: null, lastRank: 5, lastPopularity: 3, lastDate: null },
    },
    {
      number: 1,
      name: "先行馬",
      jockey: "B",
      oddsWin: 4.1,
      runningStyle: "先",
      factors: { ...dummyFactors(), courseFit: 80, paceFit: 82, formSignal: 78 },
      comment: "",
      formStats: { pastStarts: 4, sameCourseStarts: 1, bestTimeSec: 108.1, avgSameRank: 2.0, lastRank: 1, lastPopularity: 2, lastDate: null },
    },
    {
      number: 4,
      name: "内枠",
      jockey: "C",
      oddsWin: 6.2,
      runningStyle: "逃",
      factors: { ...dummyFactors(), courseFit: 75, paceFit: 70, formSignal: 72 },
      comment: "",
    },
  ],
  oddsBoard: [],
};

const found = findDangerousFirstFavorite(liveRace);
assert.equal(found?.horseNumber, 2);
assert.equal(found?.flagged, true);
assert.ok(found?.reasons.includes("closer_on_front_course"));

const nar = findDangerousFirstFavorite({ ...liveRace, authority: "NAR" });
assert.equal(nar, null);

console.log(
  JSON.stringify(
    {
      ok: true,
      weakFirst: weakFirst.reasons,
      closerNiigata: closerNiigata.reasons,
      live: { horseNumber: found.horseNumber, reasons: found.reasons },
    },
    null,
    2,
  ),
);

try {
  const { readFileSync } = await import("node:fs");
  const snap = JSON.parse(readFileSync("src/data/snapshots/latest.json", "utf8"));
  const races = (snap.races ?? []).filter((r) => r.authority === "JRA");
  let flagged = 0;
  for (const race of races) {
    const a = findDangerousFirstFavorite(race);
    if (a?.flagged) flagged += 1;
  }
  console.log(`latest.json JRA ${races.length}R · dang1 flagged ${flagged}`);
} catch {
  // snapshot optional
}
