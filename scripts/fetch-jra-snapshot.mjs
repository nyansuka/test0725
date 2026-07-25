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
  const arg = process.argv[2];
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

async function fetchOddsBundle(raceId) {
  const entries = [];
  const placeRanges = new Map();

  // type=1 returns win+place together
  const winPlace = await fetchJson(
    `https://race.netkeiba.com/api/api_get_jra_odds.html?type=1&race_id=${raceId}&is_ajax=1`,
  );
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
    const payload = await fetchJson(
      `https://race.netkeiba.com/api/api_get_jra_odds.html?type=${typeNum}&race_id=${raceId}&is_ajax=1`,
    );
    await sleep(100);
    const flat = flattenOdds(payload, typeNum)
      .filter((e) => e.odds >= 8)
      .sort((a, b) => b.odds - a.odds)
      .slice(0, 40);
    entries.push(...flat);
  }

  return { entries, placeRanges, officialDatetime: winPlace?.data?.official_datetime ?? null };
}

async function fetchOneRace(raceId, raceDate) {
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

  return {
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
}

async function main() {
  const raceDate = ymdFromArg();
  const kaisai = compactDate(raceDate);
  console.log(`Fetching JRA races for ${raceDate} ...`);

  const raceIds = await fetchRaceIds(kaisai);
  if (raceIds.length === 0) {
    console.error("No race IDs found. Is it a race day?");
    process.exit(1);
  }
  console.log(`Found ${raceIds.length} races`);

  const races = [];
  for (const [i, id] of raceIds.entries()) {
    process.stdout.write(`[${i + 1}/${raceIds.length}] ${id} ... `);
    try {
      const race = await fetchOneRace(id, raceDate);
      races.push(race);
      console.log(`${race.venue}${race.raceNumber}R ${race.title} horses=${race.horses.length} odds=${race.oddsBoard.length}`);
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
    source: "netkeiba (public pages / odds API)",
    raceDate,
    raceCount: races.length,
    venues: [...new Set(races.map((r) => r.venue))],
    races,
  };

  const outDir = path.join(root, "src", "data", "snapshots");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${raceDate}.json`);
  await writeFile(outPath, JSON.stringify(snapshot, null, 2), "utf8");
  // also write as latest pointer for the app default
  await writeFile(path.join(outDir, "latest.json"), JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`Wrote ${outPath} (${races.length} races)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
