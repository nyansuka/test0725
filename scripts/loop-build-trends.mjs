/**
 * loop/evaluations を集約して短評用の傾向インデックスを作る。
 *
 *   node scripts/loop-build-trends.mjs
 *
 * 主指標: ticketPrecision（券種払戻）。precision は複勝圏（互換）。
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const evalDir = path.join(root, "src", "data", "loop", "evaluations");
const outPath = path.join(root, "src", "data", "loop", "trends", "latest.json");

const SLUG_VENUE = {
  sapporo: "札幌",
  hakodate: "函館",
  fukushima: "福島",
  niigata: "新潟",
  tokyo: "東京",
  nakayama: "中山",
  chukyo: "中京",
  kyoto: "京都",
  hanshin: "阪神",
  kokura: "小倉",
};

function venueFromRaceId(raceId) {
  const slug = String(raceId).split("-")[0];
  return SLUG_VENUE[slug] ?? slug;
}

function oddsBand(odds) {
  if (odds < 50) return "20-49";
  if (odds < 100) return "50-99";
  return "100+";
}

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
    /** 複勝圏（互換・参考） */
    precision: settled > 0 ? bucket.hits / settled : null,
    placePrecision: settled > 0 ? bucket.hits / settled : null,
    /** 主指標: 券種払戻ヒット */
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

export async function buildTrends() {
  await mkdir(evalDir, { recursive: true });
  const files = (await readdir(evalDir))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();

  const byBetType = {};
  const byVenue = {};
  const byTrack = {};
  const byLabel = {};
  const byOddsBand = {};
  const byVenueTrack = {};
  const byDay = {};
  const daySlices = {};

  let overall = emptyBucket();

  for (const file of files) {
    const raceDate = file.replace(/\.json$/, "");
    const ev = JSON.parse(await readFile(path.join(evalDir, file), "utf8"));
    const slice = {
      byBetType: {},
      byVenue: {},
      byTrack: {},
      byLabel: {},
      byOddsBand: {},
      byVenueTrack: {},
      overall: emptyBucket(),
    };
    byDay[raceDate] = emptyBucket();

    for (const row of ev.rows ?? []) {
      const flags = rowFlags(row);
      const venue = row.venue ?? venueFromRaceId(row.raceId);
      const track = row.track ?? null;

      overall.candidates += 1;
      if (flags.placeHit) overall.hits += 1;
      if (flags.ticketHit) overall.ticketHits += 1;
      if (flags.pending) overall.pending += 1;

      slice.overall.candidates += 1;
      if (flags.placeHit) slice.overall.hits += 1;
      if (flags.ticketHit) slice.overall.ticketHits += 1;
      if (flags.pending) slice.overall.pending += 1;

      bump(byDay, raceDate, flags);
      bump(byBetType, row.betType, flags);
      bump(byVenue, venue, flags);
      bump(byLabel, row.label ?? "—", flags);
      bump(byOddsBand, oddsBand(Number(row.odds) || 0), flags);
      bump(slice.byBetType, row.betType, flags);
      bump(slice.byVenue, venue, flags);
      bump(slice.byLabel, row.label ?? "—", flags);
      bump(slice.byOddsBand, oddsBand(Number(row.odds) || 0), flags);
      if (track) {
        bump(byTrack, track, flags);
        bump(byVenueTrack, `${venue}|${track}`, flags);
        bump(slice.byTrack, track, flags);
        bump(slice.byVenueTrack, `${venue}|${track}`, flags);
      }
    }

    daySlices[raceDate] = {
      overall: withPrecision(slice.overall),
      byBetType: finalize(slice.byBetType),
      byVenue: finalize(slice.byVenue),
      byTrack: finalize(slice.byTrack),
      byLabel: finalize(slice.byLabel),
      byOddsBand: finalize(slice.byOddsBand),
      byVenueTrack: finalize(slice.byVenueTrack),
    };
  }

  const trends = {
    builtAt: new Date().toISOString(),
    source: "src/data/loop/evaluations",
    primaryMetric: "ticketPrecision",
    dayCount: files.length,
    dates: files.map((f) => f.replace(/\.json$/, "")),
    minSamples: 20,
    overall: withPrecision(overall),
    byDay: finalize(byDay),
    byBetType: finalize(byBetType),
    byVenue: finalize(byVenue),
    byTrack: finalize(byTrack),
    byLabel: finalize(byLabel),
    byOddsBand: finalize(byOddsBand),
    byVenueTrack: finalize(byVenueTrack),
    daySlices,
    note: "主指標 ticketPrecision=券種払戻ヒット。precision/placePrecision=関係馬≤3着（参考）。短評は excludeRaceDate 以外の daySlices を合算。",
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(trends, null, 2)}\n`, "utf8");
  console.log(
    `Trends → ${path.relative(root, outPath)} (days=${trends.dayCount}, candidates=${overall.candidates}, ticketP=${trends.overall.ticketPrecision?.toFixed(4) ?? "—"})`,
  );
  return trends;
}

const isDirect =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  buildTrends().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
