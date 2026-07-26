/**
 * 改善ループ用の日次 JSON 蓄積。
 *
 *   node scripts/loop-accumulate.mjs freeze [YYYY-MM-DD]
 *   node scripts/loop-accumulate.mjs evaluate [YYYY-MM-DD]
 *   node scripts/loop-accumulate.mjs report [YYYY-MM-DD ...]
 *
 * 出力:
 *   src/data/loop/snapshots/YYYY-MM-DD.json   … 発走前オッズ固定（既存なら上書きしない）
 *   src/data/loop/predictions/YYYY-MM-DD.json … 当時設定での候補
 *   src/data/loop/evaluations/YYYY-MM-DD.json … 結果突合＋指標
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SETTINGS,
  selectLongshots,
  classifyOddsEntry,
  evaluatePick,
  findPayoutYen,
  pickKey,
} from "./lib/loop-domain.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const loopRoot = path.join(root, "src", "data", "loop");
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

function settingsFromEnvOrDefault() {
  const settings = { ...DEFAULT_SETTINGS, enabledBetTypes: [...DEFAULT_SETTINGS.enabledBetTypes] };
  if (process.env.ODDS_THRESHOLD) settings.oddsThreshold = Number(process.env.ODDS_THRESHOLD);
  if (process.env.SCORE_MIN) settings.scoreMin = Number(process.env.SCORE_MIN);
  return settings;
}

function oddsQuality(races) {
  let realWinRaces = 0;
  let placeholderRaces = 0;
  let comboEntries = 0;
  for (const r of races ?? []) {
    const board = r.oddsBoard ?? [];
    const wins = board.filter((e) => e.betType === "win");
    const combos = board.filter((e) => e.betType !== "win" && e.betType !== "place");
    comboEntries += combos.length;
    const horse99 = (r.horses ?? []).filter((h) => h.oddsWin === 99.9).length;
    const field = (r.horses ?? []).length;
    if (field > 0 && horse99 === field) placeholderRaces += 1;
    else if (wins.some((e) => e.odds !== 99.9)) realWinRaces += 1;
  }
  return { realWinRaces, placeholderRaces, comboEntries, raceCount: races?.length ?? 0 };
}

async function cmdFreeze(raceDate, { force = false } = {}) {
  const frozenPath = path.join(loopRoot, "snapshots", `${raceDate}.json`);
  const predPath = path.join(loopRoot, "predictions", `${raceDate}.json`);
  const settings = settingsFromEnvOrDefault();

  let frozen;
  if (await exists(frozenPath) && !force) {
    console.log(`Freeze skip (exists): ${path.relative(root, frozenPath)}`);
    frozen = await readJson(frozenPath);
    const q = oddsQuality(frozen.races);
    if (q.placeholderRaces > 0 || q.comboEntries === 0) {
      console.log(
        `WARN thin freeze: realWin=${q.realWinRaces}/${q.raceCount} placeholder=${q.placeholderRaces} combos=${q.comboEntries} (re-fetch then freeze --force)`,
      );
    }
  } else {
    const live = await loadLiveSnapshot(raceDate);
    frozen = stripResults(live.data);
    frozen.raceDate = raceDate;
    frozen.sourceLivePath = path.relative(root, live.path).replace(/\\/g, "/");
    if (force && (await exists(frozenPath))) {
      console.log(`Freeze force overwrite: ${path.relative(root, frozenPath)}`);
    }
    await writeJson(frozenPath, frozen);
    const q = oddsQuality(frozen.races);
    console.log(
      `Frozen odds → ${path.relative(root, frozenPath)} (realWin=${q.realWinRaces}/${q.raceCount} combos=${q.comboEntries})`,
    );
  }

  const picks = selectLongshots(frozen.races ?? [], settings);
  const prediction = {
    savedAt: new Date().toISOString(),
    raceDate,
    scorer: "ruleBased",
    settings,
    sourceFrozenSnapshot: path.relative(root, frozenPath).replace(/\\/g, "/"),
    raceCount: frozen.races?.length ?? 0,
    pickCount: picks.length,
    picks,
  };
  await writeJson(predPath, prediction);
  console.log(`Predictions → ${path.relative(root, predPath)} (${picks.length} picks)`);
  return prediction;
}

function emptyByBet() {
  return Object.fromEntries(
    DEFAULT_SETTINGS.enabledBetTypes.map((b) => [
      b,
      { candidates: 0, hits: 0, gateCorrect: 0, pending: 0 },
    ]),
  );
}

async function cmdEvaluate(raceDate) {
  const frozenPath = path.join(loopRoot, "snapshots", `${raceDate}.json`);
  const predPath = path.join(loopRoot, "predictions", `${raceDate}.json`);
  const evalPath = path.join(loopRoot, "evaluations", `${raceDate}.json`);

  if (!(await exists(predPath))) {
    console.log("No prediction yet — running freeze first...");
    await cmdFreeze(raceDate);
  }

  const frozen = await readJson(frozenPath);
  const prediction = await readJson(predPath);
  const live = await loadLiveSnapshot(raceDate);
  const settings = prediction.settings ?? settingsFromEnvOrDefault();

  const resultByRace = new Map(
    (live.data.races ?? []).map((r) => [r.id, r.result]),
  );

  const rows = [];
  let candidateHits = 0;
  let candidatePending = 0;
  let stakeYen = 0;
  let payoutYen = 0;
  const byBet = emptyByBet();
  const byLabel = {
    注目穴: { candidates: 0, hits: 0, pending: 0 },
    抑え候補: { candidates: 0, hits: 0, pending: 0 },
  };

  for (const pick of prediction.picks ?? []) {
    const result = resultByRace.get(pick.raceId);
    const outcome = evaluatePick(pick, result);
    const pay = outcome === "hit" ? findPayoutYen(result, pick.betType, pick.selection) : null;
    const virtualStake = 100;
    if (outcome !== "pending") {
      stakeYen += virtualStake;
      if (outcome === "hit") {
        candidateHits += 1;
        payoutYen += pay ?? Math.round(pick.odds * virtualStake);
      }
    } else {
      candidatePending += 1;
    }

    byBet[pick.betType] ??= { candidates: 0, hits: 0, gateCorrect: 0, pending: 0 };
    byBet[pick.betType].candidates += 1;
    if (outcome === "hit") byBet[pick.betType].hits += 1;
    if (outcome === "pending") byBet[pick.betType].pending += 1;

    const lab = byLabel[pick.label] ?? (byLabel[pick.label] = { candidates: 0, hits: 0, pending: 0 });
    lab.candidates += 1;
    if (outcome === "hit") lab.hits += 1;
    if (outcome === "pending") lab.pending += 1;

    rows.push({
      key: pickKey(pick),
      raceId: pick.raceId,
      venue: pick.venue,
      track: pick.track,
      betType: pick.betType,
      selection: pick.selection,
      odds: pick.odds,
      label: pick.label,
      relatedPlacePotential: pick.relatedPlacePotential,
      outcome,
      payoutYen: pay,
    });
  }

  // ゲート正解集合: 凍結オッズ ≥ 閾値 かつ 的中
  let gateCorrect = 0;
  let gatePending = 0;
  const gateHits = [];
  for (const race of frozen.races ?? []) {
    const result = resultByRace.get(race.id);
    for (const entry of race.oddsBoard ?? []) {
      const row = classifyOddsEntry(race, entry, settings);
      if (row.status === "disabled_bet" || row.status === "below_threshold") continue;
      if (row.status === "no_related") continue;
      // ゲート通過 = オッズ条件を満たす（candidate / pass）
      if (row.status !== "candidate" && row.status !== "pass") continue;

      const probe = {
        raceId: race.id,
        betType: entry.betType,
        selection: entry.selection,
        relatedHorseNumbers: row.relatedHorseNumbers,
      };
      const outcome = evaluatePick(probe, result);
      if (outcome === "pending") {
        gatePending += 1;
        continue;
      }
      if (outcome === "hit") {
        gateCorrect += 1;
        byBet[entry.betType] ??= { candidates: 0, hits: 0, gateCorrect: 0, pending: 0 };
        byBet[entry.betType].gateCorrect += 1;
        gateHits.push({
          raceId: race.id,
          betType: entry.betType,
          selection: entry.selection,
          odds: entry.odds,
          wasCandidate: row.status === "candidate",
          wasPass: row.status === "pass",
        });
      }
    }
  }

  const candidates = prediction.picks?.length ?? 0;
  const settledCandidates = candidates - candidatePending;
  const precision =
    settledCandidates > 0 ? candidateHits / settledCandidates : null;
  const recall = gateCorrect > 0 ? candidateHits / gateCorrect : null;
  const raceCount = frozen.races?.length ?? 0;
  const density = raceCount > 0 ? candidates / raceCount : null;
  const virtualReturnRate =
    stakeYen > 0 ? Number(((payoutYen / stakeYen) * 100).toFixed(1)) : null;

  const missPasses = gateHits.filter((g) => g.wasPass).length;

  const evaluation = {
    evaluatedAt: new Date().toISOString(),
    raceDate,
    settings,
    sources: {
      frozenSnapshot: path.relative(root, frozenPath).replace(/\\/g, "/"),
      prediction: path.relative(root, predPath).replace(/\\/g, "/"),
      liveSnapshot: path.relative(root, live.path).replace(/\\/g, "/"),
    },
    metrics: {
      raceCount,
      candidates,
      candidateHits,
      candidatePending,
      settledCandidates,
      gateCorrect,
      gatePending,
      passMisses: missPasses,
      precision,
      recall,
      density,
      virtualStakeYen: stakeYen,
      virtualPayoutYen: payoutYen,
      virtualReturnRatePercent: virtualReturnRate,
      note: "factors が合成の場合、指標は製品挙動の評価であり真の適性モデル評価ではない",
    },
    byBetType: byBet,
    byLabel,
    rows,
    gateHits,
  };

  await writeJson(evalPath, evaluation);

  try {
    const { buildTrends } = await import("./loop-build-trends.mjs");
    await buildTrends();
  } catch (err) {
    console.warn("trends rebuild skipped:", err?.message ?? err);
  }

  console.log(`Evaluation → ${path.relative(root, evalPath)}`);
  console.log(
    `  candidates=${candidates} hits=${candidateHits} pending=${candidatePending} gateCorrect=${gateCorrect}`,
  );
  console.log(
    `  precision=${precision == null ? "—" : precision.toFixed(3)} recall=${recall == null ? "—" : recall.toFixed(3)} density=${density == null ? "—" : density.toFixed(2)} virtualRR=${virtualReturnRate ?? "—"}%`,
  );
  return evaluation;
}

async function cmdReport(dates) {
  const summaries = [];
  for (const d of dates) {
    const evalPath = path.join(loopRoot, "evaluations", `${d}.json`);
    if (!(await exists(evalPath))) {
      console.log(`skip ${d} (no evaluation)`);
      continue;
    }
    const ev = await readJson(evalPath);
    summaries.push({
      raceDate: d,
      ...ev.metrics,
    });
  }

  const reportPath = path.join(loopRoot, "reports", `report-${jstToday()}.json`);
  const report = {
    createdAt: new Date().toISOString(),
    days: summaries.length,
    summaries,
  };
  await writeJson(reportPath, report);

  console.log(`Report → ${path.relative(root, reportPath)}`);
  for (const s of summaries) {
    console.log(
      `  ${s.raceDate}  P=${s.precision == null ? "—" : s.precision.toFixed(3)}  R=${s.recall == null ? "—" : s.recall.toFixed(3)}  n=${s.candidates}  hits=${s.candidateHits}`,
    );
  }
  return report;
}

async function main() {
  const [, , cmd, ...argv] = process.argv;
  const force = argv.includes("--force");
  const rest = argv.filter((a) => a !== "--force");
  if (!cmd || !["freeze", "evaluate", "report"].includes(cmd)) {
    console.log(`Usage:
  node scripts/loop-accumulate.mjs freeze [YYYY-MM-DD] [--force]
  node scripts/loop-accumulate.mjs evaluate [YYYY-MM-DD]
  node scripts/loop-accumulate.mjs report [YYYY-MM-DD ...]

Env (freeze 時): ODDS_THRESHOLD, SCORE_MIN
  --force … 既存の loop/snapshots を発走前オッズで差し替え（薄い凍結のやり直し用）
`);
    process.exit(cmd ? 1 : 0);
  }

  await mkdir(loopRoot, { recursive: true });

  if (cmd === "freeze") {
    await cmdFreeze(normalizeDate(rest[0]), { force });
    return;
  }
  if (cmd === "evaluate") {
    await cmdEvaluate(normalizeDate(rest[0]));
    return;
  }
  if (cmd === "report") {
    const dates = rest.length ? rest.map(normalizeDate) : [jstToday()];
    await cmdReport(dates);
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

export { cmdFreeze, cmdEvaluate, cmdReport };
