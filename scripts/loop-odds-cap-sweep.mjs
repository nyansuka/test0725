/**
 * 凍結オッズ固定・oddsThreshold/scoreMin=25/75 のまま oddsMax だけ感度スイープする（B3）。
 * 予測ファイルは書き換えない。
 *
 *   node scripts/loop-odds-cap-sweep.mjs [YYYY-MM-DD ...]
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SETTINGS,
  selectLongshots,
  evaluatePick,
  findPayoutYen,
} from "./lib/loop-domain.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const loopRoot = path.join(root, "src", "data", "loop");
const liveSnapDir = path.join(root, "src", "data", "snapshots");

/** null = 上限なし（現行）。以降は「この値以下を採用」（odds > max を除外） */
const CAP_GRID = [null, 150, 100, 80, 60, 50, 40];
const FIXED = { oddsThreshold: 25, scoreMin: 75 };

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
  if (odds < 50) return "25-49";
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
  const byOddsBand = {};
  const byBetType = {};

  for (const pick of picks) {
    const result = resultByRace.get(pick.raceId);
    const outcome = evaluatePick(pick, result);
    const pay = findPayoutYen(result, pick.betType, pick.selection);
    const band = oddsBand(pick.odds);
    byOddsBand[band] ??= { n: 0, settled: 0, placeHits: 0, ticketHits: 0 };
    byBetType[pick.betType] ??= { n: 0, settled: 0, placeHits: 0, ticketHits: 0 };
    byOddsBand[band].n += 1;
    byBetType[pick.betType].n += 1;

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
    } else if (outcome === "win" && pick.betType === "win") {
      ticketHits += 1;
      payoutYen += Math.round(pick.odds * 100);
      byOddsBand[band].ticketHits += 1;
      byBetType[pick.betType].ticketHits += 1;
    }
    if (outcome === "win" || outcome === "place") {
      placeHits += 1;
      byOddsBand[band].placeHits += 1;
      byBetType[pick.betType].placeHits += 1;
    }
  }

  const candidates = picks.length;
  const settled = candidates - pending;
  const raceCount = frozen.races?.length ?? 0;

  return {
    oddsMax: settings.oddsMax,
    raceCount,
    candidates,
    settled,
    pending,
    placeHits,
    ticketHits,
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
    if (d.settled > 0 && d.virtualReturnRatePercent != null) {
      sum.stakeProxy += d.settled * 100;
      sum.payoutProxy += (d.virtualReturnRatePercent / 100) * d.settled * 100;
    }
    for (const [band, b] of Object.entries(d.byOddsBand ?? {})) {
      byOddsBand[band] ??= { n: 0, settled: 0, placeHits: 0, ticketHits: 0 };
      byOddsBand[band].n += b.n;
      byOddsBand[band].settled += b.settled;
      byOddsBand[band].placeHits += b.placeHits;
      byOddsBand[band].ticketHits += b.ticketHits;
    }
    for (const [bt, b] of Object.entries(d.byBetType ?? {})) {
      byBetType[bt] ??= { n: 0, settled: 0, placeHits: 0, ticketHits: 0 };
      byBetType[bt].n += b.n;
      byBetType[bt].settled += b.settled;
      byBetType[bt].placeHits += b.placeHits;
      byBetType[bt].ticketHits += b.ticketHits;
    }
  }

  const withRates = (map) =>
    Object.fromEntries(
      Object.entries(map).map(([k, v]) => [
        k,
        {
          ...v,
          placePrecision: v.settled > 0 ? v.placeHits / v.settled : null,
          ticketPrecision: v.settled > 0 ? v.ticketHits / v.settled : null,
        },
      ]),
    );

  return {
    candidates: sum.candidates,
    settled: sum.settled,
    pending: sum.pending,
    placeHits: sum.placeHits,
    ticketHits: sum.ticketHits,
    raceCount: sum.raceCount,
    placePrecision: sum.settled > 0 ? sum.placeHits / sum.settled : null,
    ticketPrecision: sum.settled > 0 ? sum.ticketHits / sum.settled : null,
    density: sum.raceCount > 0 ? sum.candidates / sum.raceCount : null,
    virtualReturnRatePercent:
      sum.stakeProxy > 0
        ? Number(((sum.payoutProxy / sum.stakeProxy) * 100).toFixed(1))
        : null,
    byOddsBand: withRates(byOddsBand),
    byBetType: withRates(byBetType),
  };
}

/** ticket 優先。密度 2未満は製品ボードとして不採用。3〜12 を優遇。 */
function scoreCap(m) {
  if (m.settled < 40) return -Infinity;
  const dens = m.density ?? 0;
  if (dens < 2) return -Infinity;
  const ticket = (m.ticketPrecision ?? 0) * 100;
  const rr = Math.min(m.virtualReturnRatePercent ?? 0, 250) / 10;
  const densityPenalty = dens > 15 ? (dens - 15) * 0.4 : 0;
  const densityBonus = dens >= 3 && dens <= 12 ? 8 : dens >= 2 && dens < 3 ? 4 : 0;
  const place = (m.placePrecision ?? 0) * 10;
  // 的中件数の絶対量が極端に減るキャップを軽く減点（ベースライン比は呼び出し側で見る）
  const hitFloor = m.ticketHits >= 7 ? 4 : m.ticketHits >= 6 ? 0 : -8;
  return ticket * 50 + rr * 2.5 + place + densityBonus + hitFloor - densityPenalty;
}

function labelCap(oddsMax) {
  return oddsMax == null ? "none" : String(oddsMax);
}

async function main() {
  const dates =
    process.argv.slice(2).filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)).length > 0
      ? process.argv.slice(2).filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
      : ["2026-07-25", "2026-07-26", "2026-08-01", "2026-08-02"];

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
    const withResults = [...resultByRace.values()].filter((r) => r?.finishes?.length).length;
    console.log(`Loaded ${raceDate}: frozen=${frozen.races?.length} liveWithResults=${withResults}`);
    dayData.push({ raceDate, frozen, resultByRace });
  }

  if (dayData.length === 0) {
    console.error("No days to sweep");
    process.exit(1);
  }

  const grid = [];
  for (const oddsMax of CAP_GRID) {
    const settings = {
      ...DEFAULT_SETTINGS,
      ...FIXED,
      oddsMax,
      enabledBetTypes: [...DEFAULT_SETTINGS.enabledBetTypes],
    };
    const perDay = dayData.map(({ raceDate, frozen, resultByRace }) => ({
      raceDate,
      ...evaluateSettings(frozen, resultByRace, settings),
    }));
    const merged = mergeDayMetrics(perDay);
    const row = {
      oddsMax,
      oddsMaxLabel: labelCap(oddsMax),
      fixed: FIXED,
      ...merged,
      utility: scoreCap(merged),
      perDay: perDay.map((d) => ({
        raceDate: d.raceDate,
        candidates: d.candidates,
        density: d.density,
        placePrecision: d.placePrecision,
        ticketPrecision: d.ticketPrecision,
        ticketHits: d.ticketHits,
        virtualReturnRatePercent: d.virtualReturnRatePercent,
      })),
    };
    grid.push(row);
    process.stdout.write(
      `  max=${labelCap(oddsMax).padEnd(4)} n=${String(merged.candidates).padStart(4)} dens=${merged.density?.toFixed(1).padStart(4)} place=${((merged.placePrecision ?? 0) * 100).toFixed(1).padStart(5)}% tick=${((merged.ticketPrecision ?? 0) * 100).toFixed(2).padStart(5)}% hits=${merged.ticketHits} RR=${String(merged.virtualReturnRatePercent).padStart(5)}%\n`,
    );
  }

  const baseline = grid.find((g) => g.oddsMax == null);
  const eligible = grid.filter((g) => Number.isFinite(g.utility));
  const ranked = [...eligible].sort((a, b) => b.utility - a.utility);
  const recommendation = ranked[0] ?? grid[0];

  const out = {
    builtAt: new Date().toISOString(),
    purpose: "B3 oddsMax sensitivity at fixed 25/75",
    dates: dayData.map((d) => d.raceDate),
    fixed: FIXED,
    rule: "exclude when odds > oddsMax; null = no cap",
    baseline: {
      oddsMax: null,
      ...baseline,
    },
    recommendation: {
      oddsMax: recommendation.oddsMax,
      rationale:
        "ticketPrecision と仮想回収を優先。密度 3〜12 を優遇。settled&lt;40 は不採用。既定反映は別コミットで1変更として入れる。",
      ...recommendation,
    },
    ranked: ranked.map((r) => ({
      oddsMax: r.oddsMax,
      candidates: r.candidates,
      density: r.density,
      placePrecision: r.placePrecision,
      ticketPrecision: r.ticketPrecision,
      ticketHits: r.ticketHits,
      virtualReturnRatePercent: r.virtualReturnRatePercent,
      utility: r.utility,
      share100plus:
        r.byOddsBand?.["100+"] != null && r.candidates > 0
          ? r.byOddsBand["100+"].n / r.candidates
          : 0,
    })),
    grid,
  };

  const outPath = path.join(
    loopRoot,
    "reports",
    `odds-cap-sweep-${dayData.map((d) => d.raceDate).join("_")}.json`,
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  console.log("\n=== Baseline (oddsMax=none, 25/75) ===");
  console.log(
    `  dens=${baseline?.density?.toFixed(1)} place=${((baseline?.placePrecision ?? 0) * 100).toFixed(1)}% tick=${((baseline?.ticketPrecision ?? 0) * 100).toFixed(2)}% RR=${baseline?.virtualReturnRatePercent}% n=${baseline?.candidates}`,
  );
  console.log("\n=== Recommendation ===");
  console.log(`  oddsMax=${labelCap(recommendation.oddsMax)}`);
  console.log(
    `  dens=${recommendation.density?.toFixed(1)} place=${((recommendation.placePrecision ?? 0) * 100).toFixed(1)}% tick=${((recommendation.ticketPrecision ?? 0) * 100).toFixed(2)}% RR=${recommendation.virtualReturnRatePercent}% n=${recommendation.candidates} hits=${recommendation.ticketHits}`,
  );
  console.log(`\nWrote ${path.relative(root, outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
