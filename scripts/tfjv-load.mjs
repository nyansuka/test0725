/**
 * TFJV Race Results CSV → Neon（upsert）。
 *
 *   node scripts/tfjv-load.mjs [csvPath]
 *
 * 環境:
 *   DATABASE_URL … Neon 接続（可能なら direct / non-pooler）
 *   TFJV_CSV … 既定CSVパス上書き
 *
 * オプション:
 *   --limit=N       先頭から N 行（馬レコード）だけ
 *   --batch=N       INSERT バッチサイズ（既定 200）
 *   --truncate      ロード前に tfjv_* を空にする（初回用）
 *   --dry-run       DB に書かずパースのみ
 *
 * 週次: 差分または全件 CSV を同じコマンドで再実行（ON CONFLICT 更新）
 */
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import pg from "pg";
import {
  parseCsvLine,
  toNum,
  toInt,
  parseRaceDate,
  parseTimeSec,
  raceKey,
  stakesGrade,
  weightCarried,
} from "./lib/tfjv-csv.mjs";

const { Client } = pg;

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function resolveCsvPath(argv) {
  const positional = argv.find((a) => !a.startsWith("--"));
  if (positional) return resolve(positional);
  if (process.env.TFJV_CSV) return resolve(process.env.TFJV_CSV);
  const candidates = [
    "C:/TFJV/TXT/Race Results2000.utf8.csv",
    "/tfjv/Race Results2000.utf8.csv",
    "C:/TFJV/TXT/Race Results2000.csv",
    resolve(process.cwd(), "src/data/external/Race Results2000.utf8.csv"),
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  return candidates[0];
}

function flagNum(argv, name, fallback) {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const n = Number(hit.split("=")[1]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

loadEnvLocal();

const argv = process.argv.slice(2);
const csvPath = resolveCsvPath(argv);
const limit = flagNum(argv, "limit", 0);
const batchSize = flagNum(argv, "batch", 200);
const truncate = argv.includes("--truncate");
const dryRun = argv.includes("--dry-run");
const sourceLabel = csvPath.replace(/\\/g, "/").split("/").slice(-2).join("/");

const url = process.env.DATABASE_URL;
if (!dryRun && !url) {
  console.error("DATABASE_URL is missing (.env.local)");
  process.exit(1);
}
if (!existsSync(csvPath)) {
  console.error("CSV not found:", csvPath);
  process.exit(1);
}

function rowFromCols(headers, cols) {
  const get = (name) => {
    const i = headers.indexOf(name);
    return i >= 0 ? cols[i] ?? "" : "";
  };
  const dateRaw = get("日付");
  const kaijou = get("開催");
  const raceNo = toInt(get("Ｒ") || get("R"));
  const horseNumber = toInt(get("馬番"));
  if (!dateRaw || !kaijou || raceNo == null || horseNumber == null) return null;

  const raceName = get("レース名");
  const key = raceKey(dateRaw, kaijou, raceNo);
  const timeRaw = get("走破タイム");

  return {
    race: {
      race_key: key,
      race_date_raw: dateRaw,
      race_date: parseRaceDate(dateRaw),
      kaijou,
      race_no: raceNo,
      race_name: raceName || null,
      grade: stakesGrade(raceName),
      track: get("芝・ダ") || null,
      distance_m: toInt(get("距離")),
      course_type: get("コース区分") || null,
      baba: get("馬場状態") || null,
      head_count: toInt(get("頭数")),
      source_file: sourceLabel,
    },
    entry: {
      race_key: key,
      horse_number: horseNumber,
      horse_name: get("馬名") || null,
      jockey: get("騎手") || null,
      trainer: get("調教師") || null,
      sex: get("性別") || null,
      age: toInt(get("年齢")),
      weight_carried: weightCarried(get("斤量")),
      popularity: toInt(get("人気")),
      finish_rank: toInt(get("着順")),
      win_payout: toInt(get("単勝配当")),
      place_payout: toInt(get("複勝配当")),
      time_raw: timeRaw || null,
      time_sec: parseTimeSec(timeRaw),
      margin: get("着差") || null,
      last_3f: toNum(get("上り3F")),
      pci: toNum(get("PCI")),
      pci3: toNum(get("PCI3")),
      rpci: toNum(get("RPCI")),
      horse_weight: toInt(get("馬体重")),
      horse_weight_delta: toInt(get("馬体重増減")),
      corner_2: toInt(get("2角")),
      corner_3: toInt(get("3角")),
      corner_4: toInt(get("4角")),
    },
  };
}

async function flushRaces(client, races) {
  if (!races.length) return;
  const cols = [
    "race_key",
    "race_date_raw",
    "race_date",
    "kaijou",
    "race_no",
    "race_name",
    "grade",
    "track",
    "distance_m",
    "course_type",
    "baba",
    "head_count",
    "source_file",
  ];
  const values = [];
  const params = [];
  let p = 1;
  for (const r of races) {
    values.push(
      `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`,
    );
    for (const c of cols) params.push(r[c]);
  }
  await client.query(
    `INSERT INTO tfjv_races (${cols.join(",")})
     VALUES ${values.join(",")}
     ON CONFLICT (race_key) DO UPDATE SET
       race_date_raw = EXCLUDED.race_date_raw,
       race_date = EXCLUDED.race_date,
       kaijou = EXCLUDED.kaijou,
       race_no = EXCLUDED.race_no,
       race_name = EXCLUDED.race_name,
       grade = EXCLUDED.grade,
       track = EXCLUDED.track,
       distance_m = EXCLUDED.distance_m,
       course_type = EXCLUDED.course_type,
       baba = EXCLUDED.baba,
       head_count = EXCLUDED.head_count,
       source_file = EXCLUDED.source_file,
       updated_at = now()`,
    params,
  );
}

async function flushEntries(client, entries) {
  if (!entries.length) return;
  const cols = [
    "race_key",
    "horse_number",
    "horse_name",
    "jockey",
    "trainer",
    "sex",
    "age",
    "weight_carried",
    "popularity",
    "finish_rank",
    "win_payout",
    "place_payout",
    "time_raw",
    "time_sec",
    "margin",
    "last_3f",
    "pci",
    "pci3",
    "rpci",
    "horse_weight",
    "horse_weight_delta",
    "corner_2",
    "corner_3",
    "corner_4",
  ];
  const values = [];
  const params = [];
  let p = 1;
  for (const e of entries) {
    values.push(
      `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`,
    );
    for (const c of cols) params.push(e[c]);
  }
  await client.query(
    `INSERT INTO tfjv_entries (${cols.join(",")})
     VALUES ${values.join(",")}
     ON CONFLICT (race_key, horse_number) DO UPDATE SET
       horse_name = EXCLUDED.horse_name,
       jockey = EXCLUDED.jockey,
       trainer = EXCLUDED.trainer,
       sex = EXCLUDED.sex,
       age = EXCLUDED.age,
       weight_carried = EXCLUDED.weight_carried,
       popularity = EXCLUDED.popularity,
       finish_rank = EXCLUDED.finish_rank,
       win_payout = EXCLUDED.win_payout,
       place_payout = EXCLUDED.place_payout,
       time_raw = EXCLUDED.time_raw,
       time_sec = EXCLUDED.time_sec,
       margin = EXCLUDED.margin,
       last_3f = EXCLUDED.last_3f,
       pci = EXCLUDED.pci,
       pci3 = EXCLUDED.pci3,
       rpci = EXCLUDED.rpci,
       horse_weight = EXCLUDED.horse_weight,
       horse_weight_delta = EXCLUDED.horse_weight_delta,
       corner_2 = EXCLUDED.corner_2,
       corner_3 = EXCLUDED.corner_3,
       corner_4 = EXCLUDED.corner_4,
       updated_at = now()`,
    params,
  );
}

async function main() {
  console.log("csv", csvPath);
  console.log({ limit: limit || "all", batchSize, truncate, dryRun, sourceLabel });

  let client = null;
  if (!dryRun) {
    client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    if (truncate) {
      console.log("truncate tfjv_entries, tfjv_races…");
      await client.query("TRUNCATE tfjv_entries, tfjv_races");
    }
  }

  const rl = createInterface({
    input: createReadStream(csvPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let headers = null;
  let rowCount = 0;
  let parsed = 0;
  let skipped = 0;
  const raceMap = new Map();
  let entryBuf = [];
  const t0 = Date.now();

  async function flush() {
    if (dryRun) {
      raceMap.clear();
      entryBuf = [];
      return;
    }
    const races = [...raceMap.values()];
    raceMap.clear();
    const entries = entryBuf;
    entryBuf = [];
    if (races.length) await flushRaces(client, races);
    if (entries.length) await flushEntries(client, entries);
  }

  for await (const line of rl) {
    if (!line) continue;
    if (!headers) {
      headers = parseCsvLine(line);
      continue;
    }
    rowCount += 1;
    if (limit && rowCount > limit) break;

    const cols = parseCsvLine(line);
    const packed = rowFromCols(headers, cols);
    if (!packed) {
      skipped += 1;
      continue;
    }
    parsed += 1;
    raceMap.set(packed.race.race_key, packed.race);
    entryBuf.push(packed.entry);

    if (entryBuf.length >= batchSize) {
      await flush();
      if (parsed % 10000 === 0) {
        const sec = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`… parsed=${parsed} skipped=${skipped} ${sec}s`);
      }
    }
  }
  await flush();

  let counts = null;
  if (!dryRun) {
    const r = await client.query("SELECT COUNT(*)::int AS n FROM tfjv_races");
    const e = await client.query("SELECT COUNT(*)::int AS n FROM tfjv_entries");
    const g = await client.query(
      "SELECT grade, COUNT(*)::int AS n FROM tfjv_races WHERE grade IS NOT NULL GROUP BY grade ORDER BY grade",
    );
    counts = {
      races: r.rows[0].n,
      entries: e.rows[0].n,
      grades: Object.fromEntries(g.rows.map((x) => [x.grade, x.n])),
    };
    await client.end();
  }

  console.log({
    done: true,
    rowCount: limit ? Math.min(rowCount, limit) : rowCount,
    parsed,
    skipped,
    elapsedSec: Number(((Date.now() - t0) / 1000).toFixed(1)),
    counts,
  });
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
