/**
 * 天候アイコンと、結果騎手名を出馬表へ寄せる処理。
 *   node scripts/test-race-meta.mjs
 */
import assert from "node:assert/strict";
import { applyEntryJockeyNames, parseRaceMeta } from "./fetch-jra-snapshot.mjs";

const iconHtml = `<div class="RaceList_Item02">
<h1 class="RaceName">2歳未勝利</h1>
<div class="RaceData01">
09:40発走 / <span> ダ1700m</span> 右
/ <span class="Icon_Weather02 Icon_W01" role="img" aria-label="晴" title="晴"></span>
<span class="Item04"> 良</span>
</div>
<div class="RaceData02"><span>未勝利</span></div>
</div>`;

{
  const meta = parseRaceMeta(iconHtml, "202603030301");
  assert.equal(meta.weather, "晴");
  assert.equal(meta.condition, "良");
  assert.equal(meta.distance, "ダート1700m");
  assert.equal(meta.venue, "福島");
  console.log("OK weather icon aria-label");
}

{
  const html = `<div class="RaceData01">15:10発走 / <span>芝1600m</span>
<span class="Icon_W03" role="img"></span>
<span class="Item04">重</span></div>`;
  const meta = parseRaceMeta(html, "202605050111");
  assert.equal(meta.weather, "雨");
  assert.equal(meta.condition, "重");
  console.log("OK weather icon code without label");
}

{
  const html = `<div class="RaceData01">天候:曇 / 馬場:稍重 / 芝2000m 10:10発走</div>`;
  const meta = parseRaceMeta(html, "202608080801");
  assert.equal(meta.weather, "曇");
  assert.equal(meta.condition, "稍重");
  console.log("OK legacy weather text");
}

{
  const result = {
    finishes: [
      { number: 2, jockey: "ルメー" },
      { number: 4, jockey: "マーカ" },
      { number: 9, jockey: "武藤" },
    ],
  };
  applyEntryJockeyNames(
    [
      { number: 2, jockey: "ルメール" },
      { number: 4, jockey: "マーカンド" },
      { number: 9, jockey: "—" },
    ],
    result,
  );
  assert.equal(result.finishes[0].jockey, "ルメール");
  assert.equal(result.finishes[1].jockey, "マーカンド");
  assert.equal(result.finishes[2].jockey, "武藤");
  console.log("OK entry jockey names on results");
}
