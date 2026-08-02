/**
 * site-check が PASS のときだけ、変更があれば commit & push。
 * push 後は https://test0725.vercel.app が latest スナップと一致するか確認する。
 *
 *   node scripts/site-check-push.mjs
 *   npm run site:check:push
 *
 * 環境変数:
 *   SKIP_PUSH=1  … コミットのみ
 *   SITE_CHECK_DRY=1 … チェックのみ（コミットしない）
 *   SKIP_VERCEL_VERIFY=1 … push 後の本番確認をスキップ
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    ...opts,
  });
  return r;
}

function main() {
  console.log("== site-check ==");
  const check = run("node", ["scripts/site-check.mjs"], { stdio: "inherit" });
  if (check.status !== 0) {
    console.error("site-check FAIL — commit/push をスキップ");
    process.exit(check.status || 1);
  }

  if (process.env.SITE_CHECK_DRY === "1") {
    console.log("DRY RUN — commit/push なし");
    process.exit(0);
  }

  const status = run("git", ["status", "--porcelain"]);
  const porcelain = (status.stdout || "").trim();
  if (!porcelain) {
    console.log("変更なし — push 不要");
    process.exit(0);
  }

  console.log("変更あり:\n" + porcelain);

  // 秘密ファイルをステージしない
  const blocked = porcelain
    .split("\n")
    .map((l) => l.replace(/^\?\? /, "").replace(/^.. /, "").trim())
    .filter((f) => /(^|\/)\.env|\.pem$|credentials/i.test(f));
  if (blocked.length) {
    console.error("秘密っぽいファイルがあるため中止:", blocked.join(", "));
    process.exit(1);
  }

  const add = run("git", ["add", "-A"]);
  if (add.status !== 0) {
    console.error(add.stderr);
    process.exit(1);
  }

  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const msg = `chore: site-check pass (${stamp})`;

  // Windows でも動くよう -m を直接渡す
  const commit = run("git", ["commit", "-m", msg]);
  if (commit.status !== 0) {
    console.error(commit.stdout || commit.stderr);
    process.exit(commit.status || 1);
  }
  console.log((commit.stdout || "").trim());

  if (process.env.SKIP_PUSH === "1") {
    console.log("SKIP_PUSH=1 — push せず終了");
    process.exit(0);
  }

  console.log("== git push ==");
  const push = run("git", ["push"], { stdio: "inherit" });
  if (push.status !== 0) {
    console.error("push 失敗");
    process.exit(push.status || 1);
  }
  console.log("RESULT COMMITTED_AND_PUSHED");

  if (process.env.SKIP_VERCEL_VERIFY === "1") {
    console.log("SKIP_VERCEL_VERIFY=1 — 本番確認をスキップ");
    process.exit(0);
  }

  console.log("== verify Vercel prod ==");
  const verify = run("node", ["scripts/verify-vercel-prod.mjs"], { stdio: "inherit" });
  if (verify.status !== 0) {
    console.error("push は成功したが本番反映確認に失敗（Deployments を確認）");
    process.exit(verify.status || 1);
  }
}

main();
