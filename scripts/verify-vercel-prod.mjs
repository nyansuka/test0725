/**
 * push 後に https://test0725.vercel.app がローカル latest スナップと一致するか確認する。
 *
 *   node scripts/verify-vercel-prod.mjs
 *   npm run site:verify-vercel
 *
 * 環境変数:
 *   VERCEL_PROD_URL          既定 https://test0725.vercel.app
 *   VERCEL_VERIFY_TIMEOUT_MS 既定 180000（デプロイ待ち）
 *   VERCEL_VERIFY_INTERVAL_MS 既定 12000
 *   SKIP_VERCEL_VERIFY=1     スキップ
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const PROD = (process.env.VERCEL_PROD_URL || "https://test0725.vercel.app").replace(/\/$/, "");
const TIMEOUT_MS = Number(process.env.VERCEL_VERIFY_TIMEOUT_MS || 180_000);
const INTERVAL_MS = Number(process.env.VERCEL_VERIFY_INTERVAL_MS || 12_000);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadExpected() {
  const p = path.join(root, "src", "data", "snapshots", "latest.json");
  const snap = JSON.parse(await readFile(p, "utf8"));
  if (!snap?.raceDate || !snap?.fetchedAt) {
    throw new Error("latest.json に raceDate / fetchedAt が無い");
  }
  return {
    raceDate: snap.raceDate,
    fetchedAt: snap.fetchedAt,
    raceCount: snap.raceCount ?? (snap.races?.length ?? 0),
  };
}

async function fetchProdCatalog() {
  const res = await fetch(`${PROD}/api/races`, {
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: text.slice(0, 200) };
  }
  try {
    const data = JSON.parse(text);
    return {
      ok: true,
      status: res.status,
      raceDate: data.raceDate ?? null,
      fetchedAt: data.fetchedAt ?? null,
      liveCount: (data.races || []).filter((r) => r.raceDate === data.raceDate).length,
    };
  } catch {
    return { ok: false, status: res.status, error: "JSON parse failed" };
  }
}

async function fetchProdHome() {
  const res = await fetch(`${PROD}/`, {
    headers: { Accept: "text/html", "Cache-Control": "no-cache" },
    cache: "no-store",
  });
  const body = await res.text();
  return {
    status: res.status,
    hasBrand: body.includes("UMANOTE"),
  };
}

function matches(expected, prod) {
  if (!prod.ok) return false;
  if (prod.raceDate !== expected.raceDate) return false;
  // 同一スナップなら fetchedAt 一致。結果差分更新で進んだ場合も許容（同じ日かつ新しい）
  if (prod.fetchedAt === expected.fetchedAt) return true;
  if (prod.fetchedAt && prod.fetchedAt >= expected.fetchedAt) return true;
  return false;
}

async function main() {
  if (process.env.SKIP_VERCEL_VERIFY === "1") {
    console.log("SKIP_VERCEL_VERIFY=1 — 本番確認をスキップ");
    process.exit(0);
  }

  const expected = await loadExpected();
  console.log(`== verify Vercel prod ==`);
  console.log(`url=${PROD}`);
  console.log(
    `expected raceDate=${expected.raceDate} fetchedAt=${expected.fetchedAt} races=${expected.raceCount}`,
  );

  const deadline = Date.now() + TIMEOUT_MS;
  let attempt = 0;
  let last = null;

  while (Date.now() <= deadline) {
    attempt += 1;
    last = await fetchProdCatalog();
    const line = last.ok
      ? `try ${attempt}: raceDate=${last.raceDate} fetchedAt=${last.fetchedAt} live=${last.liveCount}`
      : `try ${attempt}: FAIL status=${last.status} ${last.error || ""}`;
    console.log(line);

    if (matches(expected, last)) {
      const home = await fetchProdHome();
      if (home.status !== 200 || !home.hasBrand) {
        console.error(`FAIL 本番 / status=${home.status} brand=${home.hasBrand}`);
        process.exit(1);
      }
      console.log(`OK    ${PROD}/ 200 UMANOTE`);
      console.log(
        `RESULT VERCEL_OK raceDate=${last.raceDate} fetchedAt=${last.fetchedAt} live=${last.liveCount}`,
      );
      process.exit(0);
    }

    if (Date.now() + INTERVAL_MS > deadline) break;
    await sleep(INTERVAL_MS);
  }

  console.error("---");
  console.error("RESULT VERCEL_STALE");
  console.error(
    `本番が expected(raceDate=${expected.raceDate}, fetchedAt=${expected.fetchedAt}) に追いついていない`,
  );
  if (last?.ok) {
    console.error(`last prod: raceDate=${last.raceDate} fetchedAt=${last.fetchedAt}`);
  }
  console.error("Vercel Deployments の失敗／未デプロイ、または latest.json が push されていない可能性");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
