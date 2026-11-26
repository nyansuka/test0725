/**
 * 解説キャラクターの姿勢と、並びの一言。
 *   npx tsx scripts/test-commentator.mts
 */
import assert from "node:assert/strict";
import {
  commentatorMood,
  liveOrderLine,
  manekiFrame,
  preStartSpeech,
  racePoints,
  softenLast,
  spokenGap,
  movePhaseId,
  watchMention,
} from "../src/domain/sim/commentator.ts";

assert.equal(commentatorMood("start"), "wait");
assert.equal(commentatorMood("down"), "talk");
assert.equal(commentatorMood("back"), "talk");
assert.equal(commentatorMood("c1"), "point");
assert.equal(commentatorMood("c3"), "point");
assert.equal(commentatorMood("c4"), "point");
assert.equal(commentatorMood("hill"), "lean");
assert.equal(commentatorMood("straight"), "lean");
assert.equal(commentatorMood("goal"), "done");

assert.equal(manekiFrame("wait"), "raku");
assert.equal(manekiFrame("talk"), "ki");
assert.equal(manekiFrame("point"), "do");
assert.equal(manekiFrame("lean"), "do");
assert.equal(manekiFrame("done"), "ki");

assert.deepEqual(
  racePoints([
    { id: "start", title: "枠なり" },
    { id: "down", title: "序盤が速い" },
    { id: "goal", title: "前と内の想定" },
  ]),
  ["序盤が速い"],
);

assert.equal(
  preStartSpeech("中山芝1200", ["右回り・外回り", "直線310m・急坂"], ["序盤が速い", "急坂で前が残る"]),
  "中山芝1200の発走前だよ。コースの特徴は、右回り・外回り、直線310m・急坂。見るところは「序盤が速い」と「急坂で前が残る」だよ。着順の予想じゃないから、型として見てね。",
);
assert.equal(softenLast("向正面は下り。前が速くなりやすい。"), "向正面は下り。前が速くなりやすいよ。");
assert.equal(softenLast("逃げはいない想定です。"), "逃げはいない想定だよ。");
assert.equal(softenLast("着順の予想ではない。"), "着順の予想ではないよ。");
assert.equal(softenLast("内の先行はレールの好位。"), "内の先行はレールの好位だよ。");

assert.equal(spokenGap(0.2), "ほぼ並んでいます");
assert.equal(spokenGap(2.5), "先頭から1馬身");
assert.equal(spokenGap(3.7), "先頭から1.5馬身");

const field = [
  { number: 3, name: "ウィングブルー", style: "逃", behindM: 0, passUnknown: false },
  { number: 1, name: "デンプシー", style: "先", behindM: 6, passUnknown: false },
  { number: 8, name: "位置なし", style: "差", behindM: 40, passUnknown: true },
];

assert.equal(liveOrderLine(field, false), null);
assert.equal(
  liveOrderLine(field, true),
  "いま先頭は3番ウィングブルー（逃）だよ。2番手の1番デンプシー（先）は、先頭から2.5馬身だね。",
);
assert.equal(
  liveOrderLine([{ ...field[0], behindM: 0 }, { ...field[1], behindM: 0.4 }], true),
  "いま先頭は3番ウィングブルー（逃）だよ。2番手の1番デンプシー（先）とは、ほぼ並んでいるよ。",
);
assert.equal(
  liveOrderLine([{ number: 4, name: "不明", style: "差", behindM: 0, passUnknown: true }], true),
  null,
);

assert.equal(watchMention([], field, false), null);
assert.equal(
  watchMention([{ number: 1, name: "デンプシー" }], field, false),
  "注目馬は1番デンプシー（先）だよ。",
);
assert.equal(
  watchMention(
    [
      { number: 1, name: "デンプシー", superWatch: true },
      { number: 3, name: "ウィングブルー" },
    ],
    field,
    false,
  ),
  "注目馬は1番デンプシー（超注目・先）と3番ウィングブルー（逃）だよ。",
);
assert.equal(
  watchMention([{ number: 1, name: "デンプシー" }], field, true),
  "注目馬の1番デンプシーは先頭から2.5馬身だよ。",
);
assert.equal(
  watchMention([{ number: 3, name: "ウィングブルー" }], field, true),
  "注目馬の3番ウィングブルーはいま先頭だよ。",
);
assert.equal(
  watchMention([{ number: 8, name: "位置なし" }], field, false, "start"),
  "注目馬は8番位置なし（差）だよ。通過が無いから、馬身は出していないよ。",
);
assert.equal(
  watchMention(
    [
      { number: 1, name: "デンプシー" },
      { number: 8, name: "位置なし" },
    ],
    field,
    false,
    "start",
  ),
  "注目馬は1番デンプシー（先）と8番位置なし（差）だよ。8番は通過が無いから、馬身は出していないよ。",
);
assert.equal(watchMention([{ number: 8, name: "位置なし" }], field, true, "down"), null);
assert.equal(
  watchMention(
    [
      { number: 1, name: "デンプシー" },
      { number: 8, name: "位置なし" },
    ],
    field,
    true,
    "c3",
  ),
  "注目馬の1番デンプシーは先頭から2.5馬身だよ。",
);
assert.equal(watchMention([{ number: 99, name: "いない" }], field, true), null);

const phases = [
  { id: "start" },
  { id: "down" },
  { id: "c3" },
  { id: "c4" },
  { id: "hill" },
  { id: "goal" },
];
const closer = {
  number: 4,
  name: "ジョヴィアン",
  style: "追",
  behindM: 30,
  corner3Rate: 0.88,
  corner4Rate: 0.82,
  stretchGainM: 24,
};
const cornerMover = {
  number: 5,
  name: "キューティ",
  style: "追",
  behindM: 20,
  corner3Rate: 0.67,
  corner4Rate: 0.33,
  stretchGainM: -10,
};
const leader = {
  number: 3,
  name: "ウィングブルー",
  style: "逃",
  behindM: 0,
  corner3Rate: 0.1,
  corner4Rate: 0.1,
  stretchGainM: -8,
};

assert.equal(movePhaseId(closer, phases), "hill");
assert.equal(movePhaseId(cornerMover, phases), "c4");
assert.equal(movePhaseId(leader, phases), "down");
assert.equal(movePhaseId({ ...leader, passUnknown: true }, phases), null);
assert.equal(movePhaseId({ number: 1, name: "デンプシー", style: "先", behindM: 6, corner3Rate: 0.27, corner4Rate: 0.25, stretchGainM: 8 }, phases), "c4");
assert.equal(
  movePhaseId(closer, [
    { id: "start" },
    { id: "back" },
    { id: "c4" },
    { id: "straight" },
    { id: "goal" },
  ]),
  "straight",
);

assert.equal(
  watchMention([{ number: 4, name: "ジョヴィアン" }], [closer], true, "hill", phases),
  "注目馬の4番ジョヴィアンは先頭から12馬身だよ。注目馬の4番ジョヴィアンは仕掛けるタイミングならここだよ。",
);
assert.equal(
  watchMention([{ number: 4, name: "ジョヴィアン" }], [closer], true, "c4", phases),
  "注目馬の4番ジョヴィアンは先頭から12馬身だよ。",
);
assert.equal(
  watchMention([{ number: 5, name: "キューティ" }], [cornerMover], true, "c4", phases),
  "注目馬の5番キューティは先頭から8馬身だよ。注目馬の5番キューティは仕掛けるタイミングならここだよ。",
);
assert.equal(
  watchMention([{ number: 3, name: "ウィングブルー" }], [leader], true, "down", phases),
  "注目馬の3番ウィングブルーはいま先頭だよ。注目馬の3番ウィングブルーは仕掛けるタイミングならここだよ。",
);
assert.equal(
  watchMention(
    [
      { number: 4, name: "ジョヴィアン" },
      { number: 5, name: "キューティ" },
    ],
    [closer, cornerMover],
    true,
    "hill",
    phases,
  ),
  "注目馬は、4番ジョヴィアンは先頭から12馬身だよ、5番キューティは先頭から8馬身だよ。注目馬の4番ジョヴィアンは仕掛けるタイミングならここだよ。",
);

console.log("commentator ok");
