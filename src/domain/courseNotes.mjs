/**
 * 検証済みコース参考（当面は阪神）。
 * UI の説明と、枠バイアスの小さな補正の単一ソース。
 * courseFit / paceFit には載せない（馬ごとの同条件・脚質データではないため）。
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

function hanshinKey(track, meters) {
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
  if (normalizeVenue(venue) !== "阪神") return null;
  const meters = parseDistanceMeters(distance);
  const key = hanshinKey(track, meters);
  const row = HANSHIN[key] ?? HANSHIN.generic;
  return {
    venue: "阪神",
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

/** 新潟芝は従来どおり全距離。阪神は距離付きの frontBias だけ。 */
export function isFrontBiasedCourse(venue, track, distance) {
  if (track === "芝" && normalizeVenue(venue).includes("新潟")) return true;
  return Boolean(courseProfile(venue, track, distance)?.frontBias);
}
