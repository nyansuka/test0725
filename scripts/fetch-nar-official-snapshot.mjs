/**
 * keiba.go.jp 公式当日 ZIP を取得し src/data/snapshots-nar/ に保存する。
 *
 * Usage:
 *   node scripts/fetch-nar-official-snapshot.mjs
 *   node scripts/fetch-nar-official-snapshot.mjs --venues=南関東
 *   node scripts/fetch-nar-official-snapshot.mjs --venues=浦和,大井
 *   node scripts/fetch-nar-official-snapshot.mjs --from-dir=tmp/nar-probe/official
 *
 * 利用はデモ用途。オッズ等は主催者発表と照合すること。
 */
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildNarSnapshotFromOfficialCsv } from "./lib/nar-official-csv.mjs";
import { parseVenueFilter } from "./lib/nar-venues.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "src", "data", "snapshots-nar");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const RACE_URL = "https://www.keiba.go.jp/KeibaWeb/DataDownload/RaceDataDownload?type=daily";
const ODDS_URL = "https://www.keiba.go.jp/KeibaWeb/DataDownload/OddsDataDownload?type=daily";

function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function download(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "*/*",
      "Accept-Language": "ja",
      Referer: "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/TodayRaceInfoTop",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("zip") && !(buf[0] === 0x50 && buf[1] === 0x4b)) {
    throw new Error(`Not a zip from ${url} (ctype=${ctype}, len=${buf.length})`);
  }
  return buf;
}

async function unzipTo(buf, destDir) {
  await mkdir(destDir, { recursive: true });
  const zipPath = path.join(destDir, "download.zip");
  await writeFile(zipPath, buf);
  try {
    execFileSync("unzip", ["-o", zipPath, "-d", destDir], { stdio: "pipe" });
  } catch {
    // Windows / no unzip: try PowerShell Expand-Archive via tar if available
    try {
      execFileSync("tar", ["-xf", zipPath, "-C", destDir], { stdio: "pipe" });
    } catch (e) {
      throw new Error(`Failed to unzip (need unzip or tar): ${e}`);
    }
  }
}

async function findCsv(dir, suffix) {
  const files = await readdir(dir);
  const hit = files.find((f) => f.endsWith(suffix));
  if (!hit) return null;
  return path.join(dir, hit);
}

async function loadFromDir(dir) {
  const racelist =
    (await findCsv(dir, "_racelist.csv")) ||
    (await findCsv(path.join(dir, "race"), "_racelist.csv"));
  const horselist =
    (await findCsv(dir, "_horselist.csv")) ||
    (await findCsv(path.join(dir, "race"), "_horselist.csv"));
  const payback =
    (await findCsv(dir, "_payback.csv")) ||
    (await findCsv(path.join(dir, "race"), "_payback.csv"));
  const odds =
    (await findCsv(dir, "_odds.csv")) ||
    (await findCsv(path.join(dir, "odds"), "_odds.csv"));

  if (!racelist || !horselist) {
    throw new Error(`racelist/horselist not found under ${dir}`);
  }
  return {
    racelist: await readFile(racelist, "utf8"),
    horselist: await readFile(horselist, "utf8"),
    payback: payback ? await readFile(payback, "utf8") : "",
    odds: odds ? await readFile(odds, "utf8") : "",
    paths: { racelist, horselist, payback, odds },
  };
}

function jstToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

function shouldUpdateLatest(snapshotDate, force) {
  if (force) return true;
  if (!snapshotDate) return false;
  return snapshotDate <= jstToday();
}

function summarize(snapshot) {
  const byVenue = {};
  const betCounts = {};
  let withOdds = 0;
  let withResult = 0;
  let bracketExacta = 0;
  for (const r of snapshot.races) {
    byVenue[r.venue] = (byVenue[r.venue] || 0) + 1;
    if (r.oddsBoard?.length) withOdds += 1;
    if (r.result?.finishes?.length) withResult += 1;
    for (const e of r.oddsBoard ?? []) {
      betCounts[e.betType] = (betCounts[e.betType] || 0) + 1;
      if (e.betType === "bracket_exacta") bracketExacta += 1;
    }
  }
  return { byVenue, betCounts, withOdds, withResult, bracketExacta };
}

async function main() {
  const venueFilter = parseVenueFilter(argValue("--venues") ?? "南関東");
  const fromDir = argValue("--from-dir");
  const forceLatest = hasFlag("--force-latest");
  const dryRun = hasFlag("--dry-run");

  let files;
  let workDir = null;
  if (fromDir) {
    const abs = path.isAbsolute(fromDir) ? fromDir : path.join(root, fromDir);
    console.log(`Loading CSV from ${abs}`);
    files = await loadFromDir(abs);
  } else {
    workDir = await mkdtemp(path.join(os.tmpdir(), "nar-official-"));
    console.log("Downloading official daily ZIPs...");
    const [raceZip, oddsZip] = await Promise.all([download(RACE_URL), download(ODDS_URL)]);
    const raceDir = path.join(workDir, "race");
    const oddsDir = path.join(workDir, "odds");
    await unzipTo(raceZip, raceDir);
    await unzipTo(oddsZip, oddsDir);
    files = await loadFromDir(workDir);
    console.log("CSV paths", files.paths);
  }

  const snapshot = buildNarSnapshotFromOfficialCsv(
    {
      racelist: files.racelist,
      horselist: files.horselist,
      odds: files.odds,
      payback: files.payback,
    },
    { venueFilter },
  );

  const summary = summarize(snapshot);
  console.log(
    `Built authority=NAR date=${snapshot.raceDate} races=${snapshot.raceCount} venues=${snapshot.venues.join(",")}`,
  );
  console.log("byVenue", summary.byVenue);
  console.log("odds coverage", `${summary.withOdds}/${snapshot.raceCount}`, "results", summary.withResult);
  console.log("betCounts", summary.betCounts);
  console.log("bracket_exacta entries", summary.bracketExacta);

  if (!snapshot.raceDate) {
    throw new Error("No races in snapshot (check venue filter / CSV)");
  }

  if (dryRun) {
    console.log("dry-run: skip write");
    return;
  }

  await mkdir(outDir, { recursive: true });
  const dated = path.join(outDir, `${snapshot.raceDate}.json`);
  const body = JSON.stringify(snapshot, null, 2);
  await writeFile(dated, body);
  console.log(`Wrote ${path.relative(root, dated)}`);

  if (shouldUpdateLatest(snapshot.raceDate, forceLatest)) {
    await writeFile(path.join(outDir, "latest.json"), body);
    console.log(`Wrote ${path.relative(root, path.join(outDir, "latest.json"))}`);
  } else {
    console.log(`Skip latest.json (raceDate=${snapshot.raceDate} > JST today=${jstToday()})`);
  }

  if (workDir) {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
