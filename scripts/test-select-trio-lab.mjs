/**
 * S2b: selectTrioLab の密度・ゲート確認。
 *   npx tsx scripts/test-select-trio-lab.mjs [YYYY-MM-DD]
 */
import { readFileSync } from "node:fs";
import {
  DEFAULT_TRIO_LANE,
  selectTrioLab,
  summarizeSanrenLabDensity,
} from "../src/domain/sanrenLab.ts";

const date = process.argv[2] ?? "latest";
const path =
  date === "latest"
    ? "src/data/snapshots/latest.json"
    : `src/data/snapshots/${date}.json`;

const snap = JSON.parse(readFileSync(path, "utf8"));
const races = (snap.races ?? []).filter((r) => r.authority === "JRA");
const picks = selectTrioLab(races, DEFAULT_TRIO_LANE);
const density = summarizeSanrenLabDensity(picks);

const oddsOk = picks.every((p) => p.odds >= DEFAULT_TRIO_LANE.oddsThreshold);
const patternOk = picks.every((p) => p.pattern === "fav_fav_hole");
const sortedOk = picks.every((p) => {
  const parts = p.selection.split("-").map(Number);
  const asc = [...parts].sort((a, b) => a - b);
  return parts.every((n, i) => n === asc[i]) && parts.length === 3;
});
const noHoleAxis = picks.every((p) => {
  // 軸は人気帯（単勝オッズ順位で再確認はしないが、pattern と comment に人気軸と明記）
  return p.comment.includes("人気軸");
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
      racesWithPicks: density.raceCount,
      avgPerRace: Number(density.avgPerRace.toFixed(2)),
      minPerRace: density.minPerRace,
      maxPerRace: density.maxPerRace,
      patternCounts: density.patternCounts,
      labelCounts: {
        研究所注目: picks.filter((p) => p.label === "研究所注目").length,
        抑え: picks.filter((p) => p.label === "抑え").length,
      },
      sample: picks.slice(0, 5).map((p) => ({
        raceId: p.raceId,
        selection: p.selection,
        axis: p.axisHorseNumber,
        odds: p.odds,
        score: p.relatedScore,
        label: p.label,
        pattern: p.pattern,
      })),
      checks: { oddsOk, patternOk, sortedOk, noHoleAxis },
    },
    null,
    2,
  ),
);

if (!oddsOk || !patternOk || !sortedOk || !noHoleAxis) {
  console.error("S2B_FAIL checks");
  process.exit(1);
}
if (density.pickCount === 0) {
  console.error("S2B_FAIL no picks");
  process.exit(1);
}
console.log("S2B_OK");
