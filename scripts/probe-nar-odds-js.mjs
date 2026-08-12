import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "tmp", "nar-probe");
const UA = "Mozilla/5.0";

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  return res.text();
}

async function main() {
  const jsUrls = [
    "https://cdnv2.netkeiba.com/img.nar/common/js/race/odds_common.js?20200318",
    "https://cdnv2.netkeiba.com/img.nar/common/js/race/odds_tanfuku.js?2019112101",
    "https://cdnv2.netkeiba.com/img.nar/common/js/race/odds_form.js?2019112101",
    "https://cdnv2.netkeiba.com/img.nar/common/js/race/odds_form_waku.js?2019112101",
    "https://cdnv2.netkeiba.com/img.nar/common/js/race/odds_ninki.js?2019112101",
  ];
  const report = {};
  for (const u of jsUrls) {
    const t = await get(u);
    const name = u.split("/").pop().split("?")[0];
    await writeFile(path.join(outDir, name), t);
    const urlish = [...t.matchAll(/['`](https?:[^'`]+|\/[^'`]*odds[^'`]*)['`]/g)].map((m) => m[1]);
    const apiish = [...t.matchAll(/api_get[A-Za-z0-9_./?-]+|ajax_get[A-Za-z0-9_./?-]+/g)].map((m) => m[0]);
    report[name] = {
      len: t.length,
      urls: [...new Set(urlish)].slice(0, 40),
      apis: [...new Set(apiish)].slice(0, 40),
    };
    console.log("===", name, "len", t.length);
    console.log("apis", report[name].apis.join(" | "));
    console.log("urls", report[name].urls.join(" | "));
  }

  const html = await readFile(path.join(outDir, "odds_html_202642081101_b4.html"), "utf8");
  const iframes = [...html.matchAll(/<iframe[\s\S]*?>/gi)].map((m) => m[0]);
  const srcs = [...html.matchAll(/<iframe[^>]*\ssrc="([^"]+)"/gi)].map((m) => m[1]);
  console.log("iframes count", iframes.length);
  console.log("iframe srcs", srcs);
  report.iframes = { count: iframes.length, srcs, raw: iframes.slice(0, 5) };

  // Also search HTML for odds_status / ary_odds / KettoNum
  report.htmlMentions = {
    api_get_nar_odds: html.includes("api_get_nar_odds"),
    ary_odds: html.includes("ary_odds"),
    KettoNum: html.includes("KettoNum"),
    odds_status: html.includes("odds_status"),
  };

  // Try fetching odds JS init endpoints referenced in odds_common if any
  for (const api of report["odds_common.js"]?.apis ?? []) {
    const abs = api.startsWith("http") ? api : `https://nar.netkeiba.com/${api.replace(/^\//, "")}`;
    const withId = abs.includes("race_id")
      ? abs
      : `${abs}${abs.includes("?") ? "&" : "?"}race_id=202642081101&type=4&action=init`;
    try {
      const text = await get(withId);
      console.log("try", withId.slice(0, 120), "=>", text.slice(0, 120).replace(/\n/g, " "));
    } catch (e) {
      console.log("fail", withId, e.message);
    }
  }

  await writeFile(path.join(outDir, "odds-js-report.json"), JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
