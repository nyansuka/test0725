/**
 * M1/M2: 的中ファネルと Miss 分解。
 *   node scripts/test-sanren-funnel.mjs
 */
import assert from "node:assert/strict";
import {
  DEFAULT_TRIO_LANE,
  DEFAULT_TRIFECTA_LANE,
} from "./lib/sanren-lab-domain.mjs";
import {
  analyzeSanrenHitFunnel,
  classifySanrenMiss,
  comboKey,
  emptyFunnel,
  emptyMissCounts,
  funnelRates,
  mergeFunnel,
  mergeMissCounts,
} from "./lib/sanren-funnel.mjs";

function assertNested(funnel) {
  assert.ok(funnel.watch <= funnel.topN, "watch <= topN");
  assert.ok(funnel.topN <= funnel.scorePass, "topN <= scorePass");
  assert.ok(funnel.scorePass <= funnel.generated, "scorePass <= generated");
  assert.ok(funnel.generated <= funnel.gated, "generated <= gated");
  assert.ok(funnel.gated <= funnel.onBoard, "gated <= onBoard");
  assert.ok(funnel.onBoard <= funnel.payouts, "onBoard <= payouts");
}

assert.equal(classifySanrenMiss({
  onBoard: true, gated: true, inGenerated: true, inScorePass: true, inTopN: true,
}), null);
assert.equal(classifySanrenMiss({
  onBoard: false, gated: false, inGenerated: true, inScorePass: true, inTopN: true,
}), "板なし", "板なし候補が当たっても ticket にはしない");
assert.equal(classifySanrenMiss({
  onBoard: false, gated: false, inGenerated: false, inScorePass: false, inTopN: false,
}), "板なし");
assert.equal(classifySanrenMiss({
  onBoard: true, gated: false, inGenerated: false, inScorePass: false, inTopN: false,
}), "ゲート落ち");
assert.equal(classifySanrenMiss({
  onBoard: true, gated: true, inGenerated: false, inScorePass: false, inTopN: false,
}), "未生成");
assert.equal(classifySanrenMiss({
  onBoard: true, gated: true, inGenerated: true, inScorePass: false, inTopN: false,
}), "scoreMin落ち");
assert.equal(classifySanrenMiss({
  onBoard: true, gated: true, inGenerated: true, inScorePass: true, inTopN: false,
}), "topN落ち");

assert.equal(comboKey("r", "trio", "8-2-1"), "r|trio|1-2-8");
assert.equal(comboKey("r", "trifecta", "8-2-1"), "r|trifecta|8-2-1");

const merged = mergeFunnel(
  { payouts: 2, onBoard: 1, gated: 1, generated: 1, scorePass: 1, topN: 0, watch: 0 },
  { payouts: 3, onBoard: 2, gated: 1, generated: 0, scorePass: 0, topN: 0, watch: 0 },
);
assert.equal(merged.payouts, 5);
assert.equal(merged.onBoard, 3);
assert.equal(mergeMissCounts(emptyMissCounts(), { 板なし: 4 }).板なし, 4);

const frozen = [
  {
    id: "r1",
    venue: "東京",
    raceNumber: 1,
    authority: "JRA",
    oddsBoard: [
      { betType: "trio", selection: "1-2-6", odds: 180 },
      { betType: "trio", selection: "1-2-7", odds: 40 },
      { betType: "trio", selection: "1-2-8", odds: 220 },
      { betType: "trio", selection: "1-2-9", odds: 150 },
      { betType: "trio", selection: "1-2-10", odds: 160 },
      { betType: "trio", selection: "1-3-6", odds: 170 },
    ],
  },
];

const live = [
  {
    id: "r1",
    venue: "東京",
    raceNumber: 1,
    result: {
      payouts: [
        { betType: "trio", selection: "1-2-6", payoutYen: 18000 },
        { betType: "trio", selection: "2-1-6", payoutYen: 0 },
        { betType: "trio", selection: "1-2-7", payoutYen: 4000 },
        { betType: "trio", selection: "1-2-8", payoutYen: 22000 },
        { betType: "trio", selection: "1-2-9", payoutYen: 15000 },
        { betType: "trio", selection: "1-2-10", payoutYen: 16000 },
        { betType: "trio", selection: "1-3-6", payoutYen: 17000 },
        { betType: "trio", selection: "4-5-11", payoutYen: 99000 },
        { betType: "trifecta", selection: "1-2-6", payoutYen: 50000 },
      ],
    },
  },
];

const generatedPicks = [
  { raceId: "r1", betType: "trio", selection: "1-2-8", relatedScore: 50, pattern: "fav_fav_hole" },
  { raceId: "r1", betType: "trio", selection: "1-2-9", relatedScore: 70, pattern: "fav_fav_hole" },
  { raceId: "r1", betType: "trio", selection: "1-2-10", relatedScore: 80, pattern: "fav_fav_hole" },
  { raceId: "r1", betType: "trio", selection: "1-3-6", relatedScore: 75, pattern: "fav_fav_hole" },
];
const scorePassPicks = [
  { raceId: "r1", betType: "trio", selection: "1-2-9", relatedScore: 70, pattern: "fav_fav_hole" },
  { raceId: "r1", betType: "trio", selection: "1-2-10", relatedScore: 80, pattern: "fav_fav_hole" },
  { raceId: "r1", betType: "trio", selection: "1-3-6", relatedScore: 75, pattern: "fav_fav_hole" },
];
const productionPicks = [
  { raceId: "r1", betType: "trio", selection: "1-3-6", relatedScore: 75, pattern: "fav_fav_hole", label: "研究所注目" },
];

const trio = analyzeSanrenHitFunnel({
  lane: "trio",
  settings: DEFAULT_TRIO_LANE,
  frozenRaces: frozen,
  liveRaces: live,
  productionPicks,
  generatedPicks,
  scorePassPicks,
});

assert.equal(trio.funnel.payouts, 7, "payoutYen>0 の trio のみ（0円と単は除外）");
assert.equal(trio.funnel.onBoard, 6);
assert.equal(trio.funnel.gated, 5, "1-2-7 は 40 倍でゲート落ち");
assert.equal(trio.funnel.generated, 4);
assert.equal(trio.funnel.scorePass, 3);
assert.equal(trio.funnel.topN, 1);
assert.equal(trio.funnel.watch, 1);
assertNested(trio.funnel);

assert.equal(trio.missCounts.板なし, 1);
assert.equal(trio.missCounts.ゲート落ち, 1);
assert.equal(trio.missCounts.未生成, 1);
assert.equal(trio.missCounts.scoreMin落ち, 1);
assert.equal(trio.missCounts.topN落ち, 2);
assert.equal(trio.missRows.length, 6);
assert.equal(
  trio.funnel.payouts,
  trio.funnel.topN + Object.values(trio.missCounts).reduce((s, n) => s + n, 0),
  "捕捉 + miss = payouts",
);

const kinds = Object.fromEntries(trio.missRows.map((r) => [r.selection, r.missKind]));
assert.equal(kinds["4-5-11"], "板なし");
assert.equal(kinds["1-2-7"], "ゲート落ち");
assert.equal(kinds["1-2-6"], "未生成");
assert.equal(kinds["1-2-8"], "scoreMin落ち");
assert.equal(kinds["1-2-9"], "topN落ち");
assert.equal(kinds["1-2-10"], "topN落ち");

const rates = funnelRates(trio.funnel);
assert.equal(rates.boardRate, 6 / 7);
assert.equal(rates.catchRate, 1 / 5);
assert.equal(rates.watchRate, 1);

const offBoardPick = analyzeSanrenHitFunnel({
  lane: "trio",
  settings: DEFAULT_TRIO_LANE,
  frozenRaces: frozen,
  liveRaces: live,
  productionPicks: [
    ...productionPicks,
    { raceId: "r1", betType: "trio", selection: "4-5-11", label: "抑え" },
  ],
  generatedPicks,
  scorePassPicks,
});
assert.equal(offBoardPick.missCounts.板なし, 1);
assert.equal(offBoardPick.funnel.topN, 1);

const 抑え = analyzeSanrenHitFunnel({
  lane: "trio",
  settings: DEFAULT_TRIO_LANE,
  frozenRaces: frozen,
  liveRaces: live,
  productionPicks: [
    { raceId: "r1", betType: "trio", selection: "1-3-6", label: "抑え" },
  ],
  generatedPicks,
  scorePassPicks,
});
assert.equal(抑え.funnel.topN, 1);
assert.equal(抑え.funnel.watch, 0);

const trifecta = analyzeSanrenHitFunnel({
  lane: "trifecta",
  settings: DEFAULT_TRIFECTA_LANE,
  frozenRaces: [
    {
      id: "r1",
      oddsBoard: [{ betType: "trifecta", selection: "1-2-6", odds: 250 }],
    },
  ],
  liveRaces: live,
  productionPicks: [
    {
      raceId: "r1",
      betType: "trifecta",
      selection: "1-2-6",
      label: "研究所注目",
    },
  ],
  generatedPicks: [
    { raceId: "r1", betType: "trifecta", selection: "1-2-6", relatedScore: 70 },
  ],
  scorePassPicks: [
    { raceId: "r1", betType: "trifecta", selection: "1-2-6", relatedScore: 70 },
  ],
});
assert.equal(trifecta.funnel.payouts, 1);
assert.equal(trifecta.funnel.topN, 1);
assert.equal(trifecta.funnel.watch, 1);
assert.equal(Object.values(trifecta.missCounts).reduce((s, n) => s + n, 0), 0);
assertNested(trifecta.funnel);
assert.equal(trifecta.funnel.payouts + trio.funnel.payouts, 8, "レーンを足し合わせない前提の件数確認のみ");

const zero = funnelRates(emptyFunnel());
assert.equal(zero.boardRate, null);
assert.equal(zero.catchRate, null);

console.log("SANREN_FUNNEL_OK", {
  trio: trio.funnel,
  miss: trio.missCounts,
  trifecta: trifecta.funnel,
});
