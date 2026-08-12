/**
 * Phase0: dump live NAR odds API shapes + parse finished combo HTML tables.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "..", "tmp", "nar-probe");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function get(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*", "Accept-Language": "ja" },
  });
  return res.text();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function summarizeOddsObject(obj, depth = 0) {
  if (!obj || typeof obj !== "object") return { type: typeof obj };
  const keys = Object.keys(obj);
  const first = obj[keys[0]];
  return {
    keyCount: keys.length,
    firstKeys: keys.slice(0, 8),
    firstValueType: first == null ? "null" : typeof first,
    firstValuePreview: JSON.stringify(first)?.slice(0, 160),
    nested:
      depth < 2 && first && typeof first === "object" && !("Odds" in first)
        ? summarizeOddsObject(first, depth + 1)
        : undefined,
  };
}

async function dumpApi(raceId, label) {
  const out = {};
  for (const type of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const url = `https://nar.netkeiba.com/api/api_get_nar_odds.html?type=${type}&race_id=${raceId}&is_ajax=1&action=init`;
    const text = await get(url);
    await writeFile(path.join(outDir, `api_${label}_${raceId}_type${type}.json`), text);
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      out[type] = { parseError: true, snip: text.slice(0, 100) };
      await sleep(250);
      continue;
    }
    out[type] = {
      status: json.status,
      odds_status: json.odds_status,
      topKeys: Object.keys(json),
      ary: summarizeOddsObject(json.ary_odds),
    };
    console.log(
      label,
      "type",
      type,
      "status",
      json.status,
      "odds_status",
      json.odds_status,
      "aryKeys",
      out[type].ary.keyCount,
      "first",
      out[type].ary.firstKeys?.[0],
      "preview",
      out[type].ary.firstValuePreview?.slice(0, 90),
    );
    await sleep(250);
  }
  return out;
}

function extractOddsRowsFromHtml(html) {
  // finished combo pages often have PopularOdds_Box / Odds_Table-like lists
  const rows = [];
  // pattern: selection text near Odds span
  for (const m of html.matchAll(
    /<tr[\s\S]*?<\/tr>/gi,
  )) {
    const row = m[0];
    const odds = row.match(/class="Odds[^"]*"[^>]*>\s*([0-9.]+)/i)?.[1];
    if (!odds) continue;
    const sel =
      row.match(/class="[^"]*(?:Umaban|Waku|Combination|Horse_Name)[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ??
      "";
    const plain = sel.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    rows.push({ selectionHint: plain.slice(0, 40), odds: Number(odds) });
  }
  return rows.slice(0, 15);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const liveId = process.argv[2] ?? "202642081101";
  const finishedId = process.argv[3] ?? "202642080701";

  console.log("=== LIVE API", liveId, "===");
  const live = await dumpApi(liveId, "live");

  console.log("=== FINISHED API", finishedId, "===");
  const finished = await dumpApi(finishedId, "fin");

  console.log("=== FINISHED HTML combo samples ===");
  const htmlSamples = {};
  for (const t of ["b1", "b3", "b4", "b5", "b7", "b8", "b9"]) {
    const html = await readFile(path.join(outDir, `odds_finished_${finishedId}_${t}.html`), "utf8").catch(
      async () => {
        const text = await get(`https://nar.netkeiba.com/odds/?race_id=${finishedId}&type=${t}`);
        await writeFile(path.join(outDir, `odds_finished_${finishedId}_${t}.html`), text);
        return text;
      },
    );
    const rows = extractOddsRowsFromHtml(html);
    htmlSamples[t] = { rowCountHint: rows.length, sample: rows.slice(0, 8) };
    console.log(t, JSON.stringify(rows.slice(0, 5)));
    await sleep(200);
  }

  // Inspect live HTML for embedded JSON or iframe
  const liveHtml = await readFile(path.join(outDir, `odds_html_${liveId}_b4.html`), "utf8");
  const scriptHints = [...liveHtml.matchAll(/src="([^"]*odds[^"]*)"/gi)].map((m) => m[1]).slice(0, 20);
  const ajaxHints = [...liveHtml.matchAll(/ajax[^"']*|api_get_nar_odds|odds_get/gi)].slice(0, 20).map((m) => m[0]);
  const hasIframe = /iframe/i.test(liveHtml);
  console.log("live b4 script src hints", scriptHints);
  console.log("live b4 ajax hints", [...new Set(ajaxHints)]);
  console.log("live b4 iframe", hasIframe);

  // Try SP odds
  const sp = await get(`https://nar.sp.netkeiba.com/odds/?pid=odds&race_id=${liveId}&type=b4`);
  await writeFile(path.join(outDir, `odds_sp_${liveId}_b4.html`), sp);
  console.log("sp b4 len", sp.length, "sample odds", [...sp.matchAll(/class="Odds[^"]*"[^>]*>\s*([0-9.]+)/g)].slice(0, 5).map((m) => m[1]));

  const report = { liveId, finishedId, live, finished, htmlSamples, scriptHints, ajaxHints: [...new Set(ajaxHints)] };
  await writeFile(path.join(outDir, "odds-shape-report.json"), JSON.stringify(report, null, 2));
  console.log("wrote odds-shape-report.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
