/**
 * Phase 0: NAR (nar.netkeiba.com) 公開ページ／オッズ API の契約調査。
 * デモ用途。主催者発表と照合すること。負荷を抑えるため sleep 付き。
 *
 * Usage:
 *   node scripts/probe-nar-source.mjs [YYYY-MM-DD] [venueCode]
 * Example:
 *   node scripts/probe-nar-source.mjs 2026-08-07 42
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "tmp", "nar-probe");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const VENUE = {
  "30": "門別",
  "35": "盛岡",
  "36": "水沢",
  "42": "浦和",
  "43": "船橋",
  "44": "大井",
  "45": "川崎",
  "46": "金沢",
  "47": "笠松",
  "48": "名古屋",
  "50": "園田",
  "51": "姫路",
  "54": "高知",
  "55": "佐賀",
};

const API_TYPE_TO_BET = {
  1: "win_place_bundle",
  3: "bracket_quinella",
  4: "quinella",
  5: "wide",
  6: "exacta",
  7: "trio",
  8: "trifecta",
};

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

function ymdFromArg() {
  const arg = process.argv[2];
  if (arg && /^\d{8}$/.test(arg)) {
    return `${arg.slice(0, 4)}-${arg.slice(4, 6)}-${arg.slice(6, 8)}`;
  }
  if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) return arg;
  return "2026-08-07";
}

function compactDate(ymd) {
  return ymd.replaceAll("-", "");
}

function venueCodeFromRaceId(raceId) {
  return raceId.slice(4, 6);
}

function raceNumberFromRaceId(raceId) {
  return Number(raceId.slice(10, 12));
}

function parseRaceIds(html) {
  const ids = new Set();
  for (const m of html.matchAll(/race_id=(\d{12})/g)) ids.add(m[1]);
  return [...ids].sort();
}

function parseShutubaMeta(html) {
  const name =
    html.match(/<div class="RaceName"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ??
    "";
  const data01 = html.match(/<div class="RaceData01"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
  const data02 = html.match(/<div class="RaceData02"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
  const plain01 = decodeHtml(data01.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  const plain02 = decodeHtml(data02.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  const title = decodeHtml(name.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  const start = plain01.match(/(\d{1,2}:\d{2})/)?.[1] ?? "";
  const dist = plain01.match(/(芝|ダ|障)\s*(\d{3,4})m/) ?? plain01.match(/(芝|ダート|ダ|障)(\d{3,4})/);
  const weather = plain01.match(/天候\s*[:：]?\s*(\S+)/)?.[1] ?? "";
  const condition = plain01.match(/馬場\s*[:：]?\s*(\S+)/)?.[1] ?? "";
  return {
    title,
    startTime: start,
    trackRaw: dist?.[1] ?? "",
    distance: dist ? `${dist[1]}${dist[2]}m` : "",
    weather,
    condition,
    raceData01: plain01,
    raceData02: plain02,
  };
}

function parseHorses(html) {
  const horses = [];
  const rows = [...html.matchAll(/<tr[^>]*class="[^"]*HorseList[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const rowMatch of rows) {
    const row = rowMatch[1];
    const umaban = Number(
      row.match(/<td[^>]*class="[^"]*Umaban[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1]?.replace(/<[^>]+>/g, "")?.trim(),
    );
    const waku = Number(
      row.match(/<td[^>]*class="[^"]*Waku[^"]*"[^>]*>[\s\S]*?<span[^>]*>(\d+)<\/span>/i)?.[1] ??
        row.match(/Waku[\s\S]*?>(\d+)</i)?.[1],
    );
    const name =
      decodeHtml(
        row.match(/HorseInfo[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]?.replace(/<[^>]+>/g, "") ??
          row.match(/Horse_Name[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]?.replace(/<[^>]+>/g, "") ??
          "",
      ) || undefined;
    const jockey = decodeHtml(
      row.match(/Jockey[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]?.replace(/<[^>]+>/g, "") ?? "",
    );
    const horseId =
      row.match(/db\.netkeiba\.com\/horse\/(\d+)/i)?.[1] ??
      row.match(/\/horse\/(\d{10,})/i)?.[1] ??
      null;
    if (!Number.isFinite(umaban) || !name) continue;
    horses.push({
      number: umaban,
      bracket: Number.isFinite(waku) ? waku : undefined,
      name,
      jockey,
      horseId,
    });
  }
  return horses;
}

function parseResultPayoutHints(html) {
  const hints = {};
  for (const key of ["Tansho", "Fukusho", "Wakuren", "Umaren", "Wide", "Umatan", "Fuku3", "Tampu3"]) {
    if (new RegExp(key, "i").test(html)) hints[key] = true;
  }
  // also Japanese labels
  for (const [label, code] of [
    ["単勝", "tansho_jp"],
    ["複勝", "fukusho_jp"],
    ["枠連", "wakuren_jp"],
    ["馬連", "umaren_jp"],
    ["ワイド", "wide_jp"],
    ["馬単", "umatan_jp"],
    ["三連複", "sanrenpuku_jp"],
    ["3連複", "sanrenpuku2_jp"],
    ["三連単", "sanrentan_jp"],
    ["3連単", "sanrentan2_jp"],
  ]) {
    if (html.includes(label)) hints[code] = true;
  }
  return hints;
}

function summarizeAryOdds(ary) {
  if (!ary || typeof ary !== "object") return { keyCount: 0, sample: null };
  const keys = Object.keys(ary);
  const first = keys[0];
  return {
    keyCount: keys.length,
    sampleKey: first ?? null,
    sampleValue: first ? ary[first] : null,
    keyShape: first,
  };
}

async function probeOddsApi(raceId) {
  const results = [];
  for (const typeNum of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const url = `https://nar.netkeiba.com/api/api_get_nar_odds.html?type=${typeNum}&race_id=${raceId}&is_ajax=1&action=init`;
    let text;
    try {
      text = await fetchText(url);
    } catch (e) {
      results.push({ type: typeNum, bet: API_TYPE_TO_BET[typeNum] ?? `type${typeNum}`, error: String(e) });
      await sleep(350);
      continue;
    }
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      results.push({
        type: typeNum,
        bet: API_TYPE_TO_BET[typeNum] ?? `type${typeNum}`,
        parseError: true,
        snip: text.slice(0, 120),
      });
      await sleep(350);
      continue;
    }
    await writeFile(path.join(outDir, `api_${raceId}_type${typeNum}.json`), text);
    const summary = summarizeAryOdds(json.ary_odds);
    results.push({
      type: typeNum,
      bet: API_TYPE_TO_BET[typeNum] ?? `type${typeNum}`,
      status: json.status,
      odds_status: json.odds_status,
      topKeys: Object.keys(json).slice(0, 12),
      ...summary,
    });
    await sleep(350);
  }
  return results;
}

function slugVenue(name) {
  const map = {
    門別: "monbetsu",
    盛岡: "morioka",
    水沢: "mizusawa",
    浦和: "urawa",
    船橋: "funabashi",
    大井: "oi",
    川崎: "kawasaki",
    金沢: "kanazawa",
    笠松: "kasamatsu",
    名古屋: "nagoya",
    園田: "sonoda",
    姫路: "himeji",
    高知: "kochi",
    佐賀: "saga",
  };
  return map[name] ?? name;
}

function toTrack(raw) {
  if (!raw) return "ダート";
  if (raw.startsWith("芝")) return "芝";
  if (raw.startsWith("障")) return "芝";
  return "ダート";
}

async function main() {
  const raceDate = ymdFromArg();
  const preferVenue = process.argv[3] ?? "42";
  const kaisai = compactDate(raceDate);
  await mkdir(outDir, { recursive: true });

  console.log(`Probe NAR date=${raceDate} preferVenue=${preferVenue} (${VENUE[preferVenue] ?? "?"})`);

  const listUrl = `https://nar.netkeiba.com/top/race_list_sub.html?kaisai_date=${kaisai}`;
  const listHtml = await fetchText(listUrl);
  await writeFile(path.join(outDir, `race_list_${kaisai}.html`), listHtml);
  const allIds = parseRaceIds(listHtml);
  const byVenue = {};
  for (const id of allIds) {
    const v = venueCodeFromRaceId(id);
    byVenue[v] ??= [];
    byVenue[v].push(id);
  }
  console.log(
    "venues:",
    Object.entries(byVenue)
      .map(([c, ids]) => `${c}:${VENUE[c] ?? "?"}=${ids.length}`)
      .join(", "),
  );

  const venueIds = byVenue[preferVenue] ?? allIds;
  if (!venueIds.length) throw new Error("No race ids found");
  const sampleIds = venueIds.slice(0, Math.min(3, venueIds.length));

  const races = [];
  const oddsReports = {};

  for (const raceId of sampleIds) {
    const venueCode = venueCodeFromRaceId(raceId);
    const venue = VENUE[venueCode] ?? venueCode;
    const raceNumber = raceNumberFromRaceId(raceId);
    console.log(`\n--- ${venue}${raceNumber}R ${raceId} ---`);

    const shutubaUrl = `https://nar.netkeiba.com/race/shutuba.html?race_id=${raceId}`;
    const shutubaHtml = await fetchText(shutubaUrl);
    await writeFile(path.join(outDir, `shutuba_${raceId}.html`), shutubaHtml);
    await sleep(400);

    const meta = parseShutubaMeta(shutubaHtml);
    const horses = parseHorses(shutubaHtml);
    console.log(`meta: ${meta.title} ${meta.distance} start=${meta.startTime} horses=${horses.length}`);
    console.log(`raceData01: ${meta.raceData01.slice(0, 120)}`);

    const odds = await probeOddsApi(raceId);
    oddsReports[raceId] = odds;
    for (const o of odds) {
      console.log(
        `  odds type=${o.type} ${o.bet}: status=${o.status ?? o.error ?? "?"} keys=${o.keyCount ?? 0} sample=${JSON.stringify(o.sampleValue)?.slice(0, 80)}`,
      );
    }

    const resultUrl = `https://nar.netkeiba.com/race/result.html?race_id=${raceId}`;
    let resultHtml = "";
    try {
      resultHtml = await fetchText(resultUrl);
      await writeFile(path.join(outDir, `result_${raceId}.html`), resultHtml);
    } catch (e) {
      console.log(`result fetch fail: ${e}`);
    }
    const payoutHints = parseResultPayoutHints(resultHtml);
    console.log(`payout hints: ${JSON.stringify(payoutHints)}`);
    await sleep(400);

    // Build a thin Race-shaped object from type=1 win odds if present
    const winApiPath = path.join(outDir, `api_${raceId}_type1.json`);
    let winMap = new Map();
    try {
      const { readFile } = await import("node:fs/promises");
      const winJson = JSON.parse(await readFile(winApiPath, "utf8"));
      const ary = winJson.ary_odds ?? {};
      for (const [k, v] of Object.entries(ary)) {
        if (v && typeof v === "object" && v.Odds != null) {
          winMap.set(Number(k), Number(v.Odds));
        }
      }
      // nested: some responses use { "1": { "01": {...}}, "2": {...} }
      if (winMap.size === 0 && ary["1"] && typeof ary["1"] === "object") {
        for (const [k, v] of Object.entries(ary["1"])) {
          if (v?.Odds != null) winMap.set(Number(k), Number(v.Odds));
        }
      }
    } catch {
      /* no win file */
    }

    const board = [];
    const enrichedHorses = horses.map((h) => {
      const oddsWin = winMap.get(h.number) ?? 99.9;
      board.push({ betType: "win", selection: String(h.number), odds: oddsWin });
      return {
        ...h,
        oddsWin,
        factors: {
          courseFit: 50,
          paceFit: 50,
          conditionFit: 50,
          formSignal: 50,
          valueGap: Math.min(100, Math.round(oddsWin)),
        },
        comment: "Phase0 probe stub",
        placePotential: 50,
      };
    });

    races.push({
      id: `${slugVenue(venue)}-${kaisai}-${raceNumber}`,
      sourceRaceId: raceId,
      authority: "NAR",
      raceDate,
      venue,
      raceNumber,
      title: meta.title || `${venue}${raceNumber}R`,
      distance: meta.distance || "?",
      track: toTrack(meta.trackRaw),
      startTime: meta.startTime || "",
      weather: meta.weather || "",
      condition: meta.condition || "",
      horses: enrichedHorses,
      oddsBoard: board,
      fieldSize: enrichedHorses.length,
      payoutHints,
      probe: {
        shutubaUrl,
        resultUrl,
        oddsApi: "https://nar.netkeiba.com/api/api_get_nar_odds.html",
      },
    });
  }

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    source: "nar.netkeiba.com (Phase0 probe)",
    authority: "NAR",
    raceDate,
    raceCount: races.length,
    venues: [...new Set(races.map((r) => r.venue))],
    races,
    probeMeta: {
      listUrl,
      allRaceIdsOnDay: allIds.length,
      venuesOnDay: Object.fromEntries(
        Object.entries(byVenue).map(([c, ids]) => [VENUE[c] ?? c, ids.length]),
      ),
      oddsApiReports: oddsReports,
      venueCodeTable: VENUE,
      notes: [
        "JRA api_get_jra_odds returns NG for NAR race_id",
        "NAR uses api_get_nar_odds.html with ary_odds shape (not data.odds)",
        "race_id = YYYY + venue(2) + MMDD + RR (12 digits)",
      ],
    },
  };

  const snapDir = path.join(root, "tmp", "nar-probe", "snapshots");
  await mkdir(snapDir, { recursive: true });
  const snapPath = path.join(snapDir, `${raceDate}.json`);
  await writeFile(snapPath, JSON.stringify(snapshot, null, 2));
  await writeFile(path.join(outDir, "probe-report.json"), JSON.stringify(snapshot.probeMeta, null, 2));
  console.log(`\nWrote ${snapPath}`);
  console.log(`Wrote ${path.join(outDir, "probe-report.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
