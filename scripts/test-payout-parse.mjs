/**
 * parseResultHtml の Fuku3/Tan3（3連複・3連単）回帰テスト。
 *   node scripts/test-payout-parse.mjs
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseResultHtml } from "./fetch-jra-snapshot.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "fixtures", "result-payout-fuku3-tan3.html");

const html = await readFile(fixturePath, "utf8");
const result = parseResultHtml(html);

assert.ok(result, "result should parse");
assert.equal(result.finishes.length, 3);

const byType = Object.fromEntries(
  [...new Set(result.payouts.map((p) => p.betType))].map((t) => [
    t,
    result.payouts.filter((p) => p.betType === t),
  ]),
);

assert.ok(byType.trio?.length === 1, `expected trio payout, got ${JSON.stringify(result.payouts)}`);
assert.equal(byType.trio[0].selection, "3-5-7");
assert.equal(byType.trio[0].payoutYen, 560);

assert.ok(byType.trifecta?.length === 1, "expected trifecta payout");
assert.equal(byType.trifecta[0].selection, "7-5-3");
assert.equal(byType.trifecta[0].payoutYen, 2880);

assert.equal(byType.quinella?.[0]?.selection, "5-7");
assert.equal(byType.exacta?.[0]?.selection, "7-5");

console.log("OK payout parse: trio/trifecta + combo legs");
