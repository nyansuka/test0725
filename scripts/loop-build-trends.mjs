/**
 * loop/evaluations を集約して短評用の傾向インデックスを作る。
 *
 *   node scripts/loop-build-trends.mjs
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
  return { candidates: 0, hits: 0, pending: 0 };
}

function bump(map, key, outcome) {
  if (!map[key]) map[key] = emptyBucket();
  map[key].candidates += 1;
  if (outcome === "win" || outcome === "place" || outcome === "hit") map[key].hits += 1;
  if (outcome === "pending") map[key].pending += 1;
}

function withPrecision(bucket) {
  const settled = bucket.candidates - bucket.pending;
  return {
    ...bucket,
    settled,
    precision: settled > 0 ? bucket.hits / settled : null,
  };
}

function finalize(map) {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, withPrecision(v)]));
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
      const outcome = row.outcome;
      const venue = row.venue ?? venueFromRaceId(row.raceId);
      const track = row.track ?? null;

      overall.candidates += 1;
      if (outcome === "win" || outcome === "place" || outcome === "hit") overall.hits += 1;
      if (outcome === "pending") overall.pending += 1;

      slice.overall.candidates += 1;
      if (outcome === "win" || outcome === "place" || outcome === "hit") slice.overall.hits += 1;
      if (outcome === "pending") slice.overall.pending += 1;

      bump(byDay, raceDate, outcome);
      bump(byBetType, row.betType, outcome);
      bump(byVenue, venue, outcome);
      bump(byLabel, row.label ?? "—", outcome);
      bump(byOddsBand, oddsBand(Number(row.odds) || 0), outcome);
      bump(slice.byBetType, row.betType, outcome);
      bump(slice.byVenue, venue, outcome);
      bump(slice.byLabel, row.label ?? "—", outcome);
      bump(slice.byOddsBand, oddsBand(Number(row.odds) || 0), outcome);
      if (track) {
        bump(byTrack, track, outcome);
        bump(byVenueTrack, `${venue}|${track}`, outcome);
        bump(slice.byTrack, track, outcome);
        bump(slice.byVenueTrack, `${venue}|${track}`, outcome);
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
    note: "候補の過去的中率。馬単位の成績ではない。短評は excludeRaceDate 以外の daySlices を合算して参照する。",
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(trends, null, 2)}\n`, "utf8");
  console.log(
    `Trends → ${path.relative(root, outPath)} (days=${trends.dayCount}, candidates=${overall.candidates})`,
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
