/**
 * TFJV CSV を重賞のみで人気帯検証。
 *   node scripts/analyze-tfjv-stakes.mjs [path]
 *
 * 判定: レース名に G1/G2/G3 / GI–GIII / (重賞) 等
 */
import {
  createReadStream,
  existsSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { createInterface } from "node:readline";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function resolveDefaultCsv() {
  if (process.env.TFJV_CSV) return resolve(process.env.TFJV_CSV);
  const candidates = [
    "C:/TFJV/TXT/Race Results2000.utf8.csv",
    "/tfjv/Race Results2000.utf8.csv",
    "C:/TFJV/TXT/Race Results2000.csv",
    "/tfjv/Race Results2000.csv",
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  return candidates[0];
}

const csvPath = resolve(process.argv[2] || resolveDefaultCsv());

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function toNum(s) {
  if (s == null || s === "" || s === "*") return null;
  const normalized = String(s)
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[^\d.-]/g, "");
  if (normalized === "" || normalized === "-" || normalized === ".") return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function bump(map, k, n = 1) {
  map.set(k, (map.get(k) || 0) + n);
}

/** JRA 重賞（平地・障の G1–G3） */
function stakesGrade(name) {
  const s = String(name ?? "");
  // G3 → G2 → G1 の順（III を II/I より先に）
  if (/G\s*(?:III|Ⅲ|3|３)|ＪＧ\s*３|JG\s*3/i.test(s)) return "G3";
  if (/G\s*(?:II|Ⅱ|2|２)|ＪＧ\s*２|JG\s*2/i.test(s)) return "G2";
  if (/G\s*(?:I|Ⅰ|1|１)|ＪＧ\s*１|JG\s*1/i.test(s)) return "G1";
  if (/重賞/.test(s)) return "重賞";
  return null;
}

function isStakesName(name) {
  return stakesGrade(name) != null;
}

function flushRace(entries, ctx) {
  const { finishCol, oddsCol, popWin, popStarts, oddBands, byGrade } = ctx;
  const withFinish = entries.filter((e) => toNum(e[finishCol]) != null);
  if (withFinish.length === 0) return;
  const grade = entries[0]?.grade ?? "重賞";
  ctx.raceCount += 1;
  bump(ctx.gradeRaces, grade);

  for (const e of withFinish) {
    const pop = toNum(e["人気"]);
    if (pop != null) bump(popStarts, pop);
  }

  const winner = withFinish.find((e) => toNum(e[finishCol]) === 1);
  if (!winner) return;
  const wPop = toNum(winner["人気"]);
  let wOdds = null;
  if (oddsCol) {
    const payout = toNum(winner[oddsCol]);
    wOdds = payout != null ? payout / 100 : null;
  }
  if (wPop != null) bump(popWin, wPop);
  if (wPop === 1) ctx.fav1Win += 1;
  if (wPop != null && wPop <= 3) ctx.favTop3Win += 1;
  if (wPop != null && wPop <= 5) ctx.favTop5Win += 1;
  if (wPop != null && wPop >= 6 && wPop <= 10) ctx.midWin += 1;
  if (wPop != null && wPop >= 11) ctx.longWin += 1;

  if (!byGrade.has(grade)) {
    byGrade.set(grade, { races: 0, top3: 0, mid: 0, long: 0, p1: 0 });
  }
  const g = byGrade.get(grade);
  g.races += 1;
  if (wPop === 1) g.p1 += 1;
  if (wPop != null && wPop <= 3) g.top3 += 1;
  if (wPop != null && wPop >= 6 && wPop <= 10) g.mid += 1;
  if (wPop != null && wPop >= 11) g.long += 1;

  if (wOdds == null) oddBands.unk += 1;
  else if (wOdds <= 5) oddBands.le5 += 1;
  else if (wOdds <= 10) oddBands.gt5_10 += 1;
  else if (wOdds <= 20) oddBands.gt10_20 += 1;
  else oddBands.gt20 += 1;
}

async function main() {
  if (!existsSync(csvPath)) {
    console.error("CSV not found:", csvPath);
    process.exit(1);
  }

  const rl = createInterface({
    input: createReadStream(csvPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let headers = null;
  let finishCol = null;
  let oddsCol = null;
  let nameIdx = -1;
  let rowCount = 0;
  let stakesRows = 0;
  let currentKey = null;
  let currentEntries = [];
  let currentIsStakes = false;
  let minDate = null;
  let maxDate = null;
  const sampleNames = new Map();

  const ctx = {
    finishCol: null,
    oddsCol: null,
    popWin: new Map(),
    popStarts: new Map(),
    gradeRaces: new Map(),
    byGrade: new Map(),
    raceCount: 0,
    fav1Win: 0,
    favTop3Win: 0,
    favTop5Win: 0,
    midWin: 0,
    longWin: 0,
    oddBands: { le5: 0, gt5_10: 0, gt10_20: 0, gt20: 0, unk: 0 },
  };

  for await (const line of rl) {
    if (!line) continue;
    if (!headers) {
      headers = parseCsvLine(line).map((h) => String(h).slice(0, 120));
      finishCol = headers.includes("着順") ? "着順" : headers.includes("着") ? "着" : null;
      oddsCol = headers.find((h) => h === "単勝配当" || h.includes("単勝")) || null;
      nameIdx = headers.indexOf("レース名");
      if (!finishCol || nameIdx < 0) {
        console.error("required columns missing", { finishCol, nameIdx, headers: headers.slice(0, 15) });
        process.exit(1);
      }
      ctx.finishCol = finishCol;
      ctx.oddsCol = oddsCol;
      continue;
    }

    const cols = parseCsvLine(line);
    if (cols.length < 8) continue;
    const get = (name) => {
      const i = headers.indexOf(name);
      return i >= 0 ? cols[i] ?? "" : "";
    };
    const date = get("日付");
    const kai = get("開催");
    const r = get("Ｒ") || get("R");
    const raceName = cols[nameIdx] ?? "";
    const key = `${date}|${kai}|${r}`;
    const grade = stakesGrade(raceName);
    const stakes = grade != null;
    rowCount += 1;

    if (key !== currentKey) {
      if (currentIsStakes && currentEntries.length) flushRace(currentEntries, ctx);
      currentEntries = [];
      currentKey = key;
      currentIsStakes = stakes;
    }
    if (!currentIsStakes) continue;

    stakesRows += 1;
    if (date) {
      if (minDate == null || date < minDate) minDate = date;
      if (maxDate == null || date > maxDate) maxDate = date;
    }
    if (sampleNames.size < 40) bump(sampleNames, `${grade}|${raceName}`);

    const slim = {
      人気: get("人気"),
      [finishCol]: get(finishCol),
      grade,
      raceName,
    };
    if (oddsCol) slim[oddsCol] = get(oddsCol);
    currentEntries.push(slim);
  }
  if (currentIsStakes && currentEntries.length) flushRace(currentEntries, ctx);

  const { raceCount, popWin, popStarts, oddBands } = ctx;
  const pct = (x, d = raceCount) => (d ? Number(((100 * x) / d).toFixed(1)) : null);

  const popTable = [];
  for (let p = 1; p <= 18; p++) {
    const starts = popStarts.get(p) || 0;
    const wins = popWin.get(p) || 0;
    popTable.push({
      popularity: p,
      starts,
      wins,
      winRatePct: starts ? Number(((100 * wins) / starts).toFixed(1)) : null,
      shareOfWinsPct: raceCount ? Number(((100 * wins) / raceCount).toFixed(1)) : null,
    });
  }

  const axisCoverage = [1, 2, 3, 4, 5].map((n) => {
    let hits = 0;
    for (let p = 1; p <= n; p++) hits += popWin.get(p) || 0;
    return { topN: n, hits, hitRatePct: pct(hits) };
  });

  const gradeBreakdown = [...ctx.byGrade.entries()].map(([grade, g]) => ({
    grade,
    races: g.races,
    p1Pct: g.races ? Number(((100 * g.p1) / g.races).toFixed(1)) : null,
    top3Pct: g.races ? Number(((100 * g.top3) / g.races).toFixed(1)) : null,
    p6to10Pct: g.races ? Number(((100 * g.mid) / g.races).toFixed(1)) : null,
    p11plusPct: g.races ? Number(((100 * g.long) / g.races).toFixed(1)) : null,
  }));

  const allRef = {
    top3: 65.0,
    p6to10: 15.6,
    p11plus: 2.8,
    note: "Race Results2000 全レース（前回集計）",
  };

  const top3 = pct(ctx.favTop3Win);
  const mid = pct(ctx.midWin);
  const long = pct(ctx.longWin);

  const report = {
    source: csvPath,
    filter: "stakes_only",
    stakesRule: "レース名に G1/G2/G3（ローマ数字・数字）または「重賞」",
    analyzedAt: new Date().toISOString(),
    dateRangeYymmdd: { min: minDate, max: maxDate },
    rowCountAll: rowCount,
    stakesHorseRows: stakesRows,
    raceCount,
    winnerByPopularityBand: {
      p1: { count: ctx.fav1Win, ratePct: pct(ctx.fav1Win) },
      top3: { count: ctx.favTop3Win, ratePct: top3 },
      top5: { count: ctx.favTop5Win, ratePct: pct(ctx.favTop5Win) },
      p6to10: { count: ctx.midWin, ratePct: mid },
      p11plus: { count: ctx.longWin, ratePct: long },
    },
    winnerByOddsBand: {
      oddsLe5: { count: oddBands.le5, ratePct: pct(oddBands.le5) },
      odds5to10: { count: oddBands.gt5_10, ratePct: pct(oddBands.gt5_10) },
      odds10to20: { count: oddBands.gt10_20, ratePct: pct(oddBands.gt10_20) },
      oddsGt20: { count: oddBands.gt20, ratePct: pct(oddBands.gt20) },
    },
    axisCoverageIfFavorites: axisCoverage,
    popularityWinTable: popTable,
    gradeBreakdown,
    vsAllRacesPp: {
      top3: top3 != null ? Number((top3 - allRef.top3).toFixed(1)) : null,
      p6to10: mid != null ? Number((mid - allRef.p6to10).toFixed(1)) : null,
      p11plus: long != null ? Number((long - allRef.p11plus).toFixed(1)) : null,
      allRef,
    },
    sampleRaceNames: [...sampleNames.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([k, n]) => ({ name: k, rows: n })),
    verdict: {
      summary: `重賞のみ ${raceCount}R: Top3 ${top3}% / 6-10 ${mid}% / 11+ ${long}%（全レース比 Top3 ${top3 != null ? (top3 - allRef.top3).toFixed(1) : "?"}pt）`,
    },
  };

  const outDir = join(root, "src/data/loop/reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "tfjv-axis-prior-stakes-only.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify({
    races: raceCount,
    dates: report.dateRangeYymmdd,
    bands: report.winnerByPopularityBand,
    grades: gradeBreakdown,
    vsAll: report.vsAllRacesPp,
    samples: report.sampleRaceNames.slice(0, 12),
    verdict: report.verdict.summary,
    outPath,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
