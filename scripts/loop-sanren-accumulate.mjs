/**
 * 3連系研究所レーン別ループ（本体 loop と KPI 合算しない）。
 *
 *   node scripts/loop-sanren-accumulate.mjs freeze [YYYY-MM-DD] [--lane=trio|trifecta|both] [--force]
 *   node scripts/loop-sanren-accumulate.mjs evaluate [YYYY-MM-DD] [--lane=trio|trifecta|both]
 *   node scripts/loop-sanren-accumulate.mjs report [YYYY-MM-DD ...] [--lane=trio|trifecta|both]
 *
 * 出力（レーンごと）:
 *   src/data/loop/sanren/{lane}/predictions/YYYY-MM-DD.json
 *   src/data/loop/sanren/{lane}/evaluations/YYYY-MM-DD.json
 *
 * 凍結オッズは本体と共有:
 *   src/data/loop/snapshots/YYYY-MM-DD.json
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluatePick,
  findPayoutYen,
  pickKey,
} from "./lib/loop-domain.mjs";
import {
  SANREN_LANES,
  defaultLaneSettings,
  selectSanrenLane,
  summarizeSanrenLabDensity,
} from "./lib/sanren-lab-domain.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const loopRoot = path.join(root, "src", "data", "loop");
const sanrenRoot = path.join(loopRoot, "sanren");
const liveSnapDir = path.join(root, "src", "data", "snapshots");

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeDate(arg) {
  if (!arg) return jstToday();
  if (/^\d{8}$/.test(arg)) {
    return `${arg.slice(0, 4)}-${arg.slice(4, 6)}-${arg.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) return arg;
  throw new Error(`Invalid date: ${arg}`);
}

function parseArgs(argv) {
  let lane = "both";
  let force = false;
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--force") {
      force = true;
      continue;
    }
    if (a === "--lane") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("--lane requires trio|trifecta|both");
      }
      lane = next;
      i += 1;
      continue;
    }
    if (a.startsWith("--lane=")) {
      lane = a.slice("--lane=".length);
      continue;
    }
    rest.push(a);
  }
  if (lane !== "both" && !SANREN_LANES.includes(lane)) {
    throw new Error(`Invalid --lane=${lane} (use trio|trifecta|both)`);
  }
  const lanes = lane === "both" ? [...SANREN_LANES] : [lane];
  return { lanes, force, rest };
}

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

async function writeJson(p, data) {
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function loadLiveSnapshot(raceDate) {
  const dated = path.join(liveSnapDir, `${raceDate}.json`);
  if (await exists(dated)) return { path: dated, data: await readJson(dated) };
  const latest = path.join(liveSnapDir, "latest.json");
  if (await exists(latest)) {
    const data = await readJson(latest);
    if (data.raceDate === raceDate) return { path: latest, data };
  }
  throw new Error(`No live snapshot for ${raceDate} under src/data/snapshots/`);
}

function stripResults(snapshot) {
  return {
    ...snapshot,
    frozenAt: new Date().toISOString(),
    purpose: "loop-pre-race-odds",
    races: (snapshot.races ?? []).map((r) => {
      const { result: _omit, ...rest } = r;
      return rest;
    }),
  };
}

function laneSettingsFromEnv(lane) {
  const settings = defaultLaneSettings(lane);
  if (process.env.ODDS_THRESHOLD) {
    settings.oddsThreshold = Number(process.env.ODDS_THRESHOLD);
  }
  if (process.env.SCORE_MIN) settings.scoreMin = Number(process.env.SCORE_MIN);
  if (process.env.ODDS_MAX === "none" || process.env.ODDS_MAX === "") {
    settings.oddsMax = null;
  } else if (process.env.ODDS_MAX) {
    settings.oddsMax = Number(process.env.ODDS_MAX);
  }
  if (process.env.TOP_N_PER_RACE) {
    settings.topNPerRace = Number(process.env.TOP_N_PER_RACE);
  }
  return settings;
}

function laneDirs(lane) {
  const base = path.join(sanrenRoot, lane);
  return {
    base,
    predictions: path.join(base, "predictions"),
    evaluations: path.join(base, "evaluations"),
    trends: path.join(base, "trends"),
    reports: path.join(base, "reports"),
  };
}

async function ensureFrozenOdds(raceDate, { force = false } = {}) {
  const frozenPath = path.join(loopRoot, "snapshots", `${raceDate}.json`);
  if ((await exists(frozenPath)) && !force) {
    console.log(`Freeze skip (exists): ${path.relative(root, frozenPath)}`);
    return { frozenPath, frozen: await readJson(frozenPath) };
  }
  const live = await loadLiveSnapshot(raceDate);
  const frozen = stripResults(live.data);
  frozen.raceDate = raceDate;
  frozen.sourceLivePath = path.relative(root, live.path).replace(/\\/g, "/");
  if (force && (await exists(frozenPath))) {
    console.log(`Freeze force overwrite: ${path.relative(root, frozenPath)}`);
  }
  await writeJson(frozenPath, frozen);
  console.log(`Frozen odds → ${path.relative(root, frozenPath)}`);
  return { frozenPath, frozen };
}

async function cmdFreezeLane(raceDate, lane, { force = false } = {}) {
  const { frozenPath, frozen } = await ensureFrozenOdds(raceDate, { force });
  const dirs = laneDirs(lane);
  const settings = laneSettingsFromEnv(lane);
  const picks = selectSanrenLane(lane, frozen.races ?? [], settings);
  const density = summarizeSanrenLabDensity(picks);
  const predPath = path.join(dirs.predictions, `${raceDate}.json`);
  const prediction = {
    savedAt: new Date().toISOString(),
    raceDate,
    lane,
    lab: "sanren",
    scorer: "ruleBased-sanren",
    settings,
    sourceFrozenSnapshot: path.relative(root, frozenPath).replace(/\\/g, "/"),
    raceCount: frozen.races?.length ?? 0,
    pickCount: picks.length,
    density: {
      racesWithPicks: density.raceCount,
      avgPerRace: density.avgPerRace,
      minPerRace: density.minPerRace,
      maxPerRace: density.maxPerRace,
      patternCounts: density.patternCounts,
    },
    picks,
    note: "研究所レーン。本体 predictions と合算しない。",
  };
  await writeJson(predPath, prediction);
  console.log(
    `[${lane}] Predictions → ${path.relative(root, predPath)} (${picks.length} picks · ${density.raceCount} R · avg ${density.avgPerRace.toFixed(1)})`,
  );
  return prediction;
}

async function cmdEvaluateLane(raceDate, lane) {
  const dirs = laneDirs(lane);
  const frozenPath = path.join(loopRoot, "snapshots", `${raceDate}.json`);
  const predPath = path.join(dirs.predictions, `${raceDate}.json`);
  const evalPath = path.join(dirs.evaluations, `${raceDate}.json`);

  if (!(await exists(predPath))) {
    console.log(`[${lane}] No prediction yet — running freeze first...`);
    await cmdFreezeLane(raceDate, lane);
  }

  if (!(await exists(frozenPath))) {
    throw new Error(`Missing frozen snapshot: ${frozenPath}`);
  }

  const frozen = await readJson(frozenPath);
  const prediction = await readJson(predPath);
  const live = await loadLiveSnapshot(raceDate);
  const settings = prediction.settings ?? laneSettingsFromEnv(lane);

  const resultByRace = new Map(
    (live.data.races ?? []).map((r) => [r.id, r.result]),
  );

  const rows = [];
  let placeHits = 0;
  let ticketHits = 0;
  let pending = 0;
  let stakeYen = 0;
  let payoutYen = 0;
  let ticketSettled = 0;
  const byLabel = {};
  const byPattern = {};

  for (const pick of prediction.picks ?? []) {
    const result = resultByRace.get(pick.raceId);
    const outcome = evaluatePick(pick, result);
    const placeHit = outcome === "win" || outcome === "place";
    const pay = findPayoutYen(result, pick.betType, pick.selection);
    const isTicketHit = pay != null && pay > 0;
    const onBoard = pick.odds != null;
    const virtualStake = 100;

    if (outcome !== "pending") {
      if (onBoard) {
        ticketSettled += 1;
        stakeYen += virtualStake;
        if (isTicketHit) {
          ticketHits += 1;
          payoutYen += pay;
        }
      }
      if (placeHit) placeHits += 1;
    } else {
      pending += 1;
    }

    const lab =
      byLabel[pick.label] ??
      (byLabel[pick.label] = { candidates: 0, placeHits: 0, ticketHits: 0, pending: 0 });
    lab.candidates += 1;
    if (placeHit && outcome !== "pending") lab.placeHits += 1;
    if (isTicketHit && outcome !== "pending" && onBoard) lab.ticketHits += 1;
    if (outcome === "pending") lab.pending += 1;

    const pat =
      byPattern[pick.pattern] ??
      (byPattern[pick.pattern] = {
        candidates: 0,
        placeHits: 0,
        ticketHits: 0,
        pending: 0,
      });
    pat.candidates += 1;
    if (placeHit && outcome !== "pending") pat.placeHits += 1;
    if (isTicketHit && outcome !== "pending" && onBoard) pat.ticketHits += 1;
    if (outcome === "pending") pat.pending += 1;

    rows.push({
      key: pickKey(pick),
      raceId: pick.raceId,
      venue: pick.venue,
      track: pick.track,
      betType: pick.betType,
      selection: pick.selection,
      odds: pick.odds,
      label: pick.label,
      pattern: pick.pattern,
      relatedScore: pick.relatedScore,
      hitScore: pick.hitScore,
      evScore: pick.evScore,
      axisHorseNumber: pick.axisHorseNumber,
      outcome,
      placeCircleHit: placeHit,
      ticketHit: outcome !== "pending" && onBoard && isTicketHit,
      payoutYen: pay,
    });
  }

  const candidates = prediction.picks?.length ?? 0;
  const settled = candidates - pending;
  const placePrecision = settled > 0 ? placeHits / settled : null;
  const ticketPrecision = ticketSettled > 0 ? ticketHits / ticketSettled : null;
  const raceCount = frozen.races?.length ?? 0;
  const density = raceCount > 0 ? candidates / raceCount : null;
  const virtualReturnRate =
    stakeYen > 0 ? Number(((payoutYen / stakeYen) * 100).toFixed(1)) : null;

  const evaluation = {
    evaluatedAt: new Date().toISOString(),
    raceDate,
    lane,
    lab: "sanren",
    settings,
    sources: {
      frozenSnapshot: path.relative(root, frozenPath).replace(/\\/g, "/"),
      prediction: path.relative(root, predPath).replace(/\\/g, "/"),
      liveSnapshot: path.relative(root, live.path).replace(/\\/g, "/"),
    },
    metrics: {
      raceCount,
      candidates,
      placeHits,
      ticketHits,
      pending,
      settledCandidates: settled,
      density,
      placePrecision,
      ticketPrecision,
      virtualStakeYen: stakeYen,
      virtualPayoutYen: payoutYen,
      virtualReturnRatePercent: virtualReturnRate,
      primaryMetric: "ticketPrecision",
      note: "主指標は ticketPrecision（払戻突合）。placePrecision は参考のみ。レーン合算禁止。",
    },
    byLabel,
    byPattern,
    rows,
  };

  await writeJson(evalPath, evaluation);

  try {
    const { buildSanrenTrends } = await import("./loop-sanren-trends.mjs");
    await buildSanrenTrends(lane);
  } catch (err) {
    console.warn(`[${lane}] trends rebuild skipped:`, err?.message ?? err);
  }

  console.log(`[${lane}] Evaluation → ${path.relative(root, evalPath)}`);
  console.log(
    `  n=${candidates} ticketHits=${ticketHits} placeHits=${placeHits} pending=${pending}`,
  );
  console.log(
    `  ticketP=${ticketPrecision == null ? "—" : ticketPrecision.toFixed(4)} placeP=${placePrecision == null ? "—" : placePrecision.toFixed(3)} dens=${density == null ? "—" : density.toFixed(2)} RR=${virtualReturnRate ?? "—"}%`,
  );
  return evaluation;
}

async function cmdReport(dates, lanes) {
  const createdAt = new Date().toISOString();
  const byLane = {};

  for (const lane of lanes) {
    const dirs = laneDirs(lane);
    const summaries = [];
    for (const d of dates) {
      const evalPath = path.join(dirs.evaluations, `${d}.json`);
      if (!(await exists(evalPath))) {
        console.log(`[${lane}] skip ${d} (no evaluation)`);
        continue;
      }
      const ev = await readJson(evalPath);
      summaries.push({ raceDate: d, ...ev.metrics });
    }
    byLane[lane] = summaries;

    const reportPath = path.join(
      dirs.reports,
      `report-${jstToday()}.json`,
    );
    await writeJson(reportPath, {
      createdAt,
      lab: "sanren",
      lane,
      primaryMetric: "ticketPrecision",
      days: summaries.length,
      summaries,
      note: "レーン別レポート。他レーンと合算しない。",
    });
    console.log(
      `[${lane}] Report → ${path.relative(root, reportPath)} (primary=ticketPrecision)`,
    );
    for (const s of summaries) {
      console.log(
        `  ${s.raceDate}  ticketP=${s.ticketPrecision == null ? "—" : s.ticketPrecision.toFixed(4)}  placeP=${s.placePrecision == null ? "—" : s.placePrecision.toFixed(3)}  n=${s.candidates}  ticketHits=${s.ticketHits ?? "—"}  dens=${s.density == null ? "—" : s.density.toFixed(1)}  RR=${s.virtualReturnRatePercent ?? "—"}%`,
      );
    }
  }

  // 比較用の並記のみ（合算 KPI は出さない）
  if (lanes.length > 1) {
    const comparePath = path.join(
      sanrenRoot,
      "reports",
      `compare-lanes-${jstToday()}.json`,
    );
    await writeJson(comparePath, {
      createdAt,
      lab: "sanren",
      primaryMetric: "ticketPrecision",
      note: "レーン並記のみ。combined / 合算 ticketPrecision は持たない。",
      byLane,
    });
    console.log(`Lane compare (no merge) → ${path.relative(root, comparePath)}`);
  }

  return byLane;
}

async function main() {
  const [, , cmd, ...argv] = process.argv;
  if (!cmd || !["freeze", "evaluate", "report"].includes(cmd)) {
    console.log(`Usage:
  node scripts/loop-sanren-accumulate.mjs freeze [YYYY-MM-DD] [--lane=trio|trifecta|both] [--force]
  node scripts/loop-sanren-accumulate.mjs evaluate [YYYY-MM-DD] [--lane=trio|trifecta|both]
  node scripts/loop-sanren-accumulate.mjs report [YYYY-MM-DD ...] [--lane=trio|trifecta|both]

Env (freeze 時・レーンごと): ODDS_THRESHOLD, SCORE_MIN, ODDS_MAX, TOP_N_PER_RACE
  --force … 共有 loop/snapshots を差し替え
  既定 --lane=both（KPI はレーン別のまま。合算しない）
`);
    process.exit(cmd ? 1 : 0);
  }

  const { lanes, force, rest } = parseArgs(argv);
  await mkdir(sanrenRoot, { recursive: true });

  if (cmd === "freeze") {
    const raceDate = normalizeDate(rest[0]);
    for (const lane of lanes) {
      await cmdFreezeLane(raceDate, lane, { force });
    }
    return;
  }
  if (cmd === "evaluate") {
    const raceDate = normalizeDate(rest[0]);
    for (const lane of lanes) {
      await cmdEvaluateLane(raceDate, lane);
    }
    return;
  }
  if (cmd === "report") {
    const dates = rest.length ? rest.map(normalizeDate) : [jstToday()];
    await cmdReport(dates, lanes);
  }
}

const isDirect =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { cmdFreezeLane, cmdEvaluateLane, cmdReport, parseArgs };
