/**
 * 凍結オッズ固定・odds 25 / oddsMax 80 のまま scoreMin だけ感度スイープする。
 * 予測ファイルは書き換えない。
 *
 *   node scripts/loop-scoremin-sweep.mjs [YYYY-MM-DD ...]
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SETTINGS,
  selectLongshots,
  evaluatePick,
  findPayoutYen,
  HOT_SCORE_MIN,
  HOT_SCORE_MAX,
} from "./lib/loop-domain.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const loopRoot = path.join(root, "src", "data", "loop");
const liveSnapDir = path.join(root, "src", "data", "snapshots");

const SCORE_GRID = [60, 65, 70];
const FIXED = { oddsThreshold: 25, oddsMax: 80 };
const DEFAULT_DATES = [
  "2026-07-25",
  "2026-07-26",
  "2026-08-01",
  "2026-08-02",
  "2026-08-08",
  "2026-08-09",
];

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p) {
  return JSON.parse(await readFile(p, "utf8"));
}

async function loadLive(raceDate) {
  const dated = path.join(liveSnapDir, `${raceDate}.json`);
  if (await exists(dated)) return await readJson(dated);
  throw new Error(`No live snapshot for ${raceDate}`);
}

function oddsBand(odds) {
  if (odds < 50) return "20-49";
  if (odds < 100) return "50-99";
  return "100+";
}

function evaluateSettings(frozen, resultByRace, settings) {
  const picks = selectLongshots(frozen.races ?? [], settings);
  let placeHits = 0;
  let pending = 0;
  let ticketHits = 0;
  let stakeYen = 0;
  let payoutYen = 0;
  let hotN = 0;
  let hotTicket = 0;
  let keepN = 0;
  let keepTicket = 0;
  const byOddsBand = {};
  const byBetType = {};

  for (const pick of picks) {
    const result = resultByRace.get(pick.raceId);
    const outcome = evaluatePick(pick, result);
    const pay = findPayoutYen(result, pick.betType, pick.selection);
    const band = oddsBand(pick.odds);
    const hot =
      pick.relatedPlacePotential >= HOT_SCORE_MIN &&
      pick.relatedPlacePotential < HOT_SCORE_MAX;
    byOddsBand[band] ??= { n: 0, settled: 0, ticketHits: 0 };
    byBetType[pick.betType] ??= { n: 0, settled: 0, ticketHits: 0 };
    byOddsBand[band].n += 1;
    byBetType[pick.betType].n += 1;
    if (hot) hotN += 1;
    else keepN += 1;

    if (outcome === "pending") {
      pending += 1;
      continue;
    }
    stakeYen += 100;
    byOddsBand[band].settled += 1;
    byBetType[pick.betType].settled += 1;
    const ticketHit = pay != null && pay > 0;
    if (ticketHit) {
      ticketHits += 1;
      payoutYen += pay;
      byOddsBand[band].ticketHits += 1;
      byBetType[pick.betType].ticketHits += 1;
      if (hot) hotTicket += 1;
      else keepTicket += 1;
    }
    if (outcome === "win" || outcome === "place") placeHits += 1;
  }

  const candidates = picks.length;
  const settled = candidates - pending;
  const raceCount = frozen.races?.length ?? 0;

  return {
    scoreMin: settings.scoreMin,
    raceCount,
    candidates,
    settled,
    pending,
    placeHits,
    ticketHits,
    hotN,
    hotTicket,
    keepN,
    keepTicket,
    placePrecision: settled > 0 ? placeHits / settled : null,
    ticketPrecision: settled > 0 ? ticketHits / settled : null,
    density: raceCount > 0 ? candidates / raceCount : null,
    virtualReturnRatePercent:
      stakeYen > 0 ? Number(((payoutYen / stakeYen) * 100).toFixed(1)) : null,
    byOddsBand,
    byBetType,
  };
}

function mergeDayMetrics(days) {
  const sum = {
    candidates: 0,
    settled: 0,
    pending: 0,
    placeHits: 0,
    ticketHits: 0,
    raceCount: 0,
    hotN: 0,
    hotTicket: 0,
    keepN: 0,
    keepTicket: 0,
    stakeProxy: 0,
    payoutProxy: 0,
  };
  const byOddsBand = {};
  const byBetType = {};

  for (const d of days) {
    sum.candidates += d.candidates;
    sum.settled += d.settled;
    sum.pending += d.pending;
    sum.placeHits += d.placeHits;
    sum.ticketHits += d.ticketHits;
    sum.raceCount += d.raceCount;
    sum.hotN += d.hotN;
    sum.hotTicket += d.hotTicket;
    sum.keepN += d.keepN;
    sum.keepTicket += d.keepTicket;
    if (d.settled > 0 && d.virtualReturnRatePercent != null) {
      sum.stakeProxy += d.settled * 100;
      sum.payoutProxy += (d.virtualReturnRatePercent / 100) * d.settled * 100;
    }
    for (const [band, b] of Object.entries(d.byOddsBand ?? {})) {
      byOddsBand[band] ??= { n: 0, settled: 0, ticketHits: 0 };
      byOddsBand[band].n += b.n;
      byOddsBand[band].settled += b.settled;
      byOddsBand[band].ticketHits += b.ticketHits;
    }
    for (const [bt, b] of Object.entries(d.byBetType ?? {})) {
      byBetType[bt] ??= { n: 0, settled: 0, ticketHits: 0 };
      byBetType[bt].n += b.n;
      byBetType[bt].settled += b.settled;
      byBetType[bt].ticketHits += b.ticketHits;
    }
  }

  return {
    candidates: sum.candidates,
    settled: sum.settled,
    pending: sum.pending,
    placeHits: sum.placeHits,
    ticketHits: sum.ticketHits,
    raceCount: sum.raceCount,
    hotN: sum.hotN,
    hotTicket: sum.hotTicket,
    keepN: sum.keepN,
    keepTicket: sum.keepTicket,
    precision: sum.settled > 0 ? sum.placeHits / sum.settled : null,
    ticketPrecision: sum.settled > 0 ? sum.ticketHits / sum.settled : null,
    density: sum.raceCount > 0 ? sum.candidates / sum.raceCount : null,
    virtualReturnRatePercent:
      sum.stakeProxy > 0
        ? Number(((sum.payoutProxy / sum.stakeProxy) * 100).toFixed(1))
        : null,
    byOddsBand,
    byBetType,
  };
}

async function main() {
  const dates =
    process.argv.slice(2).filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)).length > 0
      ? process.argv.slice(2).filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
      : DEFAULT_DATES;

  const dayData = [];
  for (const raceDate of dates) {
    const frozenPath = path.join(loopRoot, "snapshots", `${raceDate}.json`);
    if (!(await exists(frozenPath))) {
      console.warn(`skip ${raceDate}: no frozen snapshot`);
      continue;
    }
    const frozen = await readJson(frozenPath);
    const live = await loadLive(raceDate);
    const resultByRace = new Map((live.races ?? []).map((r) => [r.id, r.result]));
    const withResults = [...resultByRace.values()].filter((r) => r?.finishes?.length)
      .length;
    console.log(
      `Loaded ${raceDate}: frozen=${frozen.races?.length} liveWithResults=${withResults}`,
    );
    dayData.push({ raceDate, frozen, resultByRace });
  }

  if (dayData.length === 0) {
    console.error("No days to sweep");
    process.exit(1);
  }

  const grid = [];
  for (const scoreMin of SCORE_GRID) {
    const settings = {
      ...DEFAULT_SETTINGS,
      ...FIXED,
      scoreMin,
      enabledBetTypes: [...DEFAULT_SETTINGS.enabledBetTypes],
    };
    const perDay = dayData.map(({ raceDate, frozen, resultByRace }) => ({
      raceDate,
      ...evaluateSettings(frozen, resultByRace, settings),
    }));
    const merged = mergeDayMetrics(perDay);
    const row = { scoreMin, fixed: FIXED, ...merged, perDay };
    grid.push(row);
    const tickPct = ((merged.ticketPrecision ?? 0) * 100).toFixed(2);
    process.stdout.write(
      `  min=${scoreMin} n=${String(merged.candidates).padStart(4)} dens=${merged.density?.toFixed(1).padStart(4)} tick=${tickPct.padStart(5)}% hits=${merged.ticketHits} hot=${merged.hotN}/${merged.hotTicket} keep=${merged.keepN}/${merged.keepTicket} RR=${String(merged.virtualReturnRatePercent).padStart(5)}%\n`,
    );
  }

  const outDir = path.join(loopRoot, "reports");
  await mkdir(outDir, { recursive: true });
  const stamp = dates.join("_");
  const outPath = path.join(outDir, `scoremin-sweep-${stamp}.json`);
  const out = {
    builtAt: new Date().toISOString(),
    purpose: "scoreMin sensitivity at fixed 25/80 (VERIFY 8/9 next 1-change)",
    dates: dayData.map((d) => d.raceDate),
    fixed: FIXED,
    hotBand: `[${HOT_SCORE_MIN}, ${HOT_SCORE_MAX})`,
    note: "scoreMin>=70 empties 注目穴 on the board (C3 band is below the gate).",
    grid,
  };
  await writeFile(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${path.relative(root, outPath)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
