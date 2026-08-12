/**
 * 研究所 S5: 1レーン・1パラメータ感度スイープ。
 * 予測ファイルは書き換えない。KPI はレーン内のみ（合算しない）。
 *
 *   node scripts/loop-sanren-sweep.mjs --lane=trio --param=oddsThreshold --values=80,100,150 [YYYY-MM-DD ...]
 *   node scripts/loop-sanren-sweep.mjs --lane=trifecta --param=scoreMin --values=55,60,65 2026-08-08 2026-08-09
 *
 * 許可パラメータ（同時に1つだけ）:
 *   oddsThreshold | scoreMin | topNPerRace | partnerCap2 | partnerCap3 | partnerCapHole | popularRankMax | holeRankMin | axisTopN
 */
import { mkdir, readFile, writeFile, access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatePick, findPayoutYen } from "./lib/loop-domain.mjs";
import {
  SANREN_LANES,
  defaultLaneSettings,
  selectSanrenLane,
  summarizeSanrenLabDensity,
} from "./lib/sanren-lab-domain.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const loopRoot = path.join(root, "src", "data", "loop");
const liveSnapDir = path.join(root, "src", "data", "snapshots");
const outDir = path.join(loopRoot, "sanren", "reports");

const ALLOWED_PARAMS = new Set([
  "oddsThreshold",
  "scoreMin",
  "topNPerRace",
  "partnerCap2",
  "partnerCap3",
  "partnerCapHole",
  "popularRankMax",
  "holeRankMin",
  "axisTopN",
]);

const DEFAULT_SWEEPS = {
  trio: { param: "oddsThreshold", values: [80, 100, 150] },
  trifecta: { param: "oddsThreshold", values: [150, 200, 300] },
};

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

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseArgs(argv) {
  let lane = null;
  let param = null;
  let values = null;
  const dates = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--lane" || a.startsWith("--lane=")) {
      lane = a.startsWith("--lane=") ? a.slice(7) : argv[++i];
      continue;
    }
    if (a === "--param" || a.startsWith("--param=")) {
      param = a.startsWith("--param=") ? a.slice(8) : argv[++i];
      continue;
    }
    if (a === "--values" || a.startsWith("--values=")) {
      const raw = a.startsWith("--values=") ? a.slice(9) : argv[++i];
      values = String(raw)
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
      continue;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(a) || /^\d{8}$/.test(a)) {
      dates.push(
        /^\d{8}$/.test(a)
          ? `${a.slice(0, 4)}-${a.slice(4, 6)}-${a.slice(6, 8)}`
          : a,
      );
      continue;
    }
    throw new Error(`Unknown arg: ${a}`);
  }
  if (!lane || !SANREN_LANES.includes(lane)) {
    throw new Error("--lane=trio|trifecta is required (one lane only)");
  }
  if (!param) param = DEFAULT_SWEEPS[lane].param;
  if (!ALLOWED_PARAMS.has(param)) {
    throw new Error(`--param must be one of: ${[...ALLOWED_PARAMS].join(", ")}`);
  }
  if (!values?.length) values = DEFAULT_SWEEPS[lane].values;
  return { lane, param, values, dates };
}

async function listFrozenDates() {
  const dir = path.join(loopRoot, "snapshots");
  if (!(await exists(dir))) return [];
  return (await readdir(dir))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

async function loadLive(raceDate) {
  const dated = path.join(liveSnapDir, `${raceDate}.json`);
  if (await exists(dated)) return await readJson(dated);
  throw new Error(`No live snapshot for ${raceDate}`);
}

function evaluateLaneDay(frozen, resultByRace, lane, settings) {
  const picks = selectSanrenLane(lane, frozen.races ?? [], settings);
  const density = summarizeSanrenLabDensity(picks);
  let placeHits = 0;
  let ticketHits = 0;
  let pending = 0;
  let stakeYen = 0;
  let payoutYen = 0;

  for (const pick of picks) {
    const result = resultByRace.get(pick.raceId);
    const outcome = evaluatePick(pick, result);
    const placeHit = outcome === "win" || outcome === "place";
    const pay = findPayoutYen(result, pick.betType, pick.selection);
    const ticketHit = pay != null && pay > 0;
    if (outcome === "pending") {
      pending += 1;
      continue;
    }
    stakeYen += 100;
    if (placeHit) placeHits += 1;
    if (ticketHit) {
      ticketHits += 1;
      payoutYen += pay;
    }
  }

  const settled = picks.length - pending;
  return {
    candidates: picks.length,
    racesWithPicks: density.raceCount,
    density: (frozen.races?.length ?? 0) > 0 ? picks.length / frozen.races.length : null,
    avgPerRaceWithPicks: density.avgPerRace,
    placeHits,
    ticketHits,
    pending,
    settled,
    placePrecision: settled > 0 ? placeHits / settled : null,
    ticketPrecision: settled > 0 ? ticketHits / settled : null,
    virtualReturnRatePercent:
      stakeYen > 0 ? Number(((payoutYen / stakeYen) * 100).toFixed(1)) : null,
    virtualStakeYen: stakeYen,
    virtualPayoutYen: payoutYen,
  };
}

function mergeDays(dayMetrics) {
  const sum = {
    candidates: 0,
    placeHits: 0,
    ticketHits: 0,
    pending: 0,
    settled: 0,
    raceCount: 0,
    racesWithPicks: 0,
    stakeYen: 0,
    payoutYen: 0,
  };
  for (const d of dayMetrics) {
    sum.candidates += d.candidates;
    sum.placeHits += d.placeHits;
    sum.ticketHits += d.ticketHits;
    sum.pending += d.pending;
    sum.settled += d.settled;
    sum.raceCount += d.raceCount ?? 0;
    sum.racesWithPicks += d.racesWithPicks;
    sum.stakeYen += d.virtualStakeYen;
    sum.payoutYen += d.virtualPayoutYen;
  }
  return {
    ...sum,
    density: sum.raceCount > 0 ? sum.candidates / sum.raceCount : null,
    avgPerRaceWithPicks:
      sum.racesWithPicks > 0 ? sum.candidates / sum.racesWithPicks : null,
    placePrecision: sum.settled > 0 ? sum.placeHits / sum.settled : null,
    ticketPrecision: sum.settled > 0 ? sum.ticketHits / sum.settled : null,
    virtualReturnRatePercent:
      sum.stakeYen > 0
        ? Number(((sum.payoutYen / sum.stakeYen) * 100).toFixed(1))
        : null,
  };
}

function direction(baseline, variant, key) {
  const a = baseline[key];
  const b = variant[key];
  if (a == null || b == null) return "—";
  if (b > a) return "↑";
  if (b < a) return "↓";
  return "→";
}

function fmtPct(x) {
  if (x == null) return "—";
  return `${(x * 100).toFixed(2)}%`;
}

function fmtDens(x) {
  if (x == null) return "—";
  return x.toFixed(2);
}

async function main() {
  const { lane, param, values, dates: dateArgs } = parseArgs(process.argv.slice(2));
  const dates = dateArgs.length ? dateArgs : await listFrozenDates();
  if (!dates.length) {
    throw new Error("No dates. Pass YYYY-MM-DD or freeze loop snapshots first.");
  }

  const baselineSettings = defaultLaneSettings(lane);
  const baselineValue = baselineSettings[param];
  if (baselineValue === undefined) {
    throw new Error(`Baseline settings missing ${param} for lane=${lane}`);
  }

  console.log(
    `S5 sweep lane=${lane} param=${param} values=[${values.join(",")}] baseline=${baselineValue} days=${dates.join(",")}`,
  );

  const byValue = [];

  for (const value of values) {
    const settings = { ...baselineSettings, [param]: value };
    const dayRows = [];
    for (const raceDate of dates) {
      const frozenPath = path.join(loopRoot, "snapshots", `${raceDate}.json`);
      if (!(await exists(frozenPath))) {
        console.log(`skip ${raceDate} (no frozen snapshot)`);
        continue;
      }
      const frozen = await readJson(frozenPath);
      const live = await loadLive(raceDate);
      const resultByRace = new Map(
        (live.races ?? []).map((r) => [r.id, r.result]),
      );
      const m = evaluateLaneDay(frozen, resultByRace, lane, settings);
      dayRows.push({
        raceDate,
        raceCount: frozen.races?.length ?? 0,
        ...m,
      });
    }
    const merged = mergeDays(dayRows);
    byValue.push({
      value,
      isBaseline: value === baselineValue,
      settings: { ...settings },
      merged,
      days: dayRows,
    });
    console.log(
      `  ${param}=${String(value).padStart(4)} n=${String(merged.candidates).padStart(4)} dens=${fmtDens(merged.density).padStart(5)} ticket=${fmtPct(merged.ticketPrecision).padStart(7)} hits=${merged.ticketHits} RR=${String(merged.virtualReturnRatePercent ?? "—").padStart(5)}% place=${fmtPct(merged.placePrecision)}`,
    );
  }

  const baseline =
    byValue.find((r) => r.isBaseline) ??
    byValue.find((r) => r.value === baselineValue) ??
    byValue[0];

  const comparisons = byValue
    .filter((r) => r !== baseline)
    .map((r) => ({
      value: r.value,
      vsBaseline: {
        density: direction(baseline.merged, r.merged, "density"),
        ticketPrecision: direction(baseline.merged, r.merged, "ticketPrecision"),
        virtualReturnRatePercent: direction(
          baseline.merged,
          r.merged,
          "virtualReturnRatePercent",
        ),
        candidates: direction(baseline.merged, r.merged, "candidates"),
      },
      delta: {
        density:
          baseline.merged.density != null && r.merged.density != null
            ? Number((r.merged.density - baseline.merged.density).toFixed(3))
            : null,
        ticketPrecision:
          baseline.merged.ticketPrecision != null &&
          r.merged.ticketPrecision != null
            ? Number(
                (
                  r.merged.ticketPrecision - baseline.merged.ticketPrecision
                ).toFixed(4),
              )
            : null,
        virtualReturnRatePercent:
          baseline.merged.virtualReturnRatePercent != null &&
          r.merged.virtualReturnRatePercent != null
            ? Number(
                (
                  r.merged.virtualReturnRatePercent -
                  baseline.merged.virtualReturnRatePercent
                ).toFixed(1),
              )
            : null,
        candidates: r.merged.candidates - baseline.merged.candidates,
        ticketHits: r.merged.ticketHits - baseline.merged.ticketHits,
      },
    }));

  // 推奨: ベースライン以外で ticket↑ を優先、同率なら密度が極端でないもの
  let recommendation = {
    value: baseline.value,
    reason: "baseline retained (no clearer ticket/RR lift)",
  };
  const ranked = [...byValue].sort((a, b) => {
    const ta = a.merged.ticketPrecision ?? -1;
    const tb = b.merged.ticketPrecision ?? -1;
    if (tb !== ta) return tb - ta;
    const ra = a.merged.virtualReturnRatePercent ?? -1;
    const rb = b.merged.virtualReturnRatePercent ?? -1;
    if (rb !== ra) return rb - ra;
    // prefer moderate density near baseline
    const da = Math.abs((a.merged.density ?? 0) - (baseline.merged.density ?? 0));
    const db = Math.abs((b.merged.density ?? 0) - (baseline.merged.density ?? 0));
    return da - db;
  });
  const best = ranked[0];
  if (best && best.value !== baseline.value) {
    const ticketLift =
      (best.merged.ticketPrecision ?? 0) > (baseline.merged.ticketPrecision ?? 0);
    const rrLift =
      (best.merged.virtualReturnRatePercent ?? 0) >
      (baseline.merged.virtualReturnRatePercent ?? 0);
    if (ticketLift || rrLift) {
      recommendation = {
        value: best.value,
        reason: ticketLift
          ? "higher ticketPrecision than baseline"
          : "higher virtual RR than baseline",
      };
    } else if (
      best.merged.ticketHits === baseline.merged.ticketHits &&
      best.merged.ticketHits === 0
    ) {
      recommendation = {
        value: baseline.value,
        reason:
          "all variants ticketHits=0 (board coverage); keep baseline until board thickens — density direction only",
      };
    }
  }

  const report = {
    createdAt: new Date().toISOString(),
    lab: "sanren",
    phase: "S5",
    lane,
    param,
    values,
    baselineValue,
    dates,
    primaryMetric: "ticketPrecision",
    note: "1レーン・1パラメータのみ。他レーン同時変更禁止。合算 KPI なし。",
    byValue,
    comparisons,
    recommendation,
  };

  await mkdir(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `sweep-${lane}-${param}-${jstToday()}.json`,
  );
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Report → ${path.relative(root, outPath)}`);
  console.log(
    `Recommendation: ${param}=${recommendation.value} (${recommendation.reason})`,
  );
  console.log("Directions vs baseline:");
  for (const c of comparisons) {
    console.log(
      `  ${param}=${c.value} dens${c.vsBaseline.density} ticket${c.vsBaseline.ticketPrecision} RR${c.vsBaseline.virtualReturnRatePercent} (Δn=${c.delta.candidates})`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
