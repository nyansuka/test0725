/**
 * S2b: selectTrioLab の密度・ゲート確認。
 *   npx tsx scripts/test-select-trio-lab.mjs [YYYY-MM-DD]
 */
import { readFileSync } from "node:fs";
import {
  DEFAULT_TRIO_LANE,
  isSanrenCorePick,
  selectTrioLab,
  summarizeSanrenLabDensity,
} from "../src/domain/sanrenLab.ts";
import { TRIO_WATCH_TOP_N } from "../src/domain/sanrenTrioIndex.mjs";

const date = process.argv[2] ?? "latest";
const path =
  date === "latest"
    ? "src/data/snapshots/latest.json"
    : `src/data/snapshots/${date}.json`;

const snap = JSON.parse(readFileSync(path, "utf8"));
const races = (snap.races ?? []).filter((r) => r.authority === "JRA");
const picks = selectTrioLab(races, DEFAULT_TRIO_LANE);
const corePicks = picks.filter(isSanrenCorePick);
const trialPicks = picks.filter((p) => !isSanrenCorePick(p));
const density = summarizeSanrenLabDensity(corePicks);
const allDensity = summarizeSanrenLabDensity(picks);

const oddsOk = picks.every(
  (p) => p.odds == null || p.odds >= DEFAULT_TRIO_LANE.oddsThreshold,
);
const allRacesOk = density.raceCount >= Math.min(20, Math.max(1, races.length - 1));
const corePatternOk = corePicks.every((p) => p.pattern === "fav_fav_hole");
const trialPatternOk = trialPicks.every((p) => p.pattern === "fav_hole_hole");
const favHoleHoleOk = trialPicks.some((p) => p.pattern === "fav_hole_hole");
const sortedOk = picks.every((p) => {
  const parts = p.selection.split("-").map(Number);
  const asc = [...parts].sort((a, b) => a - b);
  return parts.every((n, i) => n === asc[i]) && parts.length === 3;
});
const noHoleAxis = picks.every((p) => {
  // 軸は人気帯（単勝オッズ順位で再確認はしないが、pattern と comment に人気軸と明記）
  return p.comment.includes("人気軸");
});
const indexOk = picks.every(
  (p) =>
    typeof p.hitScore === "number" &&
    typeof p.evScore === "number" &&
    p.relatedScore === p.hitScore,
);
const byRace = new Map();
for (const p of corePicks) {
  const list = byRace.get(p.raceId) ?? [];
  list.push(p);
  byRace.set(p.raceId, list);
}
const watchOk = [...byRace.values()].every((list) => {
  const nWatch = list.filter((p) => p.label === "研究所注目").length;
  return nWatch <= TRIO_WATCH_TOP_N && nWatch <= list.length;
});
const coreCapOk = [...byRace.values()].every(
  (list) => list.length <= DEFAULT_TRIO_LANE.topNPerRace,
);
const trialCapOk = [...new Set(trialPicks.map((p) => p.raceId))].every((id) => {
  return trialPicks.filter((p) => p.raceId === id).length <= DEFAULT_TRIO_LANE.topNPerRace;
});
const trialNotWatchOk = trialPicks.every((p) => p.label === "検討");
const evSortedOk = [...byRace.values()].every((list) => {
  for (let i = 1; i < list.length; i += 1) {
    if ((list[i - 1].evScore ?? 0) < (list[i].evScore ?? 0)) return false;
  }
  return true;
});

console.log(
  JSON.stringify(
    {
      path,
      raceCount: races.length,
      settings: {
        oddsThreshold: DEFAULT_TRIO_LANE.oddsThreshold,
        popularRankMax: DEFAULT_TRIO_LANE.popularRankMax,
        holeRankMin: DEFAULT_TRIO_LANE.holeRankMin,
        partnerCapHole: DEFAULT_TRIO_LANE.partnerCapHole,
        topNPerRace: DEFAULT_TRIO_LANE.topNPerRace,
      },
      pickCount: density.pickCount,
      trialPickCount: trialPicks.length,
      racesWithPicks: density.raceCount,
      avgPerRace: Number(density.avgPerRace.toFixed(2)),
      minPerRace: density.minPerRace,
      maxPerRace: density.maxPerRace,
      patternCounts: allDensity.patternCounts,
      labelCounts: {
        研究所注目: picks.filter((p) => p.label === "研究所注目").length,
        抑え: picks.filter((p) => p.label === "抑え").length,
        検討: picks.filter((p) => p.label === "検討").length,
      },
      sample: picks.slice(0, 5).map((p) => ({
        raceId: p.raceId,
        selection: p.selection,
        axis: p.axisHorseNumber,
        odds: p.odds,
        hit: p.hitScore,
        ev: p.evScore,
        label: p.label,
        pattern: p.pattern,
      })),
      checks: {
        oddsOk,
        corePatternOk,
        trialPatternOk,
        favHoleHoleOk,
        sortedOk,
        noHoleAxis,
        indexOk,
        watchOk,
        coreCapOk,
        trialCapOk,
        trialNotWatchOk,
        evSortedOk,
        allRacesOk,
      },
    },
    null,
    2,
  ),
);

if (
  !oddsOk ||
  !corePatternOk ||
  !trialPatternOk ||
  !favHoleHoleOk ||
  !sortedOk ||
  !noHoleAxis ||
  !indexOk ||
  !watchOk ||
  !coreCapOk ||
  !trialCapOk ||
  !trialNotWatchOk ||
  !evSortedOk ||
  !allRacesOk
) {
  console.error("S2B_FAIL checks");
  process.exit(1);
}
if (density.pickCount === 0) {
  console.error("S2B_FAIL no picks");
  process.exit(1);
}
console.log("S2B_OK");
