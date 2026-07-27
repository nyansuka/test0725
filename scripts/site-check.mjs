/**
 * サイト整合性チェック。問題があれば exit 1。
 *
 *   node scripts/site-check.mjs
 *   docker compose exec web npm run site:check
 */
import http from "node:http";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const HOST = process.env.SITE_HOST || "127.0.0.1";
const PORT = Number(process.env.SITE_PORT || 3000);

const failures = [];
const notes = [];

function fail(msg) {
  failures.push(msg);
  console.log(`FAIL  ${msg}`);
}

function ok(msg) {
  console.log(`OK    ${msg}`);
}

function get(p) {
  return new Promise((resolve) => {
    http
      .get({ host: HOST, port: PORT, path: p }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      })
      .on("error", (e) => resolve({ status: 0, body: String(e) }));
  });
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function checkHttp() {
  const paths = ["/", "/longshots", "/races", "/settings", "/journal", "/method"];
  for (const p of paths) {
    const { status, body } = await get(p);
    if (status !== 200 || !body.includes("UMANOTE")) {
      fail(`${p} status=${status} or missing UMANOTE`);
    } else {
      ok(`${p} ${status}`);
    }
  }

  const longshots = await get("/longshots");
  if (!longshots.body.includes("注目馬の的中")) {
    fail("/longshots に「注目馬の的中」サマリー説明が無い");
  } else {
    ok("/longshots 注目馬サマリー");
  }

  const method = await get("/method");
  if (!method.body.includes("短評")) {
    fail("/method に「短評」説明が無い");
  } else {
    ok("/method 短評セクション");
  }
  // 旧文言（実装と矛盾）が残っていないこと
  if (method.body.includes("表示中の開催日は傾向から除外します")) {
    fail("/method が旧文言「表示中の開催日は傾向から除外」のまま");
  } else {
    ok("/method 傾向の説明が現行実装と一致");
  }

  const races = await get("/races");
  const m = races.body.match(/\/races\/[a-z0-9-]+/);
  if (!m) {
    fail("レース詳細リンクが /races に無い");
  } else {
    const detail = await get(m[0]);
    if (detail.status !== 200) fail(`${m[0]} status=${detail.status}`);
    else ok(`${m[0]} ${detail.status}`);
  }
}

async function checkApi() {
  const { status, body } = await get("/api/races");
  if (status !== 200) {
    fail(`/api/races status=${status}`);
    return;
  }
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    fail("/api/races JSON parse failed");
    return;
  }
  const live = (data.races || []).filter((r) => r.raceDate === data.raceDate);
  const nonJra = live.filter((r) => r.authority && r.authority !== "JRA");
  if (nonJra.length) fail(`非JRAレースが混在: ${nonJra.length}`);
  else ok(`api JRAのみ live=${live.length}`);

  if (live.length === 0) {
    notes.push("live races=0（開催日データ無しの可能性）");
  }

  const withOdds = live.filter((r) => (r.oddsBoard || []).length > 0);
  if (live.length && withOdds.length === 0) fail("オッズ板が全レース空");
  else if (live.length) ok(`api oddsBoard あり ${withOdds.length}/${live.length}`);
}

async function checkTrendsAndComments() {
  const trendsPath = path.join(root, "src", "data", "loop", "trends", "latest.json");
  if (!(await exists(trendsPath))) {
    fail("trends/latest.json が無い");
    return;
  }
  const trends = JSON.parse(await readFile(trendsPath, "utf8"));
  if (!trends.dayCount || trends.dayCount < 1) {
    fail("trends.dayCount < 1");
  } else {
    ok(`trends dayCount=${trends.dayCount}`);
  }

  // ドメイン経由で短評に 評価/傾向 が入ること
  const r = spawnSync(
    "npx",
    [
      "--yes",
      "tsx",
      "-e",
      `
import { readFileSync } from "fs";
import { selectLongshots } from "./src/domain/longshots.ts";
import { DEFAULT_SETTINGS } from "./src/domain/betTypes.ts";
const snap = JSON.parse(readFileSync("src/data/snapshots/latest.json","utf8"));
const picks = selectLongshots(snap.races || [], DEFAULT_SETTINGS).slice(0, 5);
if (!picks.length) { console.log("NO_PICKS"); process.exit(2); }
let bad = 0;
for (const p of picks) {
  if (!p.comment.includes("評価:") || !p.comment.includes("傾向:")) {
    console.log("BAD", p.comment);
    bad++;
  }
}
console.log(bad === 0 ? "COMMENT_OK " + picks.length : "COMMENT_BAD " + bad);
process.exit(bad === 0 ? 0 : 1);
`,
    ],
    { cwd: root, encoding: "utf8", shell: process.platform === "win32" },
  );

  const out = `${r.stdout || ""}${r.stderr || ""}`;
  if (r.status === 0 && out.includes("COMMENT_OK")) {
    ok(`short comments have 評価/傾向 (${out.trim()})`);
  } else if (out.includes("NO_PICKS")) {
    notes.push("候補0件のため短評チェックスキップ");
    ok("short comments skipped (no picks)");
  } else {
    fail(`短評に評価/傾向が無い: ${out.slice(0, 400)}`);
  }
}

async function checkDocsAlign() {
  const methodSrc = await readFile(
    path.join(root, "src", "components", "Method.tsx"),
    "utf8",
  );
  if (methodSrc.includes("表示中の開催日は傾向から除外します")) {
    fail("Method.tsx に旧除外文言が残っている");
  } else {
    ok("Method.tsx 文言OK");
  }

  const longshots = await readFile(
    path.join(root, "src", "domain", "longshots.ts"),
    "utf8",
  );
  if (!longshots.includes("Math.min")) {
    fail("relatedPlacePotential が下限合成でない可能性");
  } else {
    ok("longshots 下限合成");
  }
}

async function main() {
  console.log(`site-check ${HOST}:${PORT}`);
  await checkHttp();
  await checkApi();
  await checkTrendsAndComments();
  await checkDocsAlign();

  console.log("---");
  if (notes.length) {
    for (const n of notes) console.log(`NOTE  ${n}`);
  }
  if (failures.length) {
    console.log(`RESULT FAIL (${failures.length})`);
    process.exit(1);
  }
  console.log("RESULT PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
