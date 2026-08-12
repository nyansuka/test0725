/**
 * 実結果ページの Fuku3/Tan3 行 HTML を確認する。
 *   node scripts/probe-fuku3-html.mjs [raceId] [pc|sp]
 */
const raceId = process.argv[2] ?? "202601010501";
const mode = (process.argv[3] ?? "pc").toLowerCase();
const url =
  mode === "sp"
    ? `https://race.sp.netkeiba.com/?pid=race_result&race_id=${raceId}`
    : `https://race.netkeiba.com/race/result.html?race_id=${raceId}`;
const ua =
  mode === "sp"
    ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
    : "Mozilla/5.0 (compatible; umanote-probe/1.0)";

const res = await fetch(url, { headers: { "User-Agent": ua } });
const html = await res.text();
console.log("mode", mode, "status", res.status, "htmlLen", html.length);

for (const cls of ["Fuku3", "Tan3", "Umaren", "Umatan"]) {
  const row = html.match(new RegExp(`<tr class="${cls}"[\\s\\S]*?<\\/tr>`, "i"))?.[0];
  console.log(`\n==== ${cls} len=${row?.length ?? 0}`);
  if (!row) {
    console.log("(missing class row)");
    continue;
  }
  console.log(row);
  const spans = [...row.matchAll(/<span>(\d+)<\/span>/g)].map((m) => m[1]);
  const liText = [...row.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").trim(),
  );
  console.log("spans", spans);
  console.log("liText", liText);
}
