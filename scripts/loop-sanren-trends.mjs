/**
 * 研究所レーン別 trends（本体 trends と混ぜない）。
 *
 *   node scripts/loop-sanren-trends.mjs [trio|trifecta|both]
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SANREN_LANES } from "./lib/sanren-lab-domain.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sanrenRoot = path.join(root, "src", "data", "loop", "sanren");

function emptyBucket() {
  return { candidates: 0, hits: 0, ticketHits: 0, pending: 0 };
}

function bump(map, key, { placeHit, ticketHit, pending }) {
  if (!map[key]) map[key] = emptyBucket();
  map[key].candidates += 1;
  if (placeHit) map[key].hits += 1;
  if (ticketHit) map[key].ticketHits += 1;
  if (pending) map[key].pending += 1;
}

function withPrecision(bucket) {
  const settled = bucket.candidates - bucket.pending;
  return {
    ...bucket,
    settled,
    placePrecision: settled > 0 ? bucket.hits / settled : null,
    /** @deprecated 互換。placePrecision と同値 */
    precision: settled > 0 ? bucket.hits / settled : null,
    ticketPrecision: settled > 0 ? (bucket.ticketHits ?? 0) / settled : null,
  };
}

function finalize(map) {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, withPrecision(v)]));
}

function rowFlags(row) {
  const outcome = row.outcome;
  const pending = outcome === "pending";
  const placeHit =
    row.placeCircleHit === true ||
    outcome === "win" ||
    outcome === "place" ||
    outcome === "hit";
  const ticketHit =
    row.ticketHit === true ||
    (typeof row.payoutYen === "number" && row.payoutYen > 0);
  return { placeHit: !pending && placeHit, ticketHit: !pending && ticketHit, pending };
}

export async function buildSanrenTrends(lane) {
  if (!SANREN_LANES.includes(lane)) {
    throw new Error(`Unknown lane: ${lane}`);
  }
  const evalDir = path.join(sanrenRoot, lane, "evaluations");
  const outPath = path.join(sanrenRoot, lane, "trends", "latest.json");
  await mkdir(evalDir, { recursive: true });

  let files = [];
  try {
    files = (await readdir(evalDir))
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort();
  } catch {
    files = [];
  }

  const byLabel = {};
  const byPattern = {};
  const byOddsBand = {};
  const byDay = {};
  const daySlices = {};
  let overall = emptyBucket();

  function oddsBand(odds) {
    if (odds < 100) return "lt100";
    if (odds < 200) return "100-199";
    if (odds < 500) return "200-499";
    return "500+";
  }

  for (const file of files) {
    const raceDate = file.replace(/\.json$/, "");
    const ev = JSON.parse(await readFile(path.join(evalDir, file), "utf8"));
    const slice = {
      overall: emptyBucket(),
      byLabel: {},
      byPattern: {},
      byOddsBand: {},
    };
    byDay[raceDate] = emptyBucket();

    for (const row of ev.rows ?? []) {
      const flags = rowFlags(row);
      overall.candidates += 1;
      if (flags.placeHit) overall.hits += 1;
      if (flags.ticketHit) overall.ticketHits += 1;
      if (flags.pending) overall.pending += 1;

      slice.overall.candidates += 1;
      if (flags.placeHit) slice.overall.hits += 1;
      if (flags.ticketHit) slice.overall.ticketHits += 1;
      if (flags.pending) slice.overall.pending += 1;

      bump(byDay, raceDate, flags);
      bump(byLabel, row.label ?? "—", flags);
      bump(byPattern, row.pattern ?? "—", flags);
      bump(byOddsBand, oddsBand(Number(row.odds) || 0), flags);
      bump(slice.byLabel, row.label ?? "—", flags);
      bump(slice.byPattern, row.pattern ?? "—", flags);
      bump(slice.byOddsBand, oddsBand(Number(row.odds) || 0), flags);
    }

    daySlices[raceDate] = {
      overall: withPrecision(slice.overall),
      byLabel: finalize(slice.byLabel),
      byPattern: finalize(slice.byPattern),
      byOddsBand: finalize(slice.byOddsBand),
    };
  }

  const trends = {
    builtAt: new Date().toISOString(),
    lab: "sanren",
    lane,
    source: `src/data/loop/sanren/${lane}/evaluations`,
    primaryMetric: "ticketPrecision",
    dayCount: files.length,
    dates: files.map((f) => f.replace(/\.json$/, "")),
    minSamples: 20,
    overall: withPrecision(overall),
    byDay: finalize(byDay),
    byLabel: finalize(byLabel),
    byPattern: finalize(byPattern),
    byOddsBand: finalize(byOddsBand),
    daySlices,
    note: "レーン専用 trends。本体 loop/trends および他レーンと合算しない。主指標 ticketPrecision。",
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(trends, null, 2)}\n`, "utf8");
  console.log(
    `[${lane}] Trends → ${path.relative(root, outPath)} (days=${trends.dayCount}, n=${overall.candidates}, ticketP=${trends.overall.ticketPrecision?.toFixed(4) ?? "—"})`,
  );
  return trends;
}

async function main() {
  const arg = process.argv[2] ?? "both";
  const lanes =
    arg === "both" ? [...SANREN_LANES] : SANREN_LANES.includes(arg) ? [arg] : null;
  if (!lanes) {
    console.log("Usage: node scripts/loop-sanren-trends.mjs [trio|trifecta|both]");
    process.exit(1);
  }
  for (const lane of lanes) {
    await buildSanrenTrends(lane);
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
