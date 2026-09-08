/**
 * 2026-09-12 / 09-13 週末実験。ゲート内候補は残し、追加は 検討。
 *   npx tsx scripts/test-weekend-experiment.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_SETTINGS } from "../src/domain/betTypes.ts";
import {
  formatCandidateLabel,
  isWeekendExperiment,
} from "../src/domain/experiment.ts";
import {
  classifyOddsEntry,
  combineRelatedScore,
  expectationEdge,
  scoreHorse,
} from "../src/domain/longshots.ts";
import {
  DEFAULT_TRIFECTA_LANE,
  DEFAULT_TRIO_LANE,
  selectTrifectaLab,
  selectTrioLab,
} from "../src/domain/sanrenLab.ts";

assert.equal(isWeekendExperiment("2026-09-12"), true);
assert.equal(isWeekendExperiment("2026-09-13"), true);
assert.equal(isWeekendExperiment("2026-09-06"), false);
assert.equal(formatCandidateLabel("検討"), "候補（検討）");
assert.equal(formatCandidateLabel("注目穴"), "候補（注目穴）");
assert.equal(formatCandidateLabel("候補（検討）"), "候補（検討）");

function horse(number, oddsWin, fit) {
  return {
    number,
    name: `#${number}`,
    jockey: "A",
    oddsWin,
    comment: "",
    factors: {
      courseFit: fit,
      paceFit: fit,
      conditionFit: fit,
      formSignal: 50,
      valueGap: 50,
      gateJockey: 50,
    },
  };
}

function baseRace(raceDate, extras = {}) {
  const horses = [
    horse(1, 1.8, 90),
    horse(2, 3.2, 80),
    horse(3, 5.0, 75),
    horse(4, 7.5, 72),
    horse(5, 10.0, 70),
    horse(6, 14.0, 68),
    horse(7, 22.0, 60),
    horse(8, 35.0, 58),
    horse(9, 48.0, 55),
    horse(10, 80.0, 52),
    horse(11, 120.0, 50),
  ];
  return {
    id: "exp-main",
    authority: "JRA",
    venue: "東京",
    raceNumber: 1,
    title: "実験",
    distance: "芝1600m",
    track: "芝",
    startTime: "10:00",
    weather: "晴",
    condition: "良",
    raceDate,
    horses,
    oddsBoard: [],
    ...extras,
  };
}

{
  const race = baseRace("2026-09-12");
  const related = [race.horses[0], race.horses[6]];
  const floor = combineRelatedScore(race, "1-7", "quinella", related);
  const avg = (scoreHorse(race.horses[0], race) + scoreHorse(race.horses[6], race)) / 2;
  assert.ok(floor < DEFAULT_SETTINGS.scoreMin, `floor ${floor} should miss scoreMin`);
  assert.ok(avg >= DEFAULT_SETTINGS.scoreMin, `avg ${avg} should pass scoreMin`);

  const gated = classifyOddsEntry(
    race,
    { betType: "quinella", selection: "1-2", odds: 40 },
    DEFAULT_SETTINGS,
  );
  assert.equal(gated.status, "candidate");
  assert.notEqual(gated.label, "検討");

  const extra = classifyOddsEntry(
    race,
    { betType: "quinella", selection: "1-7", odds: 40 },
    DEFAULT_SETTINGS,
  );
  assert.equal(extra.status, "candidate");
  assert.equal(extra.label, "検討");

  const otherDay = classifyOddsEntry(
    baseRace("2026-09-06"),
    { betType: "quinella", selection: "1-7", odds: 40 },
    DEFAULT_SETTINGS,
  );
  assert.equal(otherDay.status, "pass");
  assert.notEqual(otherDay.label, "検討");

  const below = classifyOddsEntry(
    race,
    { betType: "quinella", selection: "1-7", odds: 20 },
    DEFAULT_SETTINGS,
  );
  assert.equal(below.status, "below_threshold");

  const above = classifyOddsEntry(
    race,
    { betType: "quinella", selection: "1-7", odds: 90 },
    DEFAULT_SETTINGS,
  );
  assert.equal(above.status, "above_max");

  const bracket = classifyOddsEntry(
    {
      ...race,
      horses: race.horses.map((h) => ({ ...h, bracket: h.number })),
    },
    { betType: "bracket_quinella", selection: "1-7", odds: 40 },
    DEFAULT_SETTINGS,
  );
  assert.notEqual(bracket.label, "検討");

  const deep = classifyOddsEntry(
    race,
    { betType: "quinella", selection: "1-11", odds: 40 },
    DEFAULT_SETTINGS,
  );
  assert.notEqual(deep.status === "candidate" ? deep.label : "", "検討");

  const edge = expectationEdge([
    {
      raceId: race.id,
      venue: race.venue,
      raceNumber: 1,
      startTime: "10:00",
      track: "芝",
      title: "実験",
      betType: "quinella",
      selection: "1-2",
      odds: 40,
      relatedHorseNumbers: [1, 2],
      relatedPlacePotential: 68,
      label: "注目穴",
      comment: "",
    },
    {
      raceId: race.id,
      venue: race.venue,
      raceNumber: 1,
      startTime: "10:00",
      track: "芝",
      title: "実験",
      betType: "quinella",
      selection: "1-7",
      odds: 40,
      relatedHorseNumbers: [1, 7],
      relatedPlacePotential: 80,
      label: "検討",
      comment: "",
    },
  ]);
  assert.equal(edge.pickCount, 1);
  assert.equal(edge.highCount, 1);
}

function cloneDate(races, raceDate) {
  return races.map((r) => ({ ...r, raceDate }));
}

function keyOf(p) {
  return `${p.raceId}:${p.selection}`;
}

const snap = JSON.parse(readFileSync("src/data/snapshots/latest.json", "utf8"));
const latestRaces = (snap.races ?? []).filter((r) => r.authority === "JRA");
assert.ok(latestRaces.length > 0, "latest snapshot needed");
assert.equal(isWeekendExperiment(latestRaces[0]?.raceDate), false);

{
  const baseline = selectTrioLab(latestRaces, DEFAULT_TRIO_LANE);
  const experiment = selectTrioLab(cloneDate(latestRaces, "2026-09-12"), DEFAULT_TRIO_LANE);
  const baseKeys = new Set(baseline.map(keyOf));
  for (const pick of baseline) {
    const found = experiment.find(
      (p) => p.raceId === pick.raceId && p.selection === pick.selection,
    );
    assert.ok(found, `trio baseline missing ${keyOf(pick)}`);
    assert.equal(found.label, pick.label);
  }
  const extras = experiment.filter((p) => !baseKeys.has(keyOf(p)));
  assert.ok(extras.length > 0, "trio extras should appear on 9/12");
  assert.ok(extras.every((p) => p.label === "検討"));
  assert.ok(
    extras.every((p) => p.odds == null || p.odds >= DEFAULT_TRIO_LANE.oddsThreshold),
  );
  const sameDay = selectTrioLab(latestRaces, DEFAULT_TRIO_LANE);
  assert.equal(sameDay.filter((p) => p.label === "検討").length, 0);
}

{
  const baseline = selectTrifectaLab(latestRaces, DEFAULT_TRIFECTA_LANE);
  const experiment = selectTrifectaLab(
    cloneDate(latestRaces, "2026-09-12"),
    DEFAULT_TRIFECTA_LANE,
  );
  const baseKeys = new Set(baseline.map(keyOf));
  for (const pick of baseline) {
    const found = experiment.find(
      (p) => p.raceId === pick.raceId && p.selection === pick.selection,
    );
    assert.ok(found, `trifecta baseline missing ${keyOf(pick)}`);
    assert.equal(found.label, pick.label);
  }
  const extras = experiment.filter((p) => !baseKeys.has(keyOf(p)));
  assert.ok(extras.every((p) => p.label === "検討"));
  assert.ok(extras.every((p) => p.odds >= DEFAULT_TRIFECTA_LANE.oddsThreshold));
  assert.equal(
    selectTrifectaLab(latestRaces, DEFAULT_TRIFECTA_LANE).filter((p) => p.label === "検討")
      .length,
    0,
  );
}

{
  const cheap = cloneDate(latestRaces.slice(0, 3), "2026-09-12").map((race) => ({
    ...race,
    oddsBoard: (race.oddsBoard ?? []).map((e) =>
      e.betType === "trio" ? { ...e, odds: 40 } : e,
    ),
  }));
  const picks = selectTrioLab(cheap, DEFAULT_TRIO_LANE);
  assert.ok(
    picks.every((p) => p.odds == null || p.odds >= DEFAULT_TRIO_LANE.oddsThreshold),
  );
}

console.log("weekend-experiment: ok");
