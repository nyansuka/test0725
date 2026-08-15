/**
 * netkeiba 公開ページから当日の JRA 出馬表・オッズを収集し
 * src/data/snapshots/YYYY-MM-DD.json に保存する。
 *
 * 利用はデモ用途。オッズ等は主催者発表と照合すること。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { trackGateBiasScore } from "../src/domain/scoring/trackGateBias.mjs";
import {
  enrichRaceWithForm,
  extractHorseIdFromAnchorHtml,
} from "./lib/horse-form.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const UA_SP =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

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

/** PC の race.netkeiba.com が CloudFront 400 のとき SP ホストへ切り替える */
let useSpRaceHost = false;

async function fetchText(url, { userAgent = UA, extraHeaders = {} } = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/json,*/*",
      "Accept-Language": "ja,en;q=0.8",
      ...extraHeaders,
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function fetchTextOrNull(url, opts = {}) {
  try {
    return await fetchText(url, opts);
  } catch {
    return null;
  }
}

async function fetchJson(url, opts = {}) {
  const text = await fetchText(url, opts);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function noteSpFallback(err) {
  if (!useSpRaceHost) {
    console.warn(`note: PC race host failed (${err.message}); using SP`);
  }
  useSpRaceHost = true;
}

/** PC 出馬表・一覧が落ちているときは SP を使う */
async function fetchRacePage(pcUrl, spUrl) {
  if (!useSpRaceHost) {
    try {
      return await fetchText(pcUrl);
    } catch (err) {
      noteSpFallback(err);
    }
  }
  return fetchText(spUrl, { userAgent: UA_SP });
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

/** タグを除いたテキスト（SP 出馬表の産地マーク span などを落とす） */
function textOf(htmlFragment) {
  return decodeHtml(String(htmlFragment ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function parseRaceMeta(html, raceId) {
  const venueCode = raceId.slice(4, 6);
  const raceNumber = Number(raceId.slice(10, 12));
  const venue = VENUE[venueCode] ?? venueCode;

  const titleRaw =
    html.match(/class="RaceName"[^>]*>([^<\n]+)/i)?.[1] ??
    html.match(/class="Race_Name"[^>]*>([^<\n]+)/i)?.[1] ??
    html.match(/RaceList_Item02[\s\S]*?class="RaceName"[^>]*>([^<\n]+)/i)?.[1] ??
    `${raceNumber}R`;
  let title = decodeHtml(titleRaw).replace(/\s+/g, " ").trim() || `${raceNumber}R`;

  const data01 =
    html.match(/class="RaceData01"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
    html.match(/class="Race_Data"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
    "";
  const dataPlain = decodeHtml(data01.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

  const timeMatch = dataPlain.match(/(\d{1,2}:\d{2})\s*発走/) ?? dataPlain.match(/(\d{1,2}:\d{2})/);
  // netkeiba はダートを「ダ1000m」と略記する（「ダート」表記は稀）
  const distMatch = dataPlain.match(/(芝|ダート|ダ|障)\s*(\d+)\s*m/);
  const weatherMatch =
    dataPlain.match(/天候[:：]\s*([^\s/]+)/) ?? html.match(/WeatherData">\s*([^\s<]+)/);
  const conditionMatch =
    dataPlain.match(/馬場[:：]\s*([^\s/]+)/) ??
    html.match(/class="Item0[34]">\s*(稍重|不良|良|重)/) ??
    dataPlain.match(/(稍重|不良|良|重)/);

  let startTime = timeMatch ? timeMatch[1].padStart(5, "0") : "00:00";
  let track = "芝";
  let distance = "芝1600m";
  if (distMatch) {
    const surface = distMatch[1];
    const isDirt = surface === "ダート" || surface === "ダ";
    const isSteeple = surface === "障";
    const surfaceLabel = isDirt ? "ダート" : isSteeple ? "障害" : "芝";
    track = isDirt ? "ダート" : "芝";
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
  // 馬番確定前は <td class="Umaban"> が空で、id="tr_N" / オッズキーだけが付く
  const rows = [...html.matchAll(/<tr class="HorseList"([^>]*)>([\s\S]*?)<\/tr>/gi)];
  for (const rowMatch of rows) {
    const attrs = rowMatch[1];
    const row = rowMatch[2];
    if (/取消|除外/.test(row) && /Cancel_/.test(row)) continue;

    const isSpRow = /<td class="Waku\d+"/.test(row) || /class="Horse_Info"/.test(row);
    if (isSpRow) {
      const umaban = Number(
        row.match(/id="odds-1_(\d+)"/)?.[1] ?? row.match(/<td class="Waku\d+"[^>]*>\s*(\d+)/)?.[1],
      );
      if (!umaban) continue;
      const waku = Number(row.match(/<td class="Waku(\d+)"/)?.[1]) || Math.ceil(umaban / 2);
      const nameInner = row.match(/class="Horse HorseLink"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1];
      const name = textOf(nameInner) || `馬${umaban}`;
      const jockey = decodeHtml(
        row.match(/<dd class="Jockey">[\s\S]*?<em>([^<]+)/)?.[1] ??
          row.match(/<dd class="Jockey">[\s\S]*?<a[^>]*>\s*([^<]+)/)?.[1] ??
          "—",
      )
        .replace(/\s+\d+(?:\.\d+)?\s*$/, "")
        .trim();
      const horseId = extractHorseIdFromAnchorHtml(row);
      horses.push({
        number: umaban,
        bracket: waku,
        name,
        jockey: jockey || "—",
        horseId: horseId || undefined,
      });
      continue;
    }

    const umabanFromTd = Number(
      row.match(/<td class="Umaban\d+[^"]*"[^>]*>\s*(\d+)\s*</)?.[1] ??
        row.match(/<td class="Umaban[^"]*"[^>]*>\s*(\d+)\s*</)?.[1],
    );
    const umabanFromTr = Number(attrs.match(/\bid="tr_(\d+)"/i)?.[1]);
    const umaban = umabanFromTd || umabanFromTr;
    if (!umaban) continue;
    const wakuFromTd = Number(
      row.match(/<td class="Waku\d+[^"]*"[^>]*>\s*(?:<[^>]+>)?\s*(\d+)/)?.[1] ??
        row.match(/<td class="Waku[^"]*"[^>]*>\s*(?:<span>)?\s*(\d+)/)?.[1],
    );
    const waku = wakuFromTd || Math.ceil(umaban / 2);

    const horseAnchor =
      row.match(
        /<span class="HorseName">\s*<a[^>]*(?:title="([^"]*)")?[^>]*>([^<]*)/i,
      ) ?? row.match(/db\.netkeiba\.com\/horse\/\d+"[^>]*(?:title="([^"]*)")?[^>]*>([^<]*)/i);
    const name = decodeHtml(horseAnchor?.[1] || horseAnchor?.[2] || `馬${umaban}`);
    const horseId = extractHorseIdFromAnchorHtml(row);

    const jockeyAnchor = row.match(
      /class="Jockey"[\s\S]*?<a[^>]*(?:title="([^"]*)")?[^>]*>\s*([^<]*)/i,
    );
    const jockey = decodeHtml(jockeyAnchor?.[1] || jockeyAnchor?.[2] || "—");

    horses.push({
      number: umaban,
      bracket: waku,
      name,
      jockey,
      horseId: horseId || undefined,
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

function synthesizeFactors(horse, oddsWin, fieldSize, track) {
  // valueGap / formSignal は Scorer が人気・前走から上書き（C1/C2）。
  // paceFit / conditionFit は当面プレースホルダ。courseFit は --enrich-form で上書き可。
  const base = 52 + ((horse.number * 7 + fieldSize) % 28);
  return {
    courseFit: Math.min(92, base + (horse.number % 5) * 3),
    paceFit: Math.min(90, base - 2 + (horse.number % 4) * 4),
    conditionFit: Math.min(90, base + 4),
    formSignal: 50,
    valueGap: 50,
    gateJockey: trackGateBiasScore(track, horse.bracket),
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

function parseSpRaceIds(html, raceDateYmd) {
  const kaisai = compactDate(raceDateYmd);
  const ids = [];
  for (const wrap of html.split(/<div class="RaceListDayWrap"/).slice(1)) {
    if (!wrap.includes(`data-kaisaidate="${kaisai}"`)) continue;
    for (const m of wrap.matchAll(/race\/shutuba\.html\?race_id=(\d{12})/g)) {
      ids.push(m[1]);
    }
  }
  if (ids.length) return [...new Set(ids)].sort();
  return [...new Set([...html.matchAll(/race_id=(\d{12})/g)].map((m) => m[1]))].sort();
}

async function fetchRaceIds(kaisaiDate) {
  if (!useSpRaceHost) {
    try {
      const url = `https://race.netkeiba.com/top/race_list_sub.html?kaisai_date=${kaisaiDate}`;
      const html = await fetchText(url);
      const ids = [...new Set([...html.matchAll(/race_id=(\d{12})/g)].map((m) => m[1]))].sort();
      if (ids.length) return ids;
    } catch (err) {
      noteSpFallback(err);
    }
  }
  const spUrl = `https://race.sp.netkeiba.com/?pid=race_list&kaisai_date=${kaisaiDate}`;
  const html = await fetchText(spUrl, { userAgent: UA_SP });
  return parseSpRaceIds(html, kaisaiDate);
}

function oddsApiUrl(raceId, typeNum, { sp = false } = {}) {
  // action=init が無いと発売中レースでも status=middle / reason=result odds empty になりがち
  if (sp) {
    return `https://race.sp.netkeiba.com/?pid=api_get_jra_odds&type=${typeNum}&race_id=${raceId}&is_ajax=1&action=init`;
  }
  return `https://race.netkeiba.com/api/api_get_jra_odds.html?type=${typeNum}&race_id=${raceId}&is_ajax=1&action=init`;
}

async function fetchOddsJson(raceId, typeNum) {
  if (!useSpRaceHost) {
    try {
      const json = await fetchJson(oddsApiUrl(raceId, typeNum));
      if (json) return json;
    } catch (err) {
      noteSpFallback(err);
    }
  }
  return fetchJson(oddsApiUrl(raceId, typeNum, { sp: true }), {
    userAgent: UA_SP,
    extraHeaders: { "X-Requested-With": "XMLHttpRequest" },
  });
}

async function fetchOddsBundle(raceId) {
  const entries = [];
  const placeRanges = new Map();

  // type=1 returns win+place together
  const winPlace = await fetchOddsJson(raceId, 1);
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
    const payload = await fetchOddsJson(raceId, typeNum);
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
  // PC: HorseList rows / SP: Result_Num + Rank rows
  const rows = [
    ...html.matchAll(/<tr[^>]*HorseList[^>]*>([\s\S]*?)<\/tr>/gi),
    ...html.matchAll(/<tr[^>]*>([\s\S]*?Result_Num[\s\S]*?)<\/tr>/gi),
  ];
  const seenNumbers = new Set();
  for (const rowMatch of rows) {
    const row = rowMatch[1];
    const rankRaw = row.match(/class="Rank"[^>]*>\s*([^<]+)/)?.[1]?.trim();
    const rankNum = Number(rankRaw);
    const rank = Number.isFinite(rankNum) ? rankNum : null;
    const numCells = [...row.matchAll(/<td class="Num[^"]*"[^>]*>\s*<div>\s*(\d+)/g)].map((m) =>
      Number(m[1]),
    );
    const number = Number(
      row.match(/<td class="Num Txt_C"[^>]*>\s*<div>\s*(\d+)/)?.[1] ??
        row.match(/Txt_C">\s*<div>\s*(\d+)\s*<\/div>/)?.[1] ??
        (numCells.length >= 2 ? numCells[1] : numCells[0]),
    );
    if (!number || seenNumbers.has(number)) continue;
    seenNumbers.add(number);
    const bracket = Number(
      row.match(/Waku(\d+)/)?.[1] ?? (numCells.length >= 2 ? numCells[0] : undefined),
    );
    const name = decodeHtml(
      row.match(/title="([^"]+)"/)?.[1] ??
        row.match(/HorseNameSpan[^>]*>\s*([^<]+)/)?.[1] ??
        row.match(/Horse_Name"[^>]*>\s*<a[^>]*>\s*([^<]+)/)?.[1] ??
        `馬${number}`,
    );
    const jockey = decodeHtml(
      row.match(/JockeyNameSpan[^>]*>\s*([\s\S]*?)<\/span>/)?.[1]?.replace(/<[^>]+>/g, "") ??
        row.match(/Detail_Right">\s*([^<]+)/)?.[1] ??
        "",
    )
      .replace(/\s+\d+(?:\.\d+)?\s*$/, "")
      .trim();
    const time =
      row.match(/class="RaceTime"[^>]*>\s*([^<]+)/)?.[1]?.trim() ??
      row.match(/class="Time"[^>]*>[\s\S]*?<span>\s*([^<]+)/)?.[1]?.trim();
    const popularity = Number(
      row.match(/OddsPeople[^>]*>\s*(\d+)/)?.[1] ?? row.match(/(\d+)\s*人気/)?.[1],
    );
    const oddsWin = Number(
      row.match(/Odds_Ninki[^>]*>\s*([\d.]+)/)?.[1] ??
        row.match(/Odds_Ninki[^>]*>\s*([\d.]+)\s*倍/)?.[1] ??
        row.match(/>([\d.]+)\s*倍</)?.[1],
    );
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

  // netkeiba 結果ページの tr class（旧 Sanrenpuku/Sanrentan 表記は使われない）
  const PAYOUT_ROW = {
    Tansho: "win",
    Fukusho: "place",
    Wakuren: "bracket_quinella",
    Umaren: "quinella",
    Wide: "wide",
    Umatan: "exacta",
    Fuku3: "trio",
    Tan3: "trifecta",
    // 互換（万一の別名）
    Sanrenpuku: "trio",
    Sanrentan: "trifecta",
  };

  /** SP 結果は `<span>10<br></span>` 形式があり、厳密な `(\d+)</span>` だと欠落する */
  function numbersFromLi(fragment) {
    return [...fragment.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((m) => Number(m[1].replace(/<[^>]+>/g, "").trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }
  function numbersFromSpans(fragment) {
    return [...fragment.matchAll(/<span[^>]*>\s*(\d+)/gi)]
      .map((m) => Number(m[1]))
      .filter((n) => Number.isFinite(n) && n > 0);
  }
  function resultNumbers(rowHtml) {
    const resultTd = rowHtml.match(/<td class="Result"[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? rowHtml;
    const fromLi = numbersFromLi(resultTd);
    return fromLi.length > 0 ? fromLi : numbersFromSpans(resultTd);
  }

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
      if (betType === "place") {
        const nums = resultNumbers(rowHtml);
        for (let i = 0; i < Math.min(nums.length, payoutYenList.length); i++) {
          payouts.push({
            betType,
            selection: String(nums[i]),
            payoutYen: payoutYenList[i],
            popularity: popList[i],
          });
        }
      } else {
        const pairs = [...rowHtml.matchAll(/<ul>([\s\S]*?)<\/ul>/g)].map((m) => {
          const fromLi = numbersFromLi(m[1]);
          return fromLi.length > 0 ? fromLi : numbersFromSpans(m[1]);
        });
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

    const nums = resultNumbers(rowHtml);
    const selection =
      betType === "win"
        ? String(nums[0] ?? "")
        : nums.slice(0, expectedSelectionLegs(betType)).join("-");
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

function scoreResultPayouts(result) {
  if (!result?.payouts?.length) return 0;
  let score = result.payouts.length;
  for (const p of result.payouts) {
    const legs = String(p.selection ?? "")
      .split("-")
      .filter(Boolean).length;
    const need = expectedSelectionLegs(p.betType);
    if (need > 1 && legs >= need) score += 10;
    if (need > 1 && legs < need) score -= 5;
  }
  return score;
}

async function fetchRaceResult(raceId) {
  const candidates = [
    ...(!useSpRaceHost
      ? [
          {
            url: `https://race.netkeiba.com/race/result.html?race_id=${raceId}`,
            userAgent: UA,
          },
        ]
      : []),
    {
      url: `https://race.sp.netkeiba.com/?pid=race_result&race_id=${raceId}`,
      userAgent: UA_SP,
    },
  ];
  let best = null;
  let bestScore = -1;
  for (const { url, userAgent } of candidates) {
    const html = await fetchTextOrNull(url, { userAgent });
    await sleep(120);
    if (!html) continue;
    const result = parseResultHtml(html);
    if (!result) continue;
    const score = scoreResultPayouts(result);
    if (score > bestScore) {
      best = result;
      bestScore = score;
    }
  }
  return best;
}

/**
 * 過去開催の結果ページだけから表示用データを作る。
 * 発売オッズ API を券種ごとに巡回しないため、結果バックフィルを軽量に行える。
 */
async function fetchHistoricalResultRace(raceId, raceDate) {
  const result = await fetchRaceResult(raceId);
  if (!result) throw new Error("official result not found");

  // SP/PC 結果 HTML からメタを再取得（PC 失敗時は SP）
  const html =
    (!useSpRaceHost
      ? await fetchTextOrNull(`https://race.netkeiba.com/race/result.html?race_id=${raceId}`)
      : null) ??
    (await fetchTextOrNull(`https://race.sp.netkeiba.com/?pid=race_result&race_id=${raceId}`, {
      userAgent: UA_SP,
    }));
  if (!html) throw new Error("result html unavailable");
  const meta = parseRaceMeta(html, raceId);
  const fieldSize = result.finishes.length;
  const horses = result.finishes.map((finish) => {
    const oddsWin = finish.oddsWin ?? 99.9;
    return {
      number: finish.number,
      bracket: finish.bracket,
      name: finish.name,
      jockey: finish.jockey ?? "—",
      oddsWin,
      oddsPlace: {
        min: Math.max(1.1, Number((oddsWin * 0.28).toFixed(1))),
        max: Math.max(1.3, Number((oddsWin * 0.55).toFixed(1))),
      },
      factors: synthesizeFactors(finish, oddsWin, fieldSize, meta.track),
      comment: buildComment(oddsWin),
    };
  });
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
    fieldSize,
    horses,
    oddsBoard: horses.map((horse) => ({
      betType: "win",
      selection: String(horse.number),
      odds: horse.oddsWin,
    })),
    result,
  };
}

async function fetchOneRace(raceId, raceDate, { withResult = true, withForm = false } = {}) {
  const html = await fetchRacePage(
    `https://race.netkeiba.com/race/shutuba.html?race_id=${raceId}`,
    `https://race.sp.netkeiba.com/?pid=shutuba&race_id=${raceId}`,
  );
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
      horseId: h.horseId,
      oddsWin,
      oddsPlace: place
        ? { min: place.min, max: place.max }
        : {
            min: Math.max(1.1, Number((oddsWin * 0.28).toFixed(1))),
            max: Math.max(1.3, Number((oddsWin * 0.55).toFixed(1))),
          },
      runningStyle: h.runningStyle,
      factors: synthesizeFactors(h, oddsWin, rawHorses.length, meta.track),
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

  if (withForm) {
    await enrichRaceWithForm(race, { sleepMs: 150 });
  }

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

/**
 * latest.json は「サイトが指す当日スナップ」。
 * - JST 暦日のスナップは、未来日の先取り latest より優先する
 * - 暦日 latest があるときは、別日（過去・未来）の書き込みで上書きしない
 * - それ以外は raceDate が同日またはより新しいときだけ更新する
 */
async function shouldUpdateLatest(snapshot, latestPath) {
  const today = jstNowParts().date;
  try {
    const existing = JSON.parse(await readFile(latestPath, "utf8"));
    if (!existing?.raceDate) return true;
    const snap = String(snapshot.raceDate);
    const cur = String(existing.raceDate);
    if (snap === today && cur !== today) return true;
    if (cur === today && snap !== today) return false;
    return snap >= cur;
  } catch {
    return true;
  }
}

async function writeSnapshot(snapshot) {
  const outDir = path.join(root, "src", "data", "snapshots");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${snapshot.raceDate}.json`);
  const latestPath = path.join(outDir, "latest.json");
  const json = JSON.stringify(snapshot, null, 2);
  await writeFile(outPath, json, "utf8");

  if (!(await shouldUpdateLatest(snapshot, latestPath))) {
    console.warn(
      `note: kept latest.json (not overwriting with older raceDate=${snapshot.raceDate})`,
    );
    return outPath;
  }

  // OneDrive 等で latest.json がロックされることがあるためリトライ
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await writeFile(latestPath, json, "utf8");
      break;
    } catch (err) {
      if (attempt === 3) {
        console.warn(`warn: could not update latest.json (${err.message})`);
      } else {
        await sleep(200 * (attempt + 1));
      }
    }
  }
  return outPath;
}

async function loadExistingSnapshot(raceDate) {
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

/** 既存レースにオッズ束を上書き（出馬表・form・結果は維持）。 */
function applyOddsBundleToRace(race, { entries, placeRanges, officialDatetime }) {
  const winOdds = new Map(
    entries.filter((e) => e.betType === "win").map((e) => [Number(e.selection), e.odds]),
  );
  const fieldSize = race.horses?.length ?? 0;
  for (const h of race.horses ?? []) {
    const oddsWin = winOdds.get(h.number) ?? h.oddsWin ?? 99.9;
    const place = placeRanges.get(h.number);
    h.oddsWin = oddsWin;
    h.oddsPlace = place
      ? { min: place.min, max: place.max }
      : {
          min: Math.max(1.1, Number((oddsWin * 0.28).toFixed(1))),
          max: Math.max(1.3, Number((oddsWin * 0.55).toFixed(1))),
        };
    h.factors = synthesizeFactors(h, oddsWin, fieldSize, race.track);
    h.comment = buildComment(oddsWin);
  }

  const board = [...entries];
  for (const h of race.horses ?? []) {
    if (!board.some((e) => e.betType === "win" && e.selection === String(h.number))) {
      board.push({ betType: "win", selection: String(h.number), odds: h.oddsWin });
    }
    if (!board.some((e) => e.betType === "place" && e.selection === String(h.number))) {
      const mid = Number(((h.oddsPlace.min + h.oddsPlace.max) / 2).toFixed(1));
      board.push({ betType: "place", selection: String(h.number), odds: mid });
    }
  }
  race.oddsBoard = board;
  race.oddsUpdatedAt = officialDatetime;
}

/**
 * 未発走レースのオッズだけ差分更新（結果付きはスキップ）。
 */
async function updateOddsOnly(raceDate) {
  const existing = await loadExistingSnapshot(raceDate);
  if (!existing?.races?.length) {
    console.log("No existing snapshot for odds refresh");
    return null;
  }

  const now = jstNowParts();
  let updated = 0;
  for (const race of existing.races) {
    if (race.result?.finishes?.length) continue;
    if (!race.sourceRaceId) continue;
    if (race.raceDate !== raceDate) continue;
    if (now.date === race.raceDate && now.minutes >= startMinutes(race.startTime)) continue;

    process.stdout.write(`odds ${race.venue}${race.raceNumber}R ... `);
    try {
      const bundle = await fetchOddsBundle(race.sourceRaceId);
      const winCount = bundle.entries.filter((e) => e.betType === "win").length;
      if (winCount === 0) {
        console.log("empty");
        continue;
      }
      applyOddsBundleToRace(race, bundle);
      updated += 1;
      console.log(`OK win=${winCount} board=${race.oddsBoard.length} at=${race.oddsUpdatedAt ?? "?"}`);
    } catch (err) {
      console.log(`FAIL ${err.message}`);
    }
  }

  if (updated > 0) {
    existing.fetchedAt = new Date().toISOString();
    existing.source = "netkeiba (public pages / odds API + results)";
    const out = await writeSnapshot(existing);
    console.log(`Updated odds on ${updated} races → ${out}`);
  } else {
    console.log("No odds updates");
  }
  return existing;
}

/**
 * 終了済みレースの結果だけ差分更新。
 * force=true のとき既存 result も再取得（払戻パース修正のバックフィル用）。
 */
async function updateResultsOnly(raceDate, { graceMinutes = 8, force = false } = {}) {
  const existing = await loadExistingSnapshot(raceDate);
  if (!existing?.races?.length) {
    console.log("No existing snapshot; running full fetch...");
    return null;
  }

  const now = jstNowParts();
  let updated = 0;
  for (const race of existing.races) {
    if (!force && race.result?.finishes?.length) continue;
    if (!race.sourceRaceId) continue;
    if (race.raceDate !== now.date && race.raceDate !== raceDate) continue;
    const elapsed = now.date === race.raceDate ? now.minutes - startMinutes(race.startTime) : 999;
    if (!force && elapsed < graceMinutes) continue;

    process.stdout.write(`result ${race.venue}${race.raceNumber}R ... `);
    try {
      const result = await fetchRaceResult(race.sourceRaceId);
      if (result) {
        race.result = result;
        updated += 1;
        const trio = result.payouts.filter((p) => p.betType === "trio" || p.betType === "trifecta").length;
        console.log(
          `OK top=${result.finishes.filter((f) => f.rank === 1)[0]?.name ?? "?"} payouts=${result.payouts.length}(3連系=${trio})`,
        );
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

/**
 * 既存スナップに horseId が無い場合は出馬表を再取得して付与し、
 * 過去走で courseFit / formSignal を上書きする。
 */
async function enrichSnapshotWithForm(raceDate, { force = false, limit = 0 } = {}) {
  const existing = await loadExistingSnapshot(raceDate);
  if (!existing?.races?.length) {
    console.error(`No snapshot for ${raceDate}`);
    process.exit(1);
  }

  let races = existing.races;
  if (limit > 0) races = races.slice(0, limit);

  let formOk = 0;
  for (const [i, race] of races.entries()) {
    process.stdout.write(`[${i + 1}/${races.length}] ${race.venue}${race.raceNumber}R ... `);
    try {
      const missingIds = (race.horses ?? []).some((h) => !h.horseId);
      if (missingIds && race.sourceRaceId) {
        const html = await fetchRacePage(
          `https://race.netkeiba.com/race/shutuba.html?race_id=${race.sourceRaceId}`,
          `https://race.sp.netkeiba.com/?pid=shutuba&race_id=${race.sourceRaceId}`,
        );
        await sleep(120);
        const parsed = parseHorses(html);
        const byNum = new Map(parsed.map((h) => [h.number, h]));
        for (const h of race.horses) {
          const p = byNum.get(h.number);
          if (p?.horseId) h.horseId = p.horseId;
        }
      }

      const { fetched, total } = await enrichRaceWithForm(race, {
        force,
        sleepMs: 150,
      });
      const withVenue = (race.horses ?? []).filter((h) => (h.formStats?.sameCourseStarts ?? 0) > 0).length;
      const withDist = (race.horses ?? []).filter((h) => (h.formStats?.sameDistanceStarts ?? 0) > 0).length;
      formOk += 1;
      console.log(`form ${fetched}/${total} sameVenue=${withVenue} sameDist=${withDist}`);
    } catch (err) {
      console.log(`FAIL ${err.message}`);
    }
  }

  existing.fetchedAt = new Date().toISOString();
  existing.source = "netkeiba (public pages / odds API + results + horse form)";
  existing.formEnrichedAt = new Date().toISOString();
  const out = await writeSnapshot(existing);
  console.log(`Form-enriched ${formOk}/${races.length} races → ${out}`);
  return existing;
}

async function main() {
  const args = process.argv.slice(2);
  const resultsOnly = args.includes("--results-only");
  const oddsOnly = args.includes("--odds-only");
  const refreshResults = args.includes("--refresh-results");
  const resultHistory = args.includes("--result-history");
  const withForm = args.includes("--with-form");
  const enrichForm = args.includes("--enrich-form");
  const forceForm = args.includes("--force-form");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) || 0 : 0;
  const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a) || /^\d{8}$/.test(a));
  if (dateArg) process.argv[2] = dateArg;
  const raceDate = ymdFromArg();

  if (enrichForm) {
    await enrichSnapshotWithForm(raceDate, { force: forceForm, limit });
    return;
  }

  if (oddsOnly) {
    const snap = await updateOddsOnly(raceDate);
    if (!snap) {
      // fall through to full fetch
    } else {
      return;
    }
  }

  if (resultsOnly || refreshResults) {
    const snap = await updateResultsOnly(raceDate, { force: refreshResults });
    if (!snap) {
      // fall through to full fetch
    } else {
      return;
    }
  }

  const kaisai = compactDate(raceDate);
  console.log(`Fetching JRA races for ${raceDate}${withForm ? " (with form)" : ""} ...`);

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
      const race = resultHistory
        ? await fetchHistoricalResultRace(id, raceDate)
        : await fetchOneRace(id, raceDate, { withResult: true, withForm });
      const prev = prevBySource.get(id);
      if (!race.result && prev?.result) race.result = prev.result;
      races.push(race);
      const flag = race.result ? " result" : "";
      const formFlag = withForm
        ? ` formSame=${(race.horses ?? []).filter((h) => (h.formStats?.sameCourseStarts ?? 0) > 0).length}`
        : "";
      console.log(
        `${race.venue}${race.raceNumber}R ${race.title} horses=${race.horses.length} odds=${race.oddsBoard.length}${flag}${formFlag}`,
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
    source: resultHistory
      ? "netkeiba (public result pages)"
      : withForm
      ? "netkeiba (public pages / odds API + results + horse form)"
      : "netkeiba (public pages / odds API + results)",
    raceDate,
    raceCount: races.length,
    venues: [...new Set(races.map((r) => r.venue))],
    races,
  };
  if (withForm) snapshot.formEnrichedAt = snapshot.fetchedAt;

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
  parseResultHtml,
  parseHorses,
  updateOddsOnly,
  updateResultsOnly,
  enrichSnapshotWithForm,
  writeSnapshot,
  loadExistingSnapshot,
  ymdFromArg,
  jstNowParts,
};