/**
 * netkeiba 公開ページから当日の JRA 出馬表・オッズを収集し
 * src/data/snapshots/YYYY-MM-DD.json に保存する。
 *
 * 利用はデモ用途。オッズ等は主催者発表と照合すること。
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const UA =
  "Mozilla/5.0 (compatible; UMANOTE-demo/0.1; +https://github.com/nyansuka/test0725)";

const VENUE = {
  "01": "札幌",
  "02": "函館",
  "03": "福島",
  "04": "新潟",
  "05": "東京",
  "06": "中山",
  "07": "中京",
  "08": "京都",
  "09": "阪神",
  "10": "小倉",
};

/** netkeiba odds API type → 券種
 * type=1 は単勝(1)+複勝(2)を同時返却
 * 3枠連 4馬連 5ワイド 6馬単 7三連複 8三連単
 */
const API_TYPE_TO_BET = {
  3: "bracket_quinella",
  4: "quinella",
  5: "wide",
  6: "exacta",
  7: "trio",
  8: "trifecta",
};

function expectedSelectionLegs(betType) {
  if (betType === "win" || betType === "place") return 1;
  if (betType === "trio" || betType === "trifecta") return 3;
  return 2;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/json,*/*",
      "Accept-Language": "ja,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function fetchJson(url) {
  const text = await fetchText(url);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function ymdFromArg() {
  const arg = process.argv.slice(2).find((a) => /^\d{8}$/.test(a) || /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (arg && /^\d{8}$/.test(arg)) {
    return `${arg.slice(0, 4)}-${arg.slice(4, 6)}-${arg.slice(6, 8)}`;
  }
  if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) return arg;
  // JST today
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

function compactDate(ymd) {
  return ymd.replaceAll("-", "");
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parseRaceMeta(html, raceId) {
  const venueCode = raceId.slice(4, 6);
  const raceNumber = Number(raceId.slice(10, 12));
  const venue = VENUE[venueCode] ?? venueCode;

  const titleRaw =
    html.match(/class="RaceName"[^>]*>([^<\n]+)/i)?.[1] ??
    html.match(/RaceList_Item02[\s\S]*?class="RaceName"[^>]*>([^<\n]+)/i)?.[1] ??
    `${raceNumber}R`;
  let title = decodeHtml(titleRaw).replace(/\s+/g, " ").trim() || `${raceNumber}R`;

  const data01 = html.match(/class="RaceData01"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
  const dataPlain = decodeHtml(data01.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

  const timeMatch = dataPlain.match(/(\d{1,2}:\d{2})\s*発走/);
  const distMatch = dataPlain.match(/(芝|ダート|障)\s*(\d+)\s*m/);
  const weatherMatch = dataPlain.match(/天候[:：]\s*([^\s/]+)/);
  const conditionMatch = dataPlain.match(/馬場[:：]\s*([^\s/]+)/);

  let startTime = timeMatch ? timeMatch[1].padStart(5, "0") : "00:00";
  let track = "芝";
  let distance = "芝1600m";
  if (distMatch) {
    const surfaceLabel =
      distMatch[1] === "ダート" ? "ダート" : distMatch[1] === "障" ? "障害" : "芝";
    track = distMatch[1] === "ダート" ? "ダート" : "芝";
    distance = `${surfaceLabel}${distMatch[2]}m`;
  }
  const weather = weatherMatch?.[1] ?? "—";
  const condition = conditionMatch?.[1] ?? "—";

  // クラス条件をタイトルに補足（特別名がない未勝利など）
  const data02 = html.match(/class="RaceData02"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
  const classLabel = [...data02.matchAll(/<span>([^<]+)<\/span>/g)]
    .map((m) => decodeHtml(m[1]))
    .find((t) => /未勝利|新馬|1勝|2勝|3勝|オープン|障害/.test(t));
  if (/^\d+R$/.test(title) && classLabel) title = classLabel;
  if (title.length <= 2 && classLabel) title = classLabel;

  return {
    raceId,
    venue,
    raceNumber,
    title,
    startTime,
    track,
    distance,
    weather,
    condition,
  };
}

function parseHorses(html) {
  const horses = [];
  const rows = [...html.matchAll(/<tr class="HorseList"[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const rowMatch of rows) {
    const row = rowMatch[1];
    if (/取消|除外/.test(row) && /Cancel_/.test(row)) continue;

    const umaban = Number(row.match(/<td class="Umaban\d+[^"]*"[^>]*>\s*(\d+)\s*</)?.[1]);
    if (!umaban) continue;
    const waku = Number(
      row.match(/<td class="Waku\d+[^"]*"[^>]*>\s*(?:<[^>]+>)?\s*(\d+)/)?.[1] ??
        Math.ceil(umaban / 2),
    );

    const horseAnchor =
      row.match(
        /<span class="HorseName">\s*<a[^>]*(?:title="([^"]*)")?[^>]*>([^<]*)/i,
      ) ?? row.match(/db\.netkeiba\.com\/horse\/\d+"[^>]*(?:title="([^"]*)")?[^>]*>([^<]*)/i);
    const name = decodeHtml(horseAnchor?.[1] || horseAnchor?.[2] || `馬${umaban}`);

    const jockeyAnchor = row.match(
      /class="Jockey"[\s\S]*?<a[^>]*(?:title="([^"]*)")?[^>]*>\s*([^<]*)/i,
    );
    const jockey = decodeHtml(jockeyAnchor?.[1] || jockeyAnchor?.[2] || "—");

    horses.push({
      number: umaban,
      bracket: waku,
      name,
      jockey,
    });
  }
  return horses;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function selectionFromKey(type, key) {
  // win/place: "01" → "1"
  if (type === "win" || type === "place") return String(Number(key));

  // "01-02", "01_02_03"
  if (/[-_]/.test(key)) {
    return key
      .split(/[-_]/)
      .map((p) => String(Number(p)))
      .join("-");
  }

  // packed digits: "0203" → "2-3", "010203" → "1-2-3"
  const parts = key.match(/\d{2}/g);
  if (parts && parts.length >= 2) {
    return parts.map((p) => String(Number(p))).join("-");
  }
  return String(Number(key));
}

function flattenOdds(payload, typeNum) {
  if (!payload?.data?.odds) return [];
  const oddsRoot = payload.data.odds;

  // type=1 returns win + place together
  if (typeNum === 1) {
    const out = [];
    const win = oddsRoot["1"] ?? oddsRoot;
    const place = oddsRoot["2"];
    if (win && typeof win === "object") {
      for (const [k, v] of Object.entries(win)) {
        const o = Number(Array.isArray(v) ? v[0] : v);
        if (Number.isFinite(o) && o > 0) {
          out.push({ betType: "win", selection: selectionFromKey("win", k), odds: o });
        }
      }
    }
    if (place && typeof place === "object") {
      for (const [k, v] of Object.entries(place)) {
        const min = Number(Array.isArray(v) ? v[0] : v);
        const max = Number(Array.isArray(v) ? v[1] : v);
        if (Number.isFinite(min) && min > 0) {
          out.push({
            betType: "place",
            selection: selectionFromKey("place", k),
            odds: Number((((min + (Number.isFinite(max) ? max : min)) / 2) || min).toFixed(1)),
            placeMin: min,
            placeMax: Number.isFinite(max) ? max : min,
          });
        }
      }
    }
    return out;
  }

  const betType = API_TYPE_TO_BET[typeNum];
  if (!betType) return [];
  const bucket = oddsRoot[String(typeNum)] ?? oddsRoot["1"] ?? oddsRoot;
  if (!bucket || typeof bucket !== "object") return [];
  const need = expectedSelectionLegs(betType);
  const out = [];
  for (const [k, v] of Object.entries(bucket)) {
    const o = Number(Array.isArray(v) ? v[0] : v);
    if (!Number.isFinite(o) || o <= 0) continue;
    const selection = selectionFromKey(betType, k);
    if (selection.split("-").length !== need) continue;
    out.push({ betType, selection, odds: o });
  }
  return out;
}

function synthesizeFactors(horse, oddsWin, fieldSize) {
  const popularityBias = Math.min(95, 35 + oddsWin * 1.8);
  const base = 52 + ((horse.number * 7 + fieldSize) % 28);
  return {
    courseFit: Math.min(92, base + (horse.number % 5) * 3),
    paceFit: Math.min(90, base - 2 + (horse.number % 4) * 4),
    conditionFit: Math.min(90, base + 4),
    formSignal: Math.min(90, base + 2),
    valueGap: Math.min(95, Math.round(popularityBias)),
    gateJockey: 50 + ((horse.bracket ?? 4) <= 3 ? 12 : 4),
  };
}

function buildComment(oddsWin) {
  if (oddsWin >= 20) return "公開オッズ上は人気薄。複勝圏の余地をスコアで確認。";
  if (oddsWin >= 10) return "中人気帯。展開次第で複勝圏争いに加わりうる。";
  return "上位人気帯。安定感はあるが配当は薄め。";
}

function pickFeatured(races) {
  // prefer named stakes / 3勝クラス afternoon races
  const scored = races.map((r) => {
    let s = 0;
    if (/ステークス|Ｓ$|S$|賞|特別/.test(r.title)) s += 5;
    if (r.raceNumber >= 9) s += 3;
    if (r.horses.length >= 12) s += 1;
    return { r, s };
  });
  scored.sort((a, b) => b.s - a.s || b.r.raceNumber - a.r.raceNumber);
  return scored[0]?.r.id;
}

async function fetchRaceIds(kaisaiDate) {
  const url = `https://race.netkeiba.com/top/race_list_sub.html?kaisai_date=${kaisaiDate}`;
  const html = await fetchText(url);
  const ids = [...html.matchAll(/race_id=(\d{12})/g)].map((m) => m[1]);
  return [...new Set(ids)].sort();
}

function oddsApiUrl(raceId, typeNum) {
  // action=init が無いと発売中レースでも status=middle / reason=result odds empty になりがち
  return `https://race.netkeiba.com/api/api_get_jra_odds.html?type=${typeNum}&race_id=${raceId}&is_ajax=1&action=init`;
}

async function fetchOddsBundle(raceId) {
  const entries = [];
  const placeRanges = new Map();

  // type=1 returns win+place together
  const winPlace = await fetchJson(oddsApiUrl(raceId, 1));
  await sleep(120);
  for (const e of flattenOdds(winPlace, 1)) {
    if (e.betType === "place" && e.placeMin != null) {
      placeRanges.set(Number(e.selection), { min: e.placeMin, max: e.placeMax });
      entries.push({ betType: "place", selection: e.selection, odds: e.odds });
    } else {
      entries.push({ betType: e.betType, selection: e.selection, odds: e.odds });
    }
  }

  // other bet types — keep only odds >= 8 to limit payload size while covering longshots
  for (const typeNum of [3, 4, 5, 6, 7, 8]) {
    const payload = await fetchJson(oddsApiUrl(raceId, typeNum));
    await sleep(100);
    const flat = flattenOdds(payload, typeNum)
      .filter((e) => e.odds >= 8)
      .sort((a, b) => b.odds - a.odds)
      .slice(0, 40);
    entries.push(...flat);
  }

  return { entries, placeRanges, officialDatetime: winPlace?.data?.official_datetime ?? null };
}

function parseResultHtml(html) {
  if (!html.includes("All_Result_Table") && !/class="Rank">\s*\d+/.test(html)) {
    return null;
  }

  const finishes = [];
  const rows = [...html.matchAll(/<tr[^>]*HorseList[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const rowMatch of rows) {
    const row = rowMatch[1];
    const rankRaw = row.match(/class="Rank"[^>]*>\s*([^<]+)/)?.[1]?.trim();
    const rankNum = Number(rankRaw);
    const rank = Number.isFinite(rankNum) ? rankNum : null;
    const number = Number(
      row.match(/<td class="Num Txt_C"[^>]*>\s*<div>\s*(\d+)/)?.[1] ??
        row.match(/Txt_C">\s*<div>\s*(\d+)\s*<\/div>/)?.[1],
    );
    if (!number) continue;
    const bracket = Number(row.match(/Waku(\d+)/)?.[1]);
    const name = decodeHtml(
      row.match(/title="([^"]+)"/)?.[1] ??
        row.match(/HorseNameSpan[^>]*>\s*([^<]+)/)?.[1] ??
        `馬${number}`,
    );
    const jockey = decodeHtml(
      row.match(/JockeyNameSpan[^>]*>\s*([\s\S]*?)<\/span>/)?.[1]?.replace(/<[^>]+>/g, "") ??
        "",
    ).trim();
    const time = row.match(/class="RaceTime"[^>]*>\s*([^<]+)/)?.[1]?.trim();
    const popularity = Number(row.match(/OddsPeople[^>]*>\s*(\d+)/)?.[1]);
    const oddsWin = Number(row.match(/Odds_Ninki[^>]*>\s*([\d.]+)/)?.[1]);
    finishes.push({
      rank,
      number,
      bracket: Number.isFinite(bracket) ? bracket : undefined,
      name,
      jockey: jockey || undefined,
      time: time || undefined,
      popularity: Number.isFinite(popularity) ? popularity : undefined,
      oddsWin: Number.isFinite(oddsWin) ? oddsWin : undefined,
    });
  }

  if (finishes.length === 0) return null;

  const PAYOUT_ROW = {
    Tansho: "win",
    Fukusho: "place",
    Wakuren: "bracket_quinella",
    Umaren: "quinella",
    Wide: "wide",
    Umatan: "exacta",
    Sanrenpuku: "trio",
    Sanrentan: "trifecta",
  };

  const payouts = [];
  for (const [cls, betType] of Object.entries(PAYOUT_ROW)) {
    const rowHtml = html.match(new RegExp(`<tr class="${cls}"[\\s\\S]*?<\\/tr>`, "i"))?.[0];
    if (!rowHtml) continue;

    const payoutYenList = [...rowHtml.matchAll(/(\d[\d,]*)\s*円/g)].map((m) =>
      Number(m[1].replace(/,/g, "")),
    );
    const popList = [...rowHtml.matchAll(/(\d+)\s*人気/g)].map((m) => Number(m[1]));

    if (betType === "place" || betType === "wide") {
      // 複数行: Result 内の数字列と払戻を対応
      const nums = [...rowHtml.matchAll(/<span>(\d+)<\/span>/g)].map((m) => Number(m[1]));
      if (betType === "place") {
        for (let i = 0; i < Math.min(nums.length, payoutYenList.length); i++) {
          payouts.push({
            betType,
            selection: String(nums[i]),
            payoutYen: payoutYenList[i],
            popularity: popList[i],
          });
        }
      } else {
        const pairs = [...rowHtml.matchAll(/<ul>([\s\S]*?)<\/ul>/g)].map((m) =>
          [...m[1].matchAll(/<span>(\d+)<\/span>/g)].map((x) => Number(x[1])).filter(Boolean),
        );
        for (let i = 0; i < Math.min(pairs.length, payoutYenList.length); i++) {
          const pair = pairs[i];
          if (pair.length < 2) continue;
          payouts.push({
            betType,
            selection: `${pair[0]}-${pair[1]}`,
            payoutYen: payoutYenList[i],
            popularity: popList[i],
          });
        }
      }
      continue;
    }

    const spans = [...rowHtml.matchAll(/<span>(\d+)<\/span>/g)].map((m) => Number(m[1]));
    const selection =
      betType === "win"
        ? String(spans[0] ?? "")
        : spans.filter(Boolean).slice(0, expectedSelectionLegs(betType)).join("-");
    if (!selection || !payoutYenList[0]) continue;
    payouts.push({
      betType,
      selection,
      payoutYen: payoutYenList[0],
      popularity: popList[0],
    });
  }

  return {
    status: "official",
    finishedAt: new Date().toISOString(),
    finishes,
    payouts,
  };
}

async function fetchRaceResult(raceId) {
  const url = `https://race.netkeiba.com/race/result.html?race_id=${raceId}`;
  const html = await fetchText(url);
  await sleep(120);
  return parseResultHtml(html);
}

async function fetchOneRace(raceId, raceDate, { withResult = true } = {}) {
  const shutubaUrl = `https://race.netkeiba.com/race/shutuba.html?race_id=${raceId}`;
  const html = await fetchText(shutubaUrl);
  await sleep(150);
  const meta = parseRaceMeta(html, raceId);
  const rawHorses = parseHorses(html);
  const { entries, placeRanges, officialDatetime } = await fetchOddsBundle(raceId);

  const winOdds = new Map(
    entries.filter((e) => e.betType === "win").map((e) => [Number(e.selection), e.odds]),
  );

  const horses = rawHorses.map((h) => {
    const oddsWin = winOdds.get(h.number) ?? 99.9;
    const place = placeRanges.get(h.number);
    return {
      number: h.number,
      bracket: h.bracket,
      name: h.name,
      jockey: h.jockey,
      oddsWin,
      oddsPlace: place
        ? { min: place.min, max: place.max }
        : {
            min: Math.max(1.1, Number((oddsWin * 0.28).toFixed(1))),
            max: Math.max(1.3, Number((oddsWin * 0.55).toFixed(1))),
          },
      runningStyle: h.runningStyle,
      factors: synthesizeFactors(h, oddsWin, rawHorses.length),
      comment: buildComment(oddsWin),
    };
  });

  // ensure win/place for all horses on board
  const board = [...entries];
  for (const h of horses) {
    if (!board.some((e) => e.betType === "win" && e.selection === String(h.number))) {
      board.push({ betType: "win", selection: String(h.number), odds: h.oddsWin });
    }
    if (!board.some((e) => e.betType === "place" && e.selection === String(h.number))) {
      const mid = Number(((h.oddsPlace.min + h.oddsPlace.max) / 2).toFixed(1));
      board.push({ betType: "place", selection: String(h.number), odds: mid });
    }
  }

  const slugVenue = {
    札幌: "sapporo",
    函館: "hakodate",
    福島: "fukushima",
    新潟: "niigata",
    東京: "tokyo",
    中山: "nakayama",
    中京: "chukyo",
    京都: "kyoto",
    阪神: "hanshin",
    小倉: "kokura",
  }[meta.venue] ?? meta.venue;

  const race = {
    id: `${slugVenue}-${compactDate(raceDate)}-${meta.raceNumber}`,
    sourceRaceId: raceId,
    authority: "JRA",
    raceDate,
    venue: meta.venue,
    raceNumber: meta.raceNumber,
    title: meta.title,
    distance: meta.distance,
    track: meta.track,
    startTime: meta.startTime,
    weather: meta.weather,
    condition: meta.condition,
    fieldSize: horses.length,
    horses,
    oddsBoard: board,
    oddsUpdatedAt: officialDatetime,
  };

  if (withResult) {
    const result = await fetchRaceResult(raceId);
    if (result) race.result = result;
  }

  return race;
}

function jstNowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function startMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

async function writeSnapshot(snapshot) {
  const outDir = path.join(root, "src", "data", "snapshots");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${snapshot.raceDate}.json`);
  const json = JSON.stringify(snapshot, null, 2);
  await writeFile(outPath, json, "utf8");
  await writeFile(path.join(outDir, "latest.json"), json, "utf8");
  return outPath;
}

async function loadExistingSnapshot(raceDate) {
  const { readFile } = await import("node:fs/promises");
  const p = path.join(root, "src", "data", "snapshots", `${raceDate}.json`);
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    try {
      return JSON.parse(await readFile(path.join(root, "src", "data", "snapshots", "latest.json"), "utf8"));
    } catch {
      return null;
    }
  }
}

/** 終了済みレースの結果だけ差分更新 */
async function updateResultsOnly(raceDate, { graceMinutes = 8 } = {}) {
  const existing = await loadExistingSnapshot(raceDate);
  if (!existing?.races?.length) {
    console.log("No existing snapshot; running full fetch...");
    return null;
  }

  const now = jstNowParts();
  let updated = 0;
  for (const race of existing.races) {
    if (race.result?.finishes?.length) continue;
    if (!race.sourceRaceId) continue;
    if (race.raceDate !== now.date && race.raceDate !== raceDate) continue;
    const elapsed = now.date === race.raceDate ? now.minutes - startMinutes(race.startTime) : 999;
    if (elapsed < graceMinutes) continue;

    process.stdout.write(`result ${race.venue}${race.raceNumber}R ... `);
    try {
      const result = await fetchRaceResult(race.sourceRaceId);
      if (result) {
        race.result = result;
        updated += 1;
        console.log(`OK top=${result.finishes.filter((f) => f.rank === 1)[0]?.name ?? "?"}`);
      } else {
        console.log("not ready");
      }
    } catch (err) {
      console.log(`FAIL ${err.message}`);
    }
  }

  if (updated > 0) {
    existing.fetchedAt = new Date().toISOString();
    existing.source = "netkeiba (public pages / odds API + results)";
    const out = await writeSnapshot(existing);
    console.log(`Updated ${updated} results → ${out}`);
  } else {
    console.log("No new results");
  }
  return existing;
}

async function main() {
  const args = process.argv.slice(2);
  const resultsOnly = args.includes("--results-only");
  const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a) || /^\d{8}$/.test(a));
  if (dateArg) process.argv[2] = dateArg;
  const raceDate = ymdFromArg();

  if (resultsOnly) {
    const snap = await updateResultsOnly(raceDate);
    if (!snap) {
      // fall through to full fetch
    } else {
      return;
    }
  }

  const kaisai = compactDate(raceDate);
  console.log(`Fetching JRA races for ${raceDate} ...`);

  const raceIds = await fetchRaceIds(kaisai);
  if (raceIds.length === 0) {
    console.error("No race IDs found. Is it a race day?");
    process.exit(1);
  }
  console.log(`Found ${raceIds.length} races`);

  const previous = await loadExistingSnapshot(raceDate);
  const prevBySource = new Map(
    (previous?.races ?? []).filter((r) => r.sourceRaceId).map((r) => [r.sourceRaceId, r]),
  );

  const races = [];
  for (const [i, id] of raceIds.entries()) {
    process.stdout.write(`[${i + 1}/${raceIds.length}] ${id} ... `);
    try {
      const race = await fetchOneRace(id, raceDate, { withResult: true });
      const prev = prevBySource.get(id);
      if (!race.result && prev?.result) race.result = prev.result;
      races.push(race);
      const flag = race.result ? " result" : "";
      console.log(
        `${race.venue}${race.raceNumber}R ${race.title} horses=${race.horses.length} odds=${race.oddsBoard.length}${flag}`,
      );
    } catch (err) {
      console.log(`FAIL ${err.message}`);
    }
  }

  if (races.length === 0) {
    console.error("No races fetched");
    process.exit(1);
  }

  const featuredId = pickFeatured(races);
  for (const r of races) {
    r.featured = r.id === featuredId;
  }

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    source: "netkeiba (public pages / odds API + results)",
    raceDate,
    raceCount: races.length,
    venues: [...new Set(races.map((r) => r.venue))],
    races,
  };

  const outPath = await writeSnapshot(snapshot);
  console.log(`Wrote ${outPath} (${races.length} races, results=${races.filter((r) => r.result).length})`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export {
  fetchOneRace,
  fetchRaceResult,
  updateResultsOnly,
  writeSnapshot,
  loadExistingSnapshot,
  ymdFromArg,
  jstNowParts,
};