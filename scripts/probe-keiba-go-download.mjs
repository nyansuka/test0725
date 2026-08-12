/**
 * Download official keiba.go.jp daily race/odds ZIP if accessible without login.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "tmp", "nar-probe");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function get(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "*/*",
      "Accept-Language": "ja",
      Referer: "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/TodayRaceInfoTop",
    },
    redirect: "follow",
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    url: res.url,
    ctype: res.headers.get("content-type"),
    cdisp: res.headers.get("content-disposition"),
    buf,
    text: buf.toString("utf8"),
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const urls = [
    "https://www.keiba.go.jp/KeibaWeb/DataDownload/RaceDataDownload?type=daily",
    "https://www.keiba.go.jp/KeibaWeb/DataDownload/OddsDataDownload?type=daily",
    "https://www.keiba.go.jp/KeibaWeb/DataDownload/RaceDataDownload?type=monthly",
    "https://www.keiba.go.jp/KeibaWeb/DataDownload/OddsDataDownload?type=monthly",
    "https://www.keiba.go.jp/KeibaWeb/DataRoom/DataRoomTop",
  ];
  const report = [];
  for (const u of urls) {
    const r = await get(u);
    const isZip = r.buf[0] === 0x50 && r.buf[1] === 0x4b;
    const fname = u.includes("Odds")
      ? u.includes("monthly")
        ? "official_odds_monthly.bin"
        : "official_odds_daily.bin"
      : u.includes("Race")
        ? u.includes("monthly")
          ? "official_race_monthly.bin"
          : "official_race_daily.bin"
        : "official_dataroom.html";
    await writeFile(path.join(outDir, fname), r.buf);
    report.push({
      u,
      status: r.status,
      finalUrl: r.url,
      ctype: r.ctype,
      cdisp: r.cdisp,
      len: r.buf.length,
      isZip,
      snip: isZip ? "(zip binary)" : r.text.slice(0, 200).replace(/\n/g, " "),
    });
    console.log(r.status, r.ctype, "zip=" + isZip, "len=" + r.buf.length, u);
    console.log(" ", r.cdisp || "", r.url);
  }
  await writeFile(path.join(outDir, "official-download-report.json"), JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
