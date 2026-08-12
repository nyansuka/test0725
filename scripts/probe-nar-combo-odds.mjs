/**
 * Phase0 follow-up: combo odds acquisition paths for NAR.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "tmp", "nar-probe");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function get(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*", "Accept-Language": "ja" },
  });
  const text = await res.text();
  return { status: res.status, text };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const today = process.argv[2] ?? "20260811";
  const list = await get(`https://nar.netkeiba.com/top/race_list_sub.html?kaisai_date=${today}`);
  const uniq = [...new Set([...list.text.matchAll(/race_id=(\d{12})/g)].map((m) => m[1]))];
  const by = {};
  for (const id of uniq) {
    const v = id.slice(4, 6);
    by[v] = (by[v] || 0) + 1;
  }
  console.log("date", today, "venues", by, "count", uniq.length);

  const prefer = ["44", "45", "43", "42"];
  const pick = uniq.find((id) => prefer.includes(id.slice(4, 6))) || uniq[0];
  if (!pick) throw new Error("no races");
  console.log("pick", pick);

  const chk = await get(`https://nar.netkeiba.com/odds/ajax_get_odds.html?func=check&race_id=${pick}`);
  console.log("check", chk.text);
  await writeFile(path.join(outDir, `ajax_check_${pick}.json`), chk.text);

  const htmlSummary = {};
  for (const t of ["b1", "b3", "b4", "b5", "b6", "b7", "b8", "b9"]) {
    const r = await get(`https://nar.netkeiba.com/odds/?race_id=${pick}&type=${t}`);
    const sampleOdds = [...r.text.matchAll(/class="Odds[^"]*"[^>]*>\s*([0-9.]+)/g)]
      .slice(0, 5)
      .map((m) => m[1]);
    const hasPopular = /Popular_Ninki|Odds_Popular|Ninki/.test(r.text);
    const tableCount = (r.text.match(/<table/gi) || []).length;
    const pairCells = [...r.text.matchAll(/>\s*(\d{1,2})\s*[-−–]\s*(\d{1,2})\s*</g)].length;
    htmlSummary[t] = {
      len: r.text.length,
      tables: tableCount,
      sampleOdds,
      pairCells,
      hasPopular,
    };
    await writeFile(path.join(outDir, `odds_html_${pick}_${t}.html`), r.text);
    console.log(
      t,
      "len",
      r.text.length,
      "tables",
      tableCount,
      "pairs",
      pairCells,
      "odds",
      sampleOdds.join(","),
    );
    await sleep(350);
  }

  // API variants for combo on live race
  const apiTrials = [];
  const apiUrls = [
    `https://nar.netkeiba.com/api/api_get_nar_odds.html?type=1&race_id=${pick}&is_ajax=1&action=init`,
    `https://nar.netkeiba.com/api/api_get_nar_odds.html?type=4&race_id=${pick}&is_ajax=1&action=init`,
    `https://nar.netkeiba.com/api/api_get_nar_odds.html?type=5&race_id=${pick}&is_ajax=1&action=init`,
    `https://nar.netkeiba.com/api/api_get_nar_odds.html?type=8&race_id=${pick}&is_ajax=1&action=init`,
    `https://nar.netkeiba.com/odds/ajax_get_odds.html?func=check&race_id=${pick}`,
  ];
  for (const u of apiUrls) {
    const r = await get(u);
    let parsed = null;
    try {
      parsed = JSON.parse(r.text);
    } catch {
      parsed = null;
    }
    const aryKeys = parsed?.ary_odds ? Object.keys(parsed.ary_odds).length : 0;
    const sample = parsed?.ary_odds ? Object.entries(parsed.ary_odds)[0] : null;
    apiTrials.push({
      url: u,
      status: parsed?.status ?? r.status,
      odds_status: parsed?.odds_status,
      aryKeys,
      sample: sample ? { key: sample[0], val: sample[1] } : null,
      snip: r.text.slice(0, 160),
    });
    console.log("API", u.split("?")[1], "aryKeys", aryKeys, JSON.stringify(sample?.[1])?.slice(0, 80));
    await sleep(300);
  }

  // finished race combo HTML (浦和) — payouts exist; do combo odds tables still render?
  const finished = "202642080701";
  for (const t of ["b4", "b7", "b8"]) {
    const r = await get(`https://nar.netkeiba.com/odds/?race_id=${finished}&type=${t}`);
    const sampleOdds = [...r.text.matchAll(/class="Odds[^"]*"[^>]*>\s*([0-9.]+)/g)]
      .slice(0, 5)
      .map((m) => m[1]);
    const pairCells = [...r.text.matchAll(/>\s*(\d{1,2})\s*[-−–]\s*(\d{1,2})\s*</g)].length;
    console.log("finished", t, "len", r.text.length, "pairs", pairCells, "odds", sampleOdds.join(","));
    await writeFile(path.join(outDir, `odds_finished_${finished}_${t}.html`), r.text);
    await sleep(300);
  }

  // keiba.go.jp official presence smoke
  let official = { ok: false };
  try {
    const o = await get("https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/TodayRaceInfoTop");
    official = {
      ok: o.status === 200,
      len: o.text.length,
      hasOi: o.text.includes("大井") || o.text.includes("ｵｵｲ"),
      hasUrawa: o.text.includes("浦和"),
    };
  } catch (e) {
    official = { ok: false, error: String(e) };
  }
  console.log("official keiba.go.jp", official);

  const report = {
    date: today,
    venuesOnDay: by,
    pick,
    htmlSummary,
    apiTrials,
    official,
    betTypeMenuFromHtml: {
      b0: "上位人気一覧",
      b1: "単勝・複勝",
      b3: "枠連",
      b9: "枠単",
      b4: "馬連",
      b5: "ワイド",
      b6: "馬単",
      b7: "3連複",
      b8: "3連単",
    },
    findings: [
      "ajax_get_odds?func=check returns availability flags for types 1-9 (includes 枠単=9)",
      "api_get_nar_odds type param currently returns win-shaped ary_odds for all numeric types on tested races (combo path TBD / may need HTML parse)",
      "Odds UI uses type=b1..b9 query on /odds/",
    ],
  };
  await writeFile(path.join(outDir, "combo-odds-report.json"), JSON.stringify(report, null, 2));
  console.log("wrote combo-odds-report.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
