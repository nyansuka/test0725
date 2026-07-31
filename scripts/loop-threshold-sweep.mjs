/**
 * 凍結オッズ × 確定結果で oddsThreshold / scoreMin を感度スイープする。
 * 予測ファイルは書き換えない（メモリ上で選別・評価）。
 *
 *   node scripts/loop-threshold-sweep.mjs [YYYY-MM-DD ...]
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
} from "./lib/loop-domain.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const loopRoot = path.join(root, "src", "data", "loop");
const liveSnapDir = path.join(root, "src", "data", "snapshots");

const ODDS_GRID = [20, 25, 30, 40, 50, 60, 80, 100];
const SCORE_GRID = [55, 60, 65, 70, 75, 80];

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

function evaluateSettings(frozen, resultByRace, settings) {
  const picks = selectLongshots(frozen.races ?? [], settings);
  let candidateHits = 0;
  let candidatePending = 0;
  let ticketHits = 0;
  let stakeYen = 0;
  let payoutYen = 0;
  const byScoreBand = {};
  const byOddsBand = {};

  for (const pick of picks) {
    const result = resultByRace.get(pick.raceId);
    const outcome = evaluatePick(pick, result);
    const success = outcome === "win" || outcome === "place";
    const pay = findPayoutYen(result, pick.betType, pick.selection);
    const virtualStake = 100;

    if (outcome === "pending") {
      candidatePending += 1;
    } else {
      stakeYen += virtualStake;
      if (success) {
        candidateHits += 1;
        if (pay != null && pay > 0) {
          ticketHits += 1;
          payoutYen += pay;
        } else if (outcome === "win" && pick.betType === "win") {
          ticketHits += 1;
          payoutYen += Math.round(pick.odds * virtualStake);
        }
      }
    }

    const sb =
      pick.relatedPlacePotential >= 80
        ? "80+"
        : pick.relatedPlacePotential >= 70
          ? "70-79"
          : pick.relatedPlacePotential >= 65
            ? "65-69"
            : pick.relatedPlacePotential >= 60
              ? "60-64"
              : "55-59";
    const ob =
      pick.odds >= 100 ? "100+" : pick.odds >= 50 ? "50-99" : pick.odds >= 30 ? "30-49" : "20-29";
    for (const [key, map] of [
      [sb, byScoreBand],
      [ob, byOddsBand],
    ]) {
      map[key] ??= { n: 0, hits: 0, settled: 0, ticketHits: 0 };
      map[key].n += 1;
      if (outcome !== "pending") {
        map[key].settled += 1;
        if (success) map[key].hits += 1;
        if (pay != null && pay > 0) map[key].ticketHits += 1;
      }
    }
  }

  let gateCorrect = 0;
  for (const race of frozen.races ?? []) {
    const result = resultByRace.get(race.id);
    for (const entry of race.oddsBoard ?? []) {
      const row = classifyOddsEntry(race, entry, settings);
      if (row.status !== "candidate" && row.status !== "pass") continue;
      const probe = {
        raceId: race.id,
        betType: entry.betType,
        selection: entry.selection,
        relatedHorseNumbers: row.relatedHorseNumbers,
      };
      const outcome = evaluatePick(probe, result);
      if (outcome === "win" || outcome === "place") gateCorrect += 1;
    }
  }

  const candidates = picks.length;
  const settled = candidates - candidatePending;
  const precision = settled > 0 ? candidateHits / settled : null;
  const recall = gateCorrect > 0 ? candidateHits / gateCorrect : null;
  const ticketPrecision = settled > 0 ? ticketHits / settled : null;
  const raceCount = frozen.races?.length ?? 0;
  const density = raceCount > 0 ? candidates / raceCount : null;
  const virtualRR = stakeYen > 0 ? (payoutYen / stakeYen) * 100 : null;

  return {
    oddsThreshold: settings.oddsThreshold,
    scoreMin: settings.scoreMin,
    raceCount,
    candidates,
    settled,
    pending: candidatePending,
    placeHits: candidateHits,
    ticketHits,
    gateCorrect,
    precision,
    recall,
    ticketPrecision,
    density,
    virtualReturnRatePercent: virtualRR == null ? null : Number(virtualRR.toFixed(1)),
    byScoreBand,
    byOddsBand,
  };
}

function mergeDayMetrics(days) {
  const sum = {
    candidates: 0,
    settled: 0,
    pending: 0,
    placeHits: 0,
    ticketHits: 0,
    gateCorrect: 0,
    raceCount: 0,
    stakeProxy: 0,
    payoutProxy: 0,
  };
  for (const d of days) {
    sum.candidates += d.candidates;
    sum.settled += d.settled;
    sum.pending += d.pending;
    sum.placeHits += d.placeHits;
    sum.ticketHits += d.ticketHits;
    sum.gateCorrect += d.gateCorrect;
    sum.raceCount += d.raceCount;
    if (d.settled > 0 && d.virtualReturnRatePercent != null) {
      // reconstruct approx: RR% = payout/stake*100, stake=settled*100
      sum.stakeProxy += d.settled * 100;
      sum.payoutProxy += (d.virtualReturnRatePercent / 100) * d.settled * 100;
    }
  }
  return {
    candidates: sum.candidates,
    settled: sum.settled,
    pending: sum.pending,
    placeHits: sum.placeHits,
    ticketHits: sum.ticketHits,
    gateCorrect: sum.gateCorrect,
    raceCount: sum.raceCount,
    precision: sum.settled > 0 ? sum.placeHits / sum.settled : null,
    recall: sum.gateCorrect > 0 ? sum.placeHits / sum.gateCorrect : null,
    ticketPrecision: sum.settled > 0 ? sum.ticketHits / sum.settled : null,
    density: sum.raceCount > 0 ? sum.candidates / sum.raceCount : null,
    virtualReturnRatePercent:
      sum.stakeProxy > 0 ? Number(((sum.payoutProxy / sum.stakeProxy) * 100).toFixed(1)) : null,
  };
}

/** 製品目標: 密度を抑えつつ ticket / 仮想回収を優先。複勝圏 Precision は参考。 */
function scoreCombo(m) {
  if (m.settled < 50) return -Infinity;
  const densityPenalty =
    m.density == null ? 0 : m.density > 40 ? (m.density - 40) * 0.8 : m.density > 15 ? (m.density - 15) * 0.25 : 0;
  const densityBonus = m.density != null && m.density <= 12 ? 8 : m.density != null && m.density <= 25 ? 4 : 0;
  const ticket = (m.ticketPrecision ?? 0) * 100;
  const rr = Math.min(m.virtualReturnRatePercent ?? 0, 200) / 10;
  const place = (m.precision ?? 0) * 15;
  const recall = (m.recall ?? 0) * 10;
  return ticket * 40 + rr * 3 + place + recall + densityBonus - densityPenalty;
}

async function main() {
  const dates =
    process.argv.slice(2).filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)).length > 0
      ? process.argv.slice(2).filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
      : ["2026-07-25", "2026-07-26"];

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
    console.log(`Loaded ${raceDate}: frozen races=${frozen.races?.length} liveWithResults=${withResults}`);
    dayData.push({ raceDate, frozen, resultByRace });
  }

  if (dayData.length === 0) {
    console.error("No days to sweep");
    process.exit(1);
  }

  const grid = [];
  for (const oddsThreshold of ODDS_GRID) {
    for (const scoreMin of SCORE_GRID) {
      const settings = {
        ...DEFAULT_SETTINGS,
        oddsThreshold,
        scoreMin,
        enabledBetTypes: [...DEFAULT_SETTINGS.enabledBetTypes],
      };
      const perDay = dayData.map(({ raceDate, frozen, resultByRace }) => ({
        raceDate,
        ...evaluateSettings(frozen, resultByRace, settings),
      }));
      const merged = mergeDayMetrics(perDay);
      const row = {
        oddsThreshold,
        scoreMin,
        ...merged,
        utility: scoreCombo(merged),
        perDay: perDay.map((d) => ({
          raceDate: d.raceDate,
          candidates: d.candidates,
          density: d.density,
          precision: d.precision,
          recall: d.recall,
          ticketPrecision: d.ticketPrecision,
          virtualReturnRatePercent: d.virtualReturnRatePercent,
        })),
      };
      grid.push(row);
      process.stdout.write(
        `  thr=${oddsThreshold} min=${scoreMin} n=${merged.candidates} dens=${merged.density?.toFixed(1)} P=${merged.precision?.toFixed(3)} tick=${merged.ticketPrecision?.toFixed(4)} RR=${merged.virtualReturnRatePercent}%\n`,
      );
    }
  }

  const baseline = grid.find((g) => g.oddsThreshold === 20 && g.scoreMin === 60);
  const ranked = [...grid].sort((a, b) => b.utility - a.utility);

  // 1軸感度（もう一方は現行固定）
  const oddsOnly = grid.filter((g) => g.scoreMin === 60);
  const scoreOnly = grid.filter((g) => g.oddsThreshold === 20);

  // 密度ターゲット帯（製品: 数件〜十数件/レース）
  const densityTargets = grid
    .filter((g) => g.density != null && g.density >= 3 && g.density <= 25)
    .sort((a, b) => b.utility - a.utility);

  const recommendation = densityTargets[0] ?? ranked[0];

  const out = {
    builtAt: new Date().toISOString(),
    dates: dayData.map((d) => d.raceDate),
    baseline: { oddsThreshold: 20, scoreMin: 60, ...baseline },
    recommendation: {
      oddsThreshold: recommendation.oddsThreshold,
      scoreMin: recommendation.scoreMin,
      rationale:
        "仮想回収率・券種払戻ヒット・候補密度（短時間で見極める）を優先。複勝圏 Precision は参考指標。",
      ...recommendation,
    },
    top10: ranked.slice(0, 10).map((r) => ({
      oddsThreshold: r.oddsThreshold,
      scoreMin: r.scoreMin,
      candidates: r.candidates,
      density: r.density,
      precision: r.precision,
      recall: r.recall,
      ticketPrecision: r.ticketPrecision,
      virtualReturnRatePercent: r.virtualReturnRatePercent,
      utility: r.utility,
    })),
    densityBand: densityTargets.slice(0, 8).map((r) => ({
      oddsThreshold: r.oddsThreshold,
      scoreMin: r.scoreMin,
      density: r.density,
      precision: r.precision,
      ticketPrecision: r.ticketPrecision,
      virtualReturnRatePercent: r.virtualReturnRatePercent,
      utility: r.utility,
    })),
    oddsSweepAtScore60: oddsOnly.map((r) => ({
      oddsThreshold: r.oddsThreshold,
      density: r.density,
      precision: r.precision,
      ticketPrecision: r.ticketPrecision,
      virtualReturnRatePercent: r.virtualReturnRatePercent,
      candidates: r.candidates,
    })),
    scoreSweepAtOdds20: scoreOnly.map((r) => ({
      scoreMin: r.scoreMin,
      density: r.density,
      precision: r.precision,
      ticketPrecision: r.ticketPrecision,
      virtualReturnRatePercent: r.virtualReturnRatePercent,
      candidates: r.candidates,
    })),
    grid,
  };

  const outPath = path.join(loopRoot, "reports", `threshold-sweep-${dayData.map((d) => d.raceDate).join("_")}.json`);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  console.log("\n=== Baseline (20 / 60) ===");
  console.log(
    `  dens=${baseline?.density?.toFixed(1)} P=${baseline?.precision?.toFixed(3)} tick=${baseline?.ticketPrecision?.toFixed(4)} RR=${baseline?.virtualReturnRatePercent}% n=${baseline?.candidates}`,
  );
  console.log("\n=== Recommendation ===");
  console.log(
    `  oddsThreshold=${recommendation.oddsThreshold} scoreMin=${recommendation.scoreMin}`,
  );
  console.log(
    `  dens=${recommendation.density?.toFixed(1)} P=${recommendation.precision?.toFixed(3)} tick=${recommendation.ticketPrecision?.toFixed(4)} RR=${recommendation.virtualReturnRatePercent}% n=${recommendation.candidates}`,
  );
  console.log(`\nWrote ${path.relative(root, outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
