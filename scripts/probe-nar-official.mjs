/**
 * Probe official keiba.go.jp download affordances + parse live NAR win odds HTML.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "tmp", "nar-probe");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function get(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ja",
    },
    redirect: "follow",
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, url: res.url, headers: Object.fromEntries(res.headers), buf, text: buf.toString("utf8") };
}

function parseWinOddsTable(html) {
  const horses = [];
  for (const m of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const row = m[0];
    if (!/Umaban|Waku/i.test(row)) continue;
    const num = Number(row.match(/class="[^"]*Umaban[^"]*"[^>]*>([\s\S]*?)</i)?.[1]?.replace(/<[^>]+>/g, "").trim());
    const name = row
      .match(/Horse_Name[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
      ?.replace(/<[^>]+>/g, "")
      ?.trim();
    const odds = Number(row.match(/class="Odds[^"]*"[^>]*>\s*([0-9.]+)/i)?.[1]);
    const ninki = Number(row.match(/class="[^"]*Ninki[^"]*"[^>]*>\s*(\d+)/i)?.[1]);
    if (Number.isFinite(num) && name && Number.isFinite(odds)) {
      horses.push({ number: num, name, oddsWin: odds, popularity: Number.isFinite(ninki) ? ninki : undefined });
    }
  }
  return horses;
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const liveHtml = await readFile(path.join(outDir, "odds_html_202642081101_b1.html"), "utf8");
  const liveWins = parseWinOddsTable(liveHtml);
  console.log("live b1 parsed horses", liveWins.length, liveWins.slice(0, 5));

  // shutuba for same race: map horseId
  const shutuba = await get("https://nar.netkeiba.com/race/shutuba.html?race_id=202642081101");
  await writeFile(path.join(outDir, "shutuba_202642081101.html"), shutuba.text);
  const horseIds = [...shutuba.text.matchAll(/db\.netkeiba\.com\/horse\/(\d+)/g)].map((m) => m[1]);
  console.log("shutuba horseIds", [...new Set(horseIds)].slice(0, 8), "count", new Set(horseIds).size);

  // official today page
  const today = await get("https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/TodayRaceInfoTop");
  await writeFile(path.join(outDir, "keiba_go_jp_today.html"), today.text);
  const dlLinks = [...today.text.matchAll(/href="([^"]+)"[^>]*>|href='([^']+)'/g)]
    .map((m) => m[1] || m[2])
    .filter((h) => /zip|csv|download|odds|Download|Data/i.test(h));
  const btnish = [...today.text.matchAll(/データダウンロード|オッズ情報|レース情報|download|Download|\.zip/gi)].map(
    (m) => m[0],
  );
  console.log("official dl-like hrefs", [...new Set(dlLinks)].slice(0, 30));
  console.log("official keywords", [...new Set(btnish)]);

  // common download URL guesses from manual naming
  const date = "20260811";
  const guesses = [
    `https://www.keiba.go.jp/data/${date}_race.zip`,
    `https://www.keiba.go.jp/data/${date}_odds.zip`,
    `https://www.keiba.go.jp/KeibaWeb/DataDownload`,
    `https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DataDownload`,
    `https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DownloadRaceData?k_raceDate=${date}`,
    `https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DownloadOddsData?k_raceDate=${date}`,
  ];
  const guessResults = [];
  for (const u of guesses) {
    try {
      const r = await get(u);
      guessResults.push({
        u,
        status: r.status,
        finalUrl: r.url,
        ctype: r.headers["content-type"],
        len: r.buf.length,
        snip: r.text.slice(0, 80).replace(/\n/g, " "),
      });
      console.log("guess", r.status, r.headers["content-type"], u, "->", r.url);
    } catch (e) {
      guessResults.push({ u, error: String(e) });
      console.log("guess fail", u, e.message);
    }
  }

  // Parse finished b4 HTML more carefully for selection keys
  const b4 = await readFile(path.join(outDir, "odds_finished_202642080701_b4.html"), "utf8");
  const b4Sample = [];
  for (const m of b4.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const row = m[0];
    const odds = row.match(/class="Odds[^"]*"[^>]*>\s*([0-9.]+)/i)?.[1];
    if (!odds) continue;
    const texts = [...row.matchAll(/>([^<]{1,20})</g)].map((x) => x[1].trim()).filter(Boolean);
    b4Sample.push({ odds: Number(odds), texts: texts.slice(0, 8) });
    if (b4Sample.length >= 8) break;
  }
  console.log("finished b4 row texts", JSON.stringify(b4Sample, null, 2));

  const report = {
    liveWins,
    shutubaHorseIdCount: new Set(horseIds).size,
    official: { dlLinks: [...new Set(dlLinks)], keywords: [...new Set(btnish)], guessResults },
    finishedB4Sample: b4Sample,
    conclusionHints: [
      "Live win/place odds appear embeddable from /odds/?type=b1 HTML (server-rendered table)",
      "api_get_nar_odds pre-race returns odds_status=yoso keyed by KettoNum (not umaban); type ignored",
      "Finished combo odds differ by type=b3..b9 HTML pages; API type param still returns win-only for finished",
      "keiba.go.jp advertises official ZIP/CSV odds downloads on TodayRaceInfo page",
    ],
  };
  await writeFile(path.join(outDir, "phase0-source-conclusion.json"), JSON.stringify(report, null, 2));
  console.log("wrote phase0-source-conclusion.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
