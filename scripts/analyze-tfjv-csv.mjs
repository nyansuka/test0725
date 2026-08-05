/**
 * TARGET frontier JV CSV（Shift-JIS）の検証。
 * 大容量はストリーム集計（レースキーが変わるたびに flush）。
 *
 *   node scripts/analyze-tfjv-csv.mjs [path]
 *
 * 既定: TFJV_CSV → C:\TFJV\TXT\Race Results2000.csv（.utf8.csv があれば優先）
 */
import {
  createReadStream,
  existsSync,
  writeFileSync,
  mkdirSync,
  openSync,
  readSync,
  closeSync,
} from "node:fs";
import { createInterface } from "node:readline";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Transform } from "node:stream";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function resolveDefaultCsv() {
  if (process.env.TFJV_CSV) return resolve(process.env.TFJV_CSV);
  const candidates = [
    "C:/TFJV/TXT/Race Results2000.utf8.csv",
    "/tfjv/Race Results2000.utf8.csv",
    "C:/TFJV/TXT/Race Results2000.csv",
    "/tfjv/Race Results2000.csv",
    join(root, "src/data/external/Race Results2000.csv"),
    join(root, "src/data/external/202601-202608.csv"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[2];
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
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
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

function raceKeyFromCols(headers, cols) {
  const get = (name) => {
    const i = headers.indexOf(name);
    return i >= 0 ? cols[i] ?? "" : "";
  };
  const r = get("Ｒ") || get("R");
  return `${get("日付")}|${get("開催")}|${r}`;
}

function bump(map, k, n = 1) {
  map.set(k, (map.get(k) || 0) + n);
}

function sniffUtf8(path) {
  const fd = openSync(path, "r");
  const buf = Buffer.alloc(4);
  const n = readSync(fd, buf, 0, 4, 0);
  closeSync(fd);
  if (n >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return true;
  // ASCII-ish header → UTF-8/ASCII; SJIS Japanese headers have high bytes early
  return path.toLowerCase().includes(".utf8.");
}

/** Shift_JIS バイト列を行単位 UTF-8 文字列へ（ストリーム） */
function createSjisLineTransform() {
  const decoder = new TextDecoder("shift_jis");
  let carry = "";
  return new Transform({
    readableObjectMode: true,
    transform(chunk, _enc, cb) {
      carry += decoder.decode(chunk, { stream: true });
      const parts = carry.split(/\r?\n/);
      carry = parts.pop() ?? "";
      for (const line of parts) this.push(line);
      cb();
    },
    flush(cb) {
      carry += decoder.decode();
      if (carry.length) this.push(carry);
      cb();
    },
  });
}

async function openLineSource(path) {
  if (sniffUtf8(path) || path.toLowerCase().endsWith(".utf8.csv")) {
    return createInterface({
      input: createReadStream(path, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });
  }
  const transform = createSjisLineTransform();
  createReadStream(path).pipe(transform);
  return createInterface({ input: transform, crlfDelay: Infinity });
}

function flushRace(entries, ctx) {
  const { finishCol, oddsCol, popWin, popStarts, oddBands } = ctx;
  const withFinish = entries.filter((e) => toNum(e[finishCol]) != null);
  if (withFinish.length === 0) return;
  ctx.raceCount += 1;

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

  console.log("streaming", csvPath);
  const rl = await openLineSource(csvPath);

  let headers = null;
  let finishCol = null;
  let oddsCol = null;
  let horseNumCol = null;
  let rowCount = 0;
  let currentKey = null;
  let currentEntries = [];
  let minDate = null;
  let maxDate = null;

  const ctx = {
    finishCol: null,
    oddsCol: null,
    popWin: new Map(),
    popStarts: new Map(),
    raceCount: 0,
    fav1Win: 0,
    favTop3Win: 0,
    favTop5Win: 0,
    midWin: 0,
    longWin: 0,
    oddBands: { le5: 0, gt5_10: 0, gt10_20: 0, gt20: 0, unk: 0 },
  };

  for await (const line of rl) {
    if (!line || !line.length) continue;
    if (!headers) {
      const rawHeaders = parseCsvLine(line);
      headers = rawHeaders.map((h) => String(h).slice(0, 120));
      finishCol = headers.includes("着順") ? "着順" : headers.includes("着") ? "着" : null;
      oddsCol = headers.find((h) => h === "単勝配当" || h.includes("単勝")) || null;
      horseNumCol = headers.includes("馬番") ? "馬番" : headers.includes("番") ? "番" : null;
      if (!finishCol) {
        console.error("着順列が見つかりません", headers.slice(0, 20));
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
    const key = `${date}|${kai}|${r}`;
    rowCount += 1;

    if (date) {
      if (minDate == null || date < minDate) minDate = date;
      if (maxDate == null || date > maxDate) maxDate = date;
    }

    const slim = {
      人気: get("人気"),
      [finishCol]: get(finishCol),
    };
    if (oddsCol) slim[oddsCol] = get(oddsCol);

    if (currentKey == null) currentKey = key;
    if (key !== currentKey) {
      flushRace(currentEntries, ctx);
      currentEntries = [];
      currentKey = key;
    }
    currentEntries.push(slim);
  }
  if (currentEntries.length) flushRace(currentEntries, ctx);

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

  const placeish = headers.filter((h) => /PCI|通過|3F|タイム|体重|コース|馬場|距離|上り/.test(h));
  const top3 = pct(ctx.favTop3Win);
  const mid = pct(ctx.midWin);
  const long = pct(ctx.longWin);

  const report = {
    source: csvPath,
    analyzedAt: new Date().toISOString(),
    dateRangeYymmdd: { min: minDate, max: maxDate },
    rowCount,
    raceCount,
    headerCount: headers.length,
    headers: headers.slice(0, 80),
    columns: { finishCol, oddsCol, horseNumCol, popularity: "人気" },
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
    usableColumnsForScoring: placeish.slice(0, 40),
    comparedToShortWindow202601_202608: {
      shortTop3Pct: 64,
      shortMidPct: 16,
      shortLongPct: 2.5,
      note: "短窓は旧レポート概数。正確比較は短窓CSVでも同スクリプトを再実行",
    },
    verdict: {
      canUse: true,
      summary: `軸の事前分布として使える。人気Top3 ${top3}%、6-10人気 ${mid}%、11+ ${long}%。`,
      nextSteps: [
        "短窓(202601-202608)と同指標を並べ、popularityWinScore 更新要否を判断",
        "CSV自体はリポジトリ外で参照（TFJV_CSV / C:\\\\TFJV\\\\TXT）",
      ],
      caveats: [
        "日付 YYMMDD・開催が TARGET 形式",
        "組み合わせ券オッズは含まれない",
        "確定結果ベース（人気は締切時点想定）",
        "長期間は制度・市場変化を含む",
      ],
    },
  };

  const outDir = join(root, "src/data/loop/reports");
  mkdirSync(outDir, { recursive: true });
  const stem =
    basename(csvPath, ".csv")
      .replace(/\.utf8$/i, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .toLowerCase() || "tfjv";
  const outPath = join(outDir, `tfjv-axis-prior-${stem}.json`);
  console.log("writing report", { rowCount, raceCount, minDate, maxDate, top3, mid, long });
  writeFileSync(outPath, JSON.stringify(report), "utf8");

  console.log("file", csvPath);
  console.log("dateRange", minDate, "→", maxDate);
  console.log("rows", rowCount, "races", raceCount);
  console.log("headers", headers.slice(0, 20).join(" | "));
  console.log("\n=== 1着の人気帯 ===");
  console.log(JSON.stringify(report.winnerByPopularityBand, null, 2));
  console.log("\n=== 軸=人気TopN カバー率 ===");
  console.log(JSON.stringify(axisCoverage, null, 2));
  console.log("\n=== 人気別勝率 ===");
  console.table(popTable.filter((r) => r.popularity <= 12));
  console.log("\n=== 単勝オッズ帯（1着） ===");
  console.log(JSON.stringify(report.winnerByOddsBand, null, 2));
  console.log("\nusable scoring cols:", placeish.slice(0, 20).join(", "));
  console.log("report →", outPath);
  console.log("verdict:", report.verdict.summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
