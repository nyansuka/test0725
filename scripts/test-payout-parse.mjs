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

function byBetType(payouts) {
  return Object.fromEntries(
    [...new Set(payouts.map((p) => p.betType))].map((t) => [
      t,
      payouts.filter((p) => p.betType === t),
    ]),
  );
}

{
  const html = await readFile(path.join(__dirname, "fixtures", "result-payout-fuku3-tan3.html"), "utf8");
  const result = parseResultHtml(html);
  assert.ok(result, "result should parse");
  assert.equal(result.finishes.length, 3);
  const byType = byBetType(result.payouts);

  assert.ok(byType.trio?.length === 1, `expected trio payout, got ${JSON.stringify(result.payouts)}`);
  assert.equal(byType.trio[0].selection, "3-5-7");
  assert.equal(byType.trio[0].payoutYen, 560);

  assert.ok(byType.trifecta?.length === 1, "expected trifecta payout");
  assert.equal(byType.trifecta[0].selection, "7-5-3");
  assert.equal(byType.trifecta[0].payoutYen, 2880);

  assert.equal(byType.quinella?.[0]?.selection, "5-7");
  assert.equal(byType.exacta?.[0]?.selection, "7-5");
  console.log("OK payout parse: PC trio/trifecta + combo legs");
}

{
  // SP: 末尾番号が <span>10<br></span> 形式でも 3 脚取れること
  const html = await readFile(
    path.join(__dirname, "fixtures", "result-payout-fuku3-tan3-sp-br.html"),
    "utf8",
  );
  const result = parseResultHtml(html);
  assert.ok(result, "SP fixture should parse");
  const byType = byBetType(result.payouts);
  assert.equal(byType.trio?.[0]?.selection, "3-6-10");
  assert.equal(byType.trio?.[0]?.payoutYen, 6160);
  assert.equal(byType.trifecta?.[0]?.selection, "6-10-3");
  assert.equal(byType.trifecta?.[0]?.payoutYen, 24430);
  console.log("OK payout parse: SP <br>-inside-span trio/trifecta");
}
