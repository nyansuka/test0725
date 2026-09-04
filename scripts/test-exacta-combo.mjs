/**
 * 馬単の関係馬合成: 1着 winPotential × 2着 placePotential の下限。
 * 他券種は place 下限のまま。
 *   node scripts/test-exacta-combo.mjs
 */
import assert from "node:assert/strict";
import {
  classifyOddsEntry,
  combineRelatedScore,
  DEFAULT_SETTINGS,
  scoreHorse,
  scoreWinPotential,
} from "./lib/loop-domain.mjs";

function horse(number, oddsWin) {
  return {
    number,
    name: `#${number}`,
    jockey: "A",
    oddsWin,
    comment: "",
    factors: {
      courseFit: 70,
      paceFit: 70,
      conditionFit: 70,
      formSignal: 70,
      valueGap: 50,
      gateJockey: 55,
    },
  };
}

const race = {
  id: "test-exacta-combo",
  authority: "JRA",
  venue: "東京",
  raceNumber: 1,
  title: "テスト",
  distance: "芝1600m",
  track: "芝",
  startTime: "10:00",
  weather: "晴",
  condition: "良",
  horses: [
    horse(1, 2.4),
    horse(2, 4.1),
    horse(3, 6.2),
    horse(4, 8.5),
    horse(5, 12.0),
    horse(6, 18.0),
    horse(7, 28.0),
    horse(8, 45.0),
  ],
};

const first = race.horses[0];
const seventh = race.horses[6];
const related17 = [first, seventh];

const win1 = scoreWinPotential(first, race);
const place1 = scoreHorse(first, race);
const win7 = scoreWinPotential(seventh, race);
const place7 = scoreHorse(seventh, race);

assert.ok(win1 > place1, "本命は win > place になる（人気事前）");
assert.ok(place7 > win7, "中穴は place > win になる");

assert.equal(
  combineRelatedScore(race, "1-7", "exacta", related17),
  Math.min(win1, place7),
);
assert.equal(
  combineRelatedScore(race, "7-1", "exacta", related17),
  Math.min(win7, place1),
);
assert.notEqual(
  combineRelatedScore(race, "1-7", "exacta", related17),
  combineRelatedScore(race, "7-1", "exacta", related17),
  "馬単は順でスコアが変わる",
);
assert.equal(
  combineRelatedScore(race, "1-7", "quinella", related17),
  Math.min(place1, place7),
);
assert.equal(
  combineRelatedScore(race, "7-1", "wide", related17),
  Math.min(place1, place7),
);

const settings = { ...DEFAULT_SETTINGS, oddsThreshold: 25, oddsMax: 80, scoreMin: 65 };
const exactaFwd = classifyOddsEntry(
  race,
  { betType: "exacta", selection: "1-7", odds: 42.0 },
  settings,
);
const exactaRev = classifyOddsEntry(
  race,
  { betType: "exacta", selection: "7-1", odds: 42.0 },
  settings,
);
const quinella = classifyOddsEntry(
  race,
  { betType: "quinella", selection: "1-7", odds: 42.0 },
  settings,
);

assert.equal(exactaFwd.relatedPlacePotential, Math.min(win1, place7));
assert.equal(exactaRev.relatedPlacePotential, Math.min(win7, place1));
assert.equal(quinella.relatedPlacePotential, Math.min(place1, place7));
assert.ok(
  exactaFwd.relatedPlacePotential > exactaRev.relatedPlacePotential,
  "軸→穴の方が穴→軸より高い",
);

console.log("OK exacta-combo: win(1st)×place(2nd) min; other bets stay place min");
