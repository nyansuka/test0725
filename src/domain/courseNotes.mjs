/**
 * 検証済みコース参考（阪神・中山・札幌）。
 * UI の説明と、枠バイアスの小さな補正の単一ソース。
 * courseFit / paceFit には載せない（馬ごとの同条件・脚質データではないため）。
 * 形状は JRA 公式。枠・前残りは距離ごとに入れたものだけスコアへ。
 */

export const GATE_OVERLAY_MAX = 4;

export function parseDistanceMeters(distance) {
  const s = String(distance ?? "");
  const m = s.match(/(\d{3,4})\s*m/i) ?? s.match(/(\d{3,4})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function normalizeVenue(venue) {
  return String(venue ?? "").replace(/競馬場$/, "").trim();
}

function distanceKey(track, meters) {
  if (track !== "芝" && track !== "ダート") return null;
  if (meters == null) return "generic";
  return `${track}:${meters}`;
}

/** @type {Record<string, object>} */
const HANSHIN = {
  generic: {
    summary: "内回りと外回りで別物。ゴール前に急坂。2025改修後の馬場は別物。",
    bullets: [
      "内回り（1200・1400・2000・2200）と外回り（1600・1800・2400）で直線長が違う。",
      "ゴール前は高低差1.8m・勾配1.5%の坂。スピードだけでは押し切れない。",
      "2023〜2025の改修で芝・ダートを更新。古いバイアスは割り引く。",
    ],
    gate: { mode: "none" },
    frontBias: false,
    scoreInGate: false,
  },
  "芝:1200": {
    summary: "内回り。3角まで243m。前と内枠。",
    bullets: [
      "内回りワンターン。最初のコーナーまで243mと短い。",
      "逃げ・先行と内枠が残りやすい。外から差し切る想定は弱い。",
      "ゴール前の急坂あり。",
    ],
    gate: { mode: "inner", boost: 3 },
    frontBias: true,
    scoreInGate: true,
  },
  "芝:1400": {
    summary: "内回り。逃げ切り一辺倒ではないが、前残り・内枠。",
    bullets: [
      "内回り。3角まで約443m（1200より長い）。",
      "逃げ切りは減るが差し有利にはならない。内でロスなく運べる馬。",
      "8枠は成績を落としやすい。",
    ],
    gate: { mode: "inner", boost: 2 },
    frontBias: true,
    scoreInGate: true,
  },
  "芝:1600": {
    summary: "外回りマイル。直線が長くても前が残りやすい。",
    bullets: [
      "外回り。直線約474m（右回り最長）でもペースは落ち着きやすい。",
      "逃げ・好位が粘る。後方一辺倒の差しは軸にしない。",
      "枠の有利不利は距離ほど強くない。",
    ],
    gate: { mode: "none" },
    frontBias: false,
    scoreInGate: false,
  },
  "芝:1800": {
    summary: "外回り。3角まで長く枠差は小さい。",
    bullets: [
      "外回り。スタートから3角まで約665m。",
      "枠順の偏りは小さい。実力どおりになりやすい。",
      "極端な前有利でも差し一辺倒でもない。",
    ],
    gate: { mode: "flatten" },
    frontBias: false,
    scoreInGate: true,
  },
  "芝:2000": {
    summary: "内回り（大阪杯）。好位と内枠。",
    bullets: [
      "内回り。最初のコーナーまで約325mと短い。",
      "序盤が緩みやすく、前につけた馬が残りやすい。",
      "G1でも好位通過が目安。内枠がポジションを取りやすい。",
    ],
    gate: { mode: "inner", boost: 2 },
    frontBias: true,
    scoreInGate: true,
  },
  "芝:2200": {
    summary: "内回り（宝塚記念）。2000より差しも届く。",
    bullets: [
      "内回りでも最初のコーナーまで約525m（2000より200m長い）。",
      "道中が緩み、ロングスパートになりやすい。差しも届く。",
      "極端なスローでは前が残る。枠は距離ほど強くない。",
    ],
    gate: { mode: "none" },
    frontBias: false,
    scoreInGate: false,
  },
  "芝:2400": {
    summary: "外回り。差しに余地。",
    bullets: [
      "外回り。中盤が緩みやすく、直線のトップスピード勝負。",
      "逃げは最後の坂が壁になりやすい。差しに余地。",
    ],
    gate: { mode: "none" },
    frontBias: false,
    scoreInGate: false,
  },
  "ダート:1200": {
    summary: "外枠・前。4角後方はほぼ届かない。",
    bullets: [
      "コーナーまで短く、基本は前。",
      "外枠が残りやすい。内枠は砂を被りやすい。",
      "4角10番手以下は中央ダ1200でも差しが決まりにくい。",
    ],
    gate: { mode: "outer", boost: 3 },
    frontBias: true,
    scoreInGate: true,
  },
  "ダート:1400": {
    summary: "芝スタート。外枠が長い芝を踏める。",
    bullets: [
      "約150mの芝スタート。外側ほど芝が長い。",
      "外枠有利。1200より差しは届きやすいが、後方一辺倒ではない。",
    ],
    gate: { mode: "outer", boost: 2 },
    frontBias: false,
    scoreInGate: true,
  },
  "ダート:1800": {
    summary: "4角前が強い。最外より5〜6枠。",
    bullets: [
      "スタート後に坂。1角まで短く、前が止まりにくい。",
      "4角先頭の信頼が厚い。後方からの差しはほぼ届かない。",
      "ダートでも最外一辺倒にはしない。5〜6枠が相対的に良い。",
    ],
    gate: { mode: "mid_outer" },
    frontBias: true,
    scoreInGate: true,
  },
  "ダート:2000": {
    summary: "芝スタート。好位。逃げ切りは楽ではない。",
    bullets: [
      "芝スタートで位置を取りやすい。",
      "4角を前で回れる馬が安定。外枠は悪くない。",
    ],
    gate: { mode: "outer", boost: 1 },
    frontBias: false,
    scoreInGate: true,
  },
};

/** @type {Record<string, object>} */
const NAKAYAMA = {
  generic: {
    summary: "右回り。高低差5.3mは全場最大。直線は短くゴール前に急坂。",
    bullets: [
      "芝は内回り（1800・2000・2500）と外回り（1200・1600・2200）。直線はどちらも310m。",
      "ゴール前は高低差2.2m・最大勾配2.24%の急坂。東京の瞬発力勝負とは別物。",
      "ダートも高低差4.5mで急坂あり。1200のみ芝スタート。",
    ],
    gate: { mode: "none" },
    frontBias: false,
    scoreInGate: false,
  },
  "芝:1200": {
    summary: "外回り。向正面の下り。前と内枠。",
    bullets: [
      "2角奥スタート。下りを使って3〜4角へ。最初のコーナーまで約275m。",
      "序盤が速くなりやすい。逃げ・先行と内枠が残りやすい。",
      "直線310mに急坂。平坦のスピードだけでは押し切れない。",
    ],
    gate: { mode: "inner", boost: 3 },
    frontBias: true,
    scoreInGate: true,
  },
  "芝:1600": {
    summary: "外回りマイル。1角ポケット。内枠と好位。",
    bullets: [
      "1角横のポケット発走。最初のコーナーまで約240mと短い。",
      "外枠は内に入れるまでロスが出やすい。内で位置を取れる馬。",
      "東京・阪神マイルより直線が短い。後方一辺倒の差しは軸にしない。",
    ],
    gate: { mode: "inner", boost: 2 },
    frontBias: true,
    scoreInGate: true,
  },
  "芝:1800": {
    summary: "内回り。スタート直後が急坂。内枠の逃げ・先行。",
    bullets: [
      "スタンド前半ばから発走。直後に急坂、最初のコーナーまで約205m。",
      "序盤が緩みやすい。内枠の逃げ・先行がロスなく先行できる。",
      "直線310m。外から被せると消耗しやすい。",
    ],
    gate: { mode: "inner", boost: 3 },
    frontBias: true,
    scoreInGate: true,
  },
  "芝:2000": {
    summary: "内回り（皐月賞）。1角まで長く、好位。枠差は小さい。",
    bullets: [
      "1800のスタートより約200m後ろ。最初のコーナーまで約405m。",
      "外枠も先行争いに加わりやすい。差し一辺倒にはしない。",
      "直線は短く急坂あり。4角である程度前にいる馬。",
    ],
    gate: { mode: "none" },
    frontBias: false,
    scoreInGate: false,
  },
  "芝:2200": {
    summary: "外回り。スタートは2000に近いが内回りではない。",
    bullets: [
      "4角出口付近から発走。最初のコーナーまで約432m。2000は内回り、こちらは外回り。",
      "カーブが緩くスピードに乗りやすい。枠の偏りは小さい。",
      "直線は短いので後方一気は弱い。極端なスローでは前も残る。",
    ],
    gate: { mode: "none" },
    frontBias: false,
    scoreInGate: false,
  },
  "芝:2500": {
    summary: "内回り（有馬記念）。ポケット発走。タフで総合力。",
    bullets: [
      "3角手前の外回り上から発走し内回りへ。最初のコーナーまで約192m。",
      "アップダウンが多く、向正面の下りでペースが上がりやすい。",
      "直線が短いので位置取りも要る。初出走・2600未経験だけでは拾わない。",
    ],
    gate: { mode: "none" },
    frontBias: false,
    scoreInGate: false,
  },
  "ダート:1200": {
    summary: "芝スタート。外枠・前。",
    bullets: [
      "向正面の芝から発走しダートへ。外側ほど芝が長い。",
      "下りでテンが速くなりやすい。外枠の逃げ・先行が残りやすい。",
      "直線308mに急坂。内枠は砂を被りやすい。",
    ],
    gate: { mode: "outer", boost: 3 },
    frontBias: true,
    scoreInGate: true,
  },
  "ダート:1800": {
    summary: "スタート後に坂。4角前が強い。所属では分けない。",
    bullets: [
      "スタート後が上り。ゴール前にも急坂。砂が深いと時計がかかる。",
      "4角で前にいる馬が安定。後方からの差しは届きにくい。",
      "枠の偏りは距離ほど強くない。関西馬という理由だけでは拾わない。",
    ],
    gate: { mode: "none" },
    frontBias: true,
    scoreInGate: false,
  },
  "ダート:2400": {
    summary: "施行が少ない長距離ダート。サンプルは薄い。",
    bullets: [
      "高低差と急坂がありスタミナが要る。年間の施行は少ない。",
      "初出走やクラス落ちだけでは拾わない。",
    ],
    gate: { mode: "none" },
    frontBias: false,
    scoreInGate: false,
  },
};

/** @type {Record<string, object>} */
const SAPPORO = {
  generic: {
    summary: "右回り。高低差0.7mは全場最小。円に近い形で直線266m。函館とは別物。",
    bullets: [
      "芝一周1641m（A）なのに直線266m。函館262mに次ぐ短さ。コーナーが多く後方一気は苦戦。捲りは他場より多い。",
      "ほぼ平坦。函館は高低差3.5mの起伏があるので、同じ北海道でも要求が違う。",
      "オール洋芝。水はけは函館より良く、重は稀。開催が進むと内が傷みやすい。",
    ],
    gate: { mode: "none" },
    frontBias: false,
    scoreInGate: false,
  },
  "芝:1200": {
    summary: "2角ポケット。直線が短く前が残りやすい。",
    bullets: [
      "2角奥からワンターン。最初のコーナーまで約400m。",
      "逃げ・先行が残りやすい。函館1200ほど極端ではないが、差し追い込み一辺倒にはしない。",
      "直線266m。後方一気は届きにくい。",
    ],
    gate: { mode: "none" },
    frontBias: true,
    scoreInGate: false,
  },
  "芝:1500": {
    summary: "JRA唯一の1500。すぐ2角。逃げ・先行。",
    bullets: [
      "1角奥ポケット。最初のコーナーまで約170m。",
      "逃げ・先行が残りやすい。形状上は内が位置を取りやすいが、枠差は距離ほど強くない。",
      "直線が短い。後方一辺倒の差しは軸にしない。",
    ],
    gate: { mode: "none" },
    frontBias: true,
    scoreInGate: false,
  },
  "芝:1800": {
    summary: "スタンド前発走。1角まで短く、前と内枠。",
    bullets: [
      "ホームストレッチ半ばから。最初のコーナーまで約180m。",
      "序盤が緩みやすい。内枠の逃げ・先行がロスなく先行できる。",
      "直線266m。後方一気は弱い。函館転戦だけでは拾わない。",
    ],
    gate: { mode: "inner", boost: 2 },
    frontBias: true,
    scoreInGate: true,
  },
  "芝:2000": {
    summary: "1800より1角まで長く、好位。差し一辺倒ではない。",
    bullets: [
      "4角奥ポケット。最初のコーナーまで約380m（1800より約200m長い）。",
      "外枠も先行争いに加わりやすい。逃げ複勝は1800より落ちるが、差し最有利にはならない。",
      "直線は短い。4角である程度前にいる馬。後方一気は弱い。",
    ],
    gate: { mode: "none" },
    frontBias: false,
    scoreInGate: false,
  },
  "芝:2600": {
    summary: "施行が少ない長距離。サンプルは薄い。",
    bullets: [
      "向正面から発走しコーナーは6回。洋芝を長く走る。",
      "直線は短く位置取りも要る。初出走・2600未経験だけでは拾わない。",
    ],
    gate: { mode: "none" },
    frontBias: false,
    scoreInGate: false,
  },
  "ダート:1000": {
    summary: "外枠・前。砂を被らず外から行ける。",
    bullets: [
      "向正面からワンターン。最初のコーナーまで約280m。",
      "砂が軽く、外枠の逃げ・先行が残りやすい。内枠は被されやすい。",
      "函館ダ1000ほど逃げ一辺倒ではないが、後方一気は弱い。",
    ],
    gate: { mode: "outer", boost: 3 },
    frontBias: true,
    scoreInGate: true,
  },
  "ダート:1700": {
    summary: "大回りの1700。先行と捲り。差し一辺倒ではない。",
    bullets: [
      "一周1487mはローカルダートで中京に次ぐ。コーナーは緩い。",
      "先行が厚い。後方一気より、早めに動く捲りの方が決まりやすい。",
      "枠の偏りは距離ほど強くない。関西馬・東京ダート経験だけでは拾わない。",
    ],
    gate: { mode: "none" },
    frontBias: true,
    scoreInGate: false,
  },
  "ダート:2400": {
    summary: "施行が少ない長距離ダート。サンプルは薄い。",
    bullets: [
      "平坦でも距離がありスタミナが要る。年間の施行は少ない。",
      "初出走やクラス落ちだけでは拾わない。",
    ],
    gate: { mode: "none" },
    frontBias: false,
    scoreInGate: false,
  },
};

const COURSES = {
  阪神: HANSHIN,
  中山: NAKAYAMA,
  札幌: SAPPORO,
};

/**
 * @returns {null | {
 *   venue: string,
 *   track: string,
 *   meters: number | null,
 *   summary: string,
 *   bullets: string[],
 *   gate: { mode: string, boost?: number },
 *   frontBias: boolean,
 *   scoreInGate: boolean,
 * }}
 */
export function courseProfile(venue, track, distance) {
  const v = normalizeVenue(venue);
  const table = COURSES[v];
  if (!table) return null;
  const meters = parseDistanceMeters(distance);
  const key = distanceKey(track, meters);
  const row = table[key] ?? table.generic;
  return {
    venue: v,
    track: track === "ダート" ? "ダート" : "芝",
    meters,
    summary: row.summary,
    bullets: row.bullets,
    gate: row.gate,
    frontBias: Boolean(row.frontBias),
    scoreInGate: Boolean(row.scoreInGate),
  };
}

export function courseNoteLines(venue, track, distance) {
  const p = courseProfile(venue, track, distance);
  return p ? p.bullets : [];
}

function genericFavored(track, bracket) {
  return track === "ダート" ? bracket >= 6 : bracket <= 3;
}

function courseFavored(gate, bracket) {
  if (!gate || gate.mode === "none" || gate.mode === "flatten") return null;
  if (gate.mode === "inner") return bracket <= 3;
  if (gate.mode === "outer") return bracket >= 7;
  if (gate.mode === "mid_outer") return bracket >= 5 && bracket <= 6;
  return null;
}

/**
 * 汎用ルール（芝=内 / ダート=外）からの差分。±GATE_OVERLAY_MAX に制限。
 * 該当コースでなければ 0。
 */
export function gateOverlayDelta(track, bracket, venue, distance) {
  if (bracket == null || !Number.isFinite(Number(bracket))) return 0;
  const b = Number(bracket);
  const p = courseProfile(venue, track, distance);
  if (!p?.scoreInGate) return 0;

  const base = genericFavored(track, b) ? 62 : 54;
  let target = base;
  if (p.gate.mode === "flatten") {
    target = 56;
  } else {
    const fav = courseFavored(p.gate, b);
    if (fav === true) target = 62 + (p.gate.boost ?? 0);
    else if (fav === false) target = 54 - Math.min(2, p.gate.boost ?? 0);
  }
  const raw = target - base;
  return Math.max(-GATE_OVERLAY_MAX, Math.min(GATE_OVERLAY_MAX, raw));
}

/** 新潟芝は従来どおり全距離。阪神・中山・札幌は距離付きの frontBias だけ。 */
export function isFrontBiasedCourse(venue, track, distance) {
  if (track === "芝" && normalizeVenue(venue).includes("新潟")) return true;
  return Boolean(courseProfile(venue, track, distance)?.frontBias);
}
