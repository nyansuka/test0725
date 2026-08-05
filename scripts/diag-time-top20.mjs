/**
 * 好タイム（レース内タイム上位20%）枝の増分診断。
 *   node scripts/diag-time-top20.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MID_COMPOSITE_MIN = 65;
const MID_REPLACE_GAP = 18;
const MID_TIME_TOP_PCT = 0.2;
const WIN_POP_BLEND = 0.62;

function popularityWinScore(p) {
  if (p == null || p < 1) return 40;
  if (p === 1) return 92;
  if (p === 2) return 78;
  if (p === 3) return 68;
  if (p === 4) return 58;
  if (p === 5) return 50;
  if (p === 6) return 42;
  if (p === 7) return 34;
  if (p === 8) return 28;
  if (p === 9) return 22;
  if (p === 10) return 16;
  return 8;
}

function midLongshotComposite(horse) {
  const f = horse.factors ?? {};
  return (f.formSignal ?? 50) * 0.5 + (f.courseFit ?? 50) * 0.35 + (f.paceFit ?? 50) * 0.15;
}

function isRaceTopTime(horse, horses, topPct = MID_TIME_TOP_PCT) {
  const timed = (horses ?? [])
    .map((h) => ({ number: h.number, t: h.formStats?.bestTimeSec ?? null }))
    .filter((x) => x.t != null && Number.isFinite(x.t));
  if (timed.length < 2) return false;
  timed.sort((a, b) => a.t - b.t || a.number - b.number);
  const cutoff = Math.max(1, Math.ceil(timed.length * topPct));
  const idx = timed.findIndex((x) => x.number === horse.number);
  return idx >= 0 && idx < cutoff;
}

function popularityByNumber(horses) {
  const sorted = [...horses].sort((a, b) => a.oddsWin - b.oddsWin || a.number - b.number);
  const map = new Map();
  sorted.forEach((h, i) => map.set(h.number, i + 1));
  return map;
}

function clamp(n, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function winFormBoost(horse) {
  const fs = horse.formStats;
  if (!fs) return 0;
  let b = 0;
  if (fs.lastRank === 1) b += 8;
  else if (fs.lastRank === 2) b += 3;
  else if (fs.lastRank != null && fs.lastRank >= 8) b -= 4;
  if (fs.avgSameRank != null && fs.avgSameRank > 0 && fs.avgSameRank <= 2.5) b += 5;
  else if (fs.avgSameRank != null && fs.avgSameRank >= 6) b -= 3;
  return b;
}

function scoreWin(horse, race) {
  const f = { ...horse.factors };
  if (f.gateJockey == null) f.gateJockey = horse.bracket != null && horse.bracket <= 3 ? 62 : 52;
  const WIN = {
    courseFit: 0.22,
    paceFit: 0.18,
    conditionFit: 0.12,
    formSignal: 0.28,
    valueGap: 0.08,
    gateJockey: 0.12,
  };
  const factorWin =
    f.courseFit * WIN.courseFit +
    f.paceFit * WIN.paceFit +
    f.conditionFit * WIN.conditionFit +
    f.formSignal * WIN.formSignal +
    f.valueGap * WIN.valueGap +
    (f.gateJockey ?? 50) * WIN.gateJockey;
  const pop = popularityByNumber(race.horses).get(horse.number) ?? null;
  return clamp(
    factorWin * (1 - WIN_POP_BLEND) + popularityWinScore(pop) * WIN_POP_BLEND + winFormBoost(horse),
  );
}

function oldQualify(horse, pop) {
  if (pop < 6 || pop > 10) return false;
  const fs = horse.formStats;
  const c = midLongshotComposite(horse);
  if (fs?.lastRank === 1) return true;
  if (fs?.lastRank != null && fs.lastRank <= 3 && c >= 58) return true;
  return c >= MID_COMPOSITE_MIN;
}

const files = readdirSync("src/data/snapshots").filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
let midField = 0;
let oldQ = 0;
let newOnly = 0;
let newOnlyPassGap = 0;
let newOnlyBestByComp = 0;
let timeTopMid = 0;
let racesNoMidInTop3 = 0;
const samples = [];

for (const f of files) {
  const snap = JSON.parse(readFileSync(join("src/data/snapshots", f), "utf8"));
  for (const r of snap.races || []) {
    if (!(r.horses?.length)) continue;
    const pops = popularityByNumber(r.horses);
    const scored = r.horses.map((h) => ({
      horse: h,
      win: scoreWin(h, r),
      pop: pops.get(h.number) ?? 99,
      comp: midLongshotComposite(h),
    }));
    scored.sort((a, b) => b.win - a.win || a.horse.oddsWin - b.horse.oddsWin);
    const axis = scored.slice(0, 3);
    const hasMid = axis.some((a) => a.pop >= 6 && a.pop <= 10);
    if (hasMid || axis.length < 3) continue;
    racesNoMidInTop3 += 1;
    const third = axis[2];

    const timeOnly = [];
    for (const a of scored) {
      if (a.pop < 6 || a.pop > 10) continue;
      midField += 1;
      const o = oldQualify(a.horse, a.pop);
      const top = isRaceTopTime(a.horse, r.horses);
      if (top) timeTopMid += 1;
      if (o) oldQ += 1;
      if (!o && top) {
        newOnly += 1;
        timeOnly.push(a);
        if (a.win + MID_REPLACE_GAP >= third.win) newOnlyPassGap += 1;
      }
    }

    if (timeOnly.length === 0) continue;
    // 現行は旧資格の最良を取る。タイム専用が選ばれるのは「旧資格ゼロ」かつ gap 通過のときだけ
    const oldCands = scored.filter((a) => oldQualify(a.horse, a.pop));
    if (oldCands.length > 0) continue;
    timeOnly.sort((a, b) => b.comp - a.comp || b.win - a.win);
    const cand = timeOnly[0];
    if (
      cand &&
      cand.win + MID_REPLACE_GAP >= third.win &&
      !axis.some((x) => x.horse.number === cand.horse.number)
    ) {
      newOnlyBestByComp += 1;
      if (samples.length < 10) {
        samples.push({
          date: f.replace(".json", ""),
          race: `${r.venue}${r.raceNumber}R`,
          num: cand.horse.number,
          name: cand.horse.name,
          pop: cand.pop,
          win: cand.win,
          third: third.win,
          gap: third.win - cand.win,
          comp: Number(cand.comp.toFixed(1)),
          bestTimeSec: cand.horse.formStats?.bestTimeSec,
          lastRank: cand.horse.formStats?.lastRank ?? null,
        });
      }
    }
  }
}

console.log(
  JSON.stringify(
    {
      racesNoMidInTop3,
      midFieldCandidates: midField,
      oldQualify: oldQ,
      timeTopMid6to10: timeTopMid,
      newOnlyViaTime: newOnly,
      newOnlyPassGap,
      /** 旧資格候補が0で、タイム専用最良が gap を満たす → 実際に差し替えが増える件数 */
      promotionsAddedIfGapOk: newOnlyBestByComp,
      samples,
    },
    null,
    2,
  ),
);
