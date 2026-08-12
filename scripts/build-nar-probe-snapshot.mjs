/**
 * Phase0: build a fuller NAR snapshot for one venue-day (shutuba + win odds + results).
 * Combo odds: HTML scrape for finished races (thinned).
 *
 * Usage: node scripts/build-nar-probe-snapshot.mjs 2026-08-07 42
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "tmp", "nar-probe", "snapshots");

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

const SLUG = {
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

const HTML_TYPE_TO_BET = {
  b1: "win", // page also has place; win parsed separately via API when real
  b3: "bracket_quinella",
  b4: "quinella",
  b5: "wide",
  b6: "exacta",
  b7: "trio",
  b8: "trifecta",
  b9: "bracket_exacta", // NAR-only candidate; not in JRA BetType yet
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*", "Accept-Language": "ja" },
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

function ymd() {
  const arg = process.argv[2] ?? "2026-08-07";
  if (/^\d{8}$/.test(arg)) return `${arg.slice(0, 4)}-${arg.slice(4, 6)}-${arg.slice(6, 8)}`;
  return arg;
}

function compact(ymd) {
  return ymd.replaceAll("-", "");
}

function parseRaceIds(html, venueCode) {
  const ids = [...new Set([...html.matchAll(/race_id=(\d{12})/g)].map((m) => m[1]))];
  return ids.filter((id) => id.slice(4, 6) === venueCode).sort();
}

function parseMeta(html) {
  const name = html.match(/<div class="RaceName"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
  const data01 = html.match(/<div class="RaceData01"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
  const plain01 = decodeHtml(data01.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  const title = decodeHtml(name.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  const start = plain01.match(/(\d{1,2}:\d{2})/)?.[1] ?? "";
  const dist = plain01.match(/(芝|ダ|障)\s*(\d{3,4})m/);
  const weather = plain01.match(/天候\s*[:：]?\s*(\S+)/)?.[1] ?? "";
  const condition = plain01.match(/馬場\s*[:：]?\s*(\S+)/)?.[1] ?? "";
  return {
    title,
    startTime: start,
    trackRaw: dist?.[1] ?? "ダ",
    distance: dist ? `${dist[1]}${dist[2]}m` : "?",
    weather,
    condition,
  };
}

function parseHorses(html) {
  const horses = [];
  for (const rowMatch of html.matchAll(/<tr[^>]*class="[^"]*HorseList[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = rowMatch[1];
    const number = Number(
      row.match(/<td[^>]*class="[^"]*Umaban[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1]?.replace(/<[^>]+>/g, "")?.trim(),
    );
    const bracket = Number(row.match(/Waku[\s\S]*?>(\d+)</i)?.[1]);
    const name = decodeHtml(
      row.match(/HorseInfo[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]?.replace(/<[^>]+>/g, "") ?? "",
    );
    const jockey = decodeHtml(
      row.match(/Jockey[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]?.replace(/<[^>]+>/g, "") ?? "",
    );
    const horseId = row.match(/db\.netkeiba\.com\/horse\/(\d+)/i)?.[1] ?? null;
    if (!Number.isFinite(number) || !name) continue;
    horses.push({
      number,
      bracket: Number.isFinite(bracket) ? bracket : undefined,
      name,
      jockey,
      horseId,
    });
  }
  return horses;
}

async function fetchWinOdds(raceId) {
  const url = `https://nar.netkeiba.com/api/api_get_nar_odds.html?type=1&race_id=${raceId}&is_ajax=1&action=init`;
  const json = JSON.parse(await fetchText(url));
  const map = new Map();
  const ary = json.ary_odds ?? {};
  // finished real: umaban keys
  for (const [k, v] of Object.entries(ary)) {
    if (v?.Odds != null && /^\d+$/.test(k)) map.set(Number(k), Number(v.Odds));
  }
  return { status: json.status, oddsStatus: json.odds_status, map, rawKeyCount: Object.keys(ary).length };
}

function parseComboOddsHtml(html, betType) {
  const entries = [];
  for (const rowMatch of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const row = rowMatch[0];
    const odds = Number(row.match(/class="Odds[^"]*"[^>]*>\s*([0-9.]+)/i)?.[1]);
    if (!Number.isFinite(odds)) continue;
    // popular matrix pages often encode pair as data attributes or umaban cells
    const nums = [...row.matchAll(/class="[^"]*Umaban[^"]*"[^>]*>(\d+)</gi)].map((m) => Number(m[1]));
    const waku = [...row.matchAll(/class="[^"]*Waku[^"]*"[^>]*>(\d+)</gi)].map((m) => Number(m[1]));
    let selection = null;
    if (nums.length >= 2) selection = nums.join("-");
    else if (waku.length >= 2) selection = waku.join("-");
    else if (nums.length === 1) selection = String(nums[0]);
    else {
      const dash = row.match(/>(\d{1,2})\s*[-−–]\s*(\d{1,2})(?:\s*[-−–]\s*(\d{1,2}))?</);
      if (dash) selection = [dash[1], dash[2], dash[3]].filter(Boolean).join("-");
    }
    if (!selection) continue;
    entries.push({ betType, selection, odds });
  }
  return entries;
}

function parseResult(html) {
  const finishes = [];
  for (const rowMatch of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const row = rowMatch[0];
    const finish = Number(
      row.match(/class="[^"]*Result_Num[^"]*"[^>]*>([\s\S]*?)</i)?.[1]?.replace(/<[^>]+>/g, "").trim() ??
        row.match(/<td[^>]*class="[^"]*Order[^"]*"[^>]*>([\s\S]*?)</i)?.[1]?.replace(/<[^>]+>/g, "").trim(),
    );
    const number = Number(
      row.match(/class="[^"]*Umaban[^"]*"[^>]*>([\s\S]*?)</i)?.[1]?.replace(/<[^>]+>/g, "").trim(),
    );
    const name = decodeHtml(
      row.match(/Horse_Name[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]?.replace(/<[^>]+>/g, "") ?? "",
    );
    if (!Number.isFinite(finish) || !Number.isFinite(number)) continue;
    finishes.push({ finish, number, name });
  }
  const payoutHints = {};
  for (const label of ["単勝", "複勝", "枠連", "枠単", "馬連", "ワイド", "馬単", "3連複", "3連単"]) {
    if (html.includes(label)) payoutHints[label] = true;
  }
  return { finishes: finishes.slice(0, 20), payoutHints };
}

async function main() {
  const raceDate = ymd();
  const venueCode = process.argv[3] ?? "42";
  const venue = VENUE[venueCode];
  const kaisai = compact(raceDate);
  await mkdir(outDir, { recursive: true });

  const listHtml = await fetchText(`https://nar.netkeiba.com/top/race_list_sub.html?kaisai_date=${kaisai}`);
  const raceIds = parseRaceIds(listHtml, venueCode);
  console.log(`${raceDate} ${venue} races=${raceIds.length}`);
  if (!raceIds.length) throw new Error("no races");

  const races = [];
  for (const raceId of raceIds) {
    const raceNumber = Number(raceId.slice(10, 12));
    process.stdout.write(`${venue}${raceNumber}R ... `);
    const shutuba = await fetchText(`https://nar.netkeiba.com/race/shutuba.html?race_id=${raceId}`);
    await sleep(350);
    const meta = parseMeta(shutuba);
    const rawHorses = parseHorses(shutuba);
    const win = await fetchWinOdds(raceId);
    await sleep(300);

    let result = null;
    try {
      const resultHtml = await fetchText(`https://nar.netkeiba.com/race/result.html?race_id=${raceId}`);
      result = parseResult(resultHtml);
      await sleep(300);
    } catch {
      result = null;
    }

    const board = [];
    // combo scrape for a subset of types (finished only useful)
    for (const t of ["b3", "b4", "b5", "b6", "b7", "b8"]) {
      try {
        const html = await fetchText(`https://nar.netkeiba.com/odds/?race_id=${raceId}&type=${t}`);
        const betType = HTML_TYPE_TO_BET[t];
        const entries = parseComboOddsHtml(html, betType)
          .filter((e) => e.odds >= 8)
          .sort((a, b) => b.odds - a.odds)
          .slice(0, 40);
        board.push(...entries);
        await sleep(300);
      } catch {
        /* ignore */
      }
    }

    const horses = rawHorses.map((h) => {
      const oddsWin = win.map.get(h.number) ?? 99.9;
      board.unshift({ betType: "win", selection: String(h.number), odds: oddsWin });
      return {
        ...h,
        oddsWin,
        factors: {
          courseFit: 50,
          paceFit: 50,
          conditionFit: 50,
          formSignal: 50,
          valueGap: Math.min(100, Math.round(Number.isFinite(oddsWin) ? oddsWin : 50)),
        },
        comment: "Phase0 probe",
        placePotential: 50,
      };
    });

    races.push({
      id: `${SLUG[venue] ?? venueCode}-${kaisai}-${raceNumber}`,
      sourceRaceId: raceId,
      authority: "NAR",
      raceDate,
      venue,
      raceNumber,
      title: meta.title || `${venue}${raceNumber}R`,
      distance: meta.distance,
      track: meta.trackRaw?.startsWith("芝") ? "芝" : "ダート",
      startTime: meta.startTime,
      weather: meta.weather,
      condition: meta.condition,
      horses,
      oddsBoard: board,
      fieldSize: horses.length,
      oddsStatus: win.oddsStatus,
      result: result
        ? {
            finishes: result.finishes,
            payoutHints: result.payoutHints,
          }
        : undefined,
    });
    console.log(
      `horses=${horses.length} oddsStatus=${win.oddsStatus} board=${board.length} finishes=${result?.finishes?.length ?? 0}`,
    );
  }

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    source: "nar.netkeiba.com (Phase0 probe snapshot)",
    authority: "NAR",
    raceDate,
    raceCount: races.length,
    venues: [venue],
    races,
    phase0Notes: {
      winOddsApi: "https://nar.netkeiba.com/api/api_get_nar_odds.html",
      comboOddsHtml: "https://nar.netkeiba.com/odds/?race_id=&type=b3..b8",
      listUrl: `https://nar.netkeiba.com/top/race_list_sub.html?kaisai_date=${kaisai}`,
      selectionParseQuality: "combo selection parsing is best-effort in Phase0; verify before product use",
    },
  };

  const file = path.join(outDir, `${raceDate}-${SLUG[venue] ?? venueCode}.json`);
  await writeFile(file, JSON.stringify(snapshot, null, 2));
  // also write as latest probe
  await writeFile(path.join(outDir, "latest-probe.json"), JSON.stringify(snapshot, null, 2));
  console.log(`Wrote ${file}`);
  console.log(
    `summary fieldSizes=${races.map((r) => r.fieldSize).join(",")} payoutHasBracketExacta=${races.some((r) => r.result?.payoutHints?.["枠単"])}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
