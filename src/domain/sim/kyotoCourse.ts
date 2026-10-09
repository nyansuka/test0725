import { asRaw, assembleFlat, spanOf, withSpan } from "@/domain/sim/flatPath";

/**
 * 京都の平地テンプレート。障害コースは入れない。
 * Aコース（芝内1782.8m・直線328.4m、芝外1894.3m・直線403.7m、ダート1607.6m・直線329.1m）。
 * 発走は、その距離をゴールからコースに沿って戻した位置。
 * ゴールから1角までを105mにし、芝3000の3角までが208mになる。
 * 外回りは3角で分かれ、4角の出口で内回りに戻る。坂は3〜4角。ゴール前は平坦。
 * 芝1600（内・外）と芝1800は、2角の奥へまっすぐ伸ばした引き込み。
 * 芝1800の走行は、その引き込みの端から。本線をゴールから戻した位置には置かない。
 * ダート1400だけ芝スタート。
 */

export type SimTrack = "芝" | "ダート";

export type KyotoTemplate = {
  id: string;
  track: SimTrack;
  meters: number;
  badge: string;
  course: string;
  place: string;
  summary: string;
  bullets: string[];
  lap: number;
  rail: "inner" | "outer" | "dirt";
};

const INNER_LAP = 1782.8;
const OUTER_LAP = 1894.3;
const DIRT_LAP = 1607.6;
const INNER_STRAIGHT = 328.4;
const OUTER_STRAIGHT = 403.7;
const DIRT_STRAIGHT = 329.1;
/** ゴールから1角入口。芝3000の3角が208mになる */
const FINISH_TO_CORNER = 105;
const DIRT_FINISH_TO_CORNER = 90;
const HOME = INNER_STRAIGHT + FINISH_TO_CORNER;
const DIRT_HOME = DIRT_STRAIGHT + DIRT_FINISH_TO_CORNER;

const SCALE = 0.46;
const PAD = 78;

type Pt = { x: number; y: number };
type Sample = Pt & { m: number; ix: number; iy: number };
type ScreenPt = { x: number; y: number; m: number; ox: number; oy: number };

type Built = {
  inner: Sample[];
  outer: Sample[];
  dirt: Sample[];
  corner3M: number;
  backJoinM: number;
  outerSplitM: number;
  outerJoinM: number;
  chute1600Inner: number;
  chute1600Outer: number;
  chute1800: number;
  dirt1400Join: number;
  dirt1400Len: number;
  innerCornerM: { c1: number; c2: number; c3: number; c4: number };
  outerCornerM: { c3: number; c4: number };
  dirtCornerM: { c1: number; c2: number; c3: number; c4: number };
  innerR: number;
};

function hypot(dx: number, dy: number) {
  return Math.hypot(dx, dy);
}

function pushLine(out: Pt[], a: Pt, b: Pt, step = 8) {
  const len = hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.round(len / step));
  const start = out.length > 0 ? 1 : 0;
  for (let i = start; i <= n; i += 1) {
    const t = i / n;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
}

function pushArc(out: Pt[], cx: number, cy: number, r: number, a0: number, sweep: number, step = 8) {
  const len = Math.abs(r * sweep);
  const n = Math.max(8, Math.round(len / step));
  const start = out.length > 0 ? 1 : 0;
  for (let i = start; i <= n; i += 1) {
    const a = a0 - sweep * (i / n);
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
}

function withMeters(pts: Pt[], target: number): Sample[] {
  const raw: Sample[] = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i += 1) {
    if (i > 0) acc += hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    raw.push({ ...pts[i], m: acc, ix: 0, iy: 0 });
  }
  const measured = raw[raw.length - 1]?.m || 1;
  const scale = target / measured;
  for (const p of raw) p.m *= scale;
  for (let i = 0; i < raw.length; i += 1) {
    const prev = raw[Math.max(0, i - 1)];
    const next = raw[Math.min(raw.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const v = hypot(tx, ty) || 1;
    raw[i].ix = ty / v;
    raw[i].iy = -tx / v;
  }
  return raw;
}

function polyLen(pts: Pt[]) {
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) len += hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

/** 3〜4角。中心を右へずらし、長さが外回り一周に合うまで外へ膨らませる */
function wideTurn(r: number, endX: number, target: number): Pt[] {
  const sample = (bulge: number) => {
    const n = 96;
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      const ang = Math.PI / 2 - Math.PI * t;
      const rad = r + bulge * Math.sin(Math.PI * t);
      pts.push({
        x: endX * t + rad * Math.cos(ang),
        y: r + rad * Math.sin(ang),
      });
    }
    return pts;
  };
  if (polyLen(sample(0)) > target + 1) throw new Error("外回りの3〜4角が長すぎる");
  let lo = 0;
  let hi = 60;
  if (polyLen(sample(hi)) < target) throw new Error("外回りの3〜4角が届かない");
  for (let i = 0; i < 28; i += 1) {
    const mid = (lo + hi) / 2;
    if (polyLen(sample(mid)) > target) hi = mid;
    else lo = mid;
  }
  return sample((lo + hi) / 2);
}

function buildGeometry(): Built {
  const remain = INNER_LAP - 2 * HOME;
  const semi = remain / 2;
  const r = semi / Math.PI;
  const finish: Pt = { x: -INNER_STRAIGHT, y: 0 };
  const c1: Pt = { x: -HOME, y: 0 };
  const back0: Pt = { x: -HOME, y: 2 * r };
  const back1: Pt = { x: 0, y: 2 * r };
  const c4out: Pt = { x: 0, y: 0 };

  const innerPts: Pt[] = [];
  pushLine(innerPts, finish, c1);
  pushArc(innerPts, c1.x, r, r, -Math.PI / 2, Math.PI);
  pushLine(innerPts, back0, back1);
  pushArc(innerPts, 0, r, r, Math.PI / 2, Math.PI);
  pushLine(innerPts, c4out, finish);
  const inner = withMeters(innerPts, INNER_LAP);

  const corner3M = FINISH_TO_CORNER + semi + HOME;
  const backJoinM = FINISH_TO_CORNER + semi;
  const endX = OUTER_STRAIGHT - INNER_STRAIGHT;
  const turnLen = OUTER_LAP - corner3M - OUTER_STRAIGHT;
  const turn = wideTurn(r, endX, turnLen);
  const outerPts: Pt[] = [];
  for (const p of inner) {
    if (p.m >= corner3M - 0.05) break;
    outerPts.push({ x: p.x, y: p.y });
  }
  outerPts.push(back1);
  for (let i = 1; i < turn.length; i += 1) outerPts.push(turn[i]);
  pushLine(outerPts, { x: endX, y: 0 }, finish);
  const outer = withMeters(outerPts, OUTER_LAP);

  const dirtY = 22;
  const dirtSemi = (DIRT_LAP - 2 * DIRT_HOME) / 2;
  const rd = dirtSemi / Math.PI;
  const dC4: Pt = { x: -8, y: dirtY };
  const dFinish: Pt = { x: dC4.x - DIRT_STRAIGHT, y: dirtY };
  const dC1: Pt = { x: dC4.x - DIRT_HOME, y: dirtY };
  const dBack0: Pt = { x: dC1.x, y: dirtY + 2 * rd };
  const dBack1: Pt = { x: dC4.x, y: dirtY + 2 * rd };
  const dirtPts: Pt[] = [];
  pushLine(dirtPts, dFinish, dC1);
  pushArc(dirtPts, dC1.x, dirtY + rd, rd, -Math.PI / 2, Math.PI);
  pushLine(dirtPts, dBack0, dBack1);
  pushArc(dirtPts, dC4.x, dirtY + rd, rd, Math.PI / 2, Math.PI);
  pushLine(dirtPts, dC4, dFinish);
  const dirt = withMeters(dirtPts, DIRT_LAP);

  const dirt1400Len = 150;
  const dirtToCorner = DIRT_FINISH_TO_CORNER;
  const dirtBack0m = dirtToCorner + dirtSemi;

  return {
    inner,
    outer,
    dirt,
    corner3M,
    backJoinM,
    outerSplitM: nearestM(outer, back1),
    outerJoinM: nearestM(outer, c4out),
    chute1600Inner: 1600 - (INNER_LAP - backJoinM),
    chute1600Outer: 1600 - (OUTER_LAP - backJoinM),
    chute1800: 1800 - (OUTER_LAP - backJoinM),
    dirt1400Join: dirt1400Len + (DIRT_LAP - 1400),
    dirt1400Len,
    innerCornerM: {
      c1: FINISH_TO_CORNER + semi * 0.35,
      c2: FINISH_TO_CORNER + semi * 0.72,
      c3: corner3M + semi * 0.22,
      c4: corner3M + semi * 0.72,
    },
    outerCornerM: {
      c3: corner3M + 70,
      c4: OUTER_LAP - OUTER_STRAIGHT,
    },
    dirtCornerM: {
      c1: dirtToCorner + dirtSemi * 0.35,
      c2: dirtToCorner + dirtSemi * 0.72,
      c3: dirtBack0m + DIRT_HOME + dirtSemi * 0.28,
      c4: dirtBack0m + DIRT_HOME + dirtSemi * 0.72,
    },
    innerR: r,
  };
}

function sampleAt(samples: Sample[], meter: number): Sample {
  const m = Math.max(0, Math.min(samples[samples.length - 1].m, meter));
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].m < m) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const t = b.m === a.m ? 0 : (m - a.m) / (b.m - a.m);
  return {
    m,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    ix: a.ix + (b.ix - a.ix) * t,
    iy: a.iy + (b.iy - a.iy) * t,
  };
}

function nearestM(samples: Sample[], pt: Pt) {
  let best = samples[0];
  let bestD = Infinity;
  for (const p of samples) {
    const d = hypot(p.x - pt.x, p.y - pt.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best.m;
}

function slice(samples: Sample[], m0: number, m1: number): Sample[] {
  if (m1 <= m0 + 0.5) return [];
  const out: Sample[] = [sampleAt(samples, m0)];
  for (const p of samples) {
    if (p.m > m0 + 0.4 && p.m < m1 - 0.4) out.push(p);
  }
  out.push(sampleAt(samples, m1));
  return out;
}

function chute(samples: Sample[], joinM: number, length: number, side: number): Sample[] {
  const n = Math.max(8, Math.round(length / 8));
  const pts: Sample[] = [];
  for (let i = 0; i <= n; i += 1) {
    const back = length * (1 - i / n);
    const rail = sampleAt(samples, joinM - back);
    const out = side * (back / length);
    pts.push({
      m: i,
      x: rail.x - rail.ix * out,
      y: rail.y - rail.iy * out,
      ix: rail.ix,
      iy: rail.iy,
    });
  }
  return pts;
}

/** 向正面を2角の奥へまっすぐ伸ばす */
function backChute(join: Sample, length: number): Sample[] {
  const n = Math.max(8, Math.round(length / 8));
  const pts: Sample[] = [];
  for (let i = 0; i <= n; i += 1) {
    const back = length * (1 - i / n);
    pts.push({
      m: i,
      x: join.x - back,
      y: join.y,
      ix: join.ix,
      iy: join.iy,
    });
  }
  return pts;
}

function station(lap: number, meters: number) {
  const rem = meters % lap;
  if (rem < 0.05) return 0;
  return lap - rem;
}

const GEOM = buildGeometry();

function lapPhrase(meters: number, lap: number) {
  if (meters + 0.05 < lap) return "ワンターン";
  const n = Math.floor((meters + 0.05) / lap);
  const rem = Math.round(meters - n * lap);
  if (rem <= 0) return `${n}周`;
  return `${n}周と${rem}m`;
}

export const KYOTO_TEMPLATES: KyotoTemplate[] = [
  {
    id: "turf-1100",
    track: "芝",
    meters: 1100,
    badge: "内",
    course: "内回り",
    place: "向正面",
    summary: "内回りの短距離。直線は平坦。",
    bullets: [
      "向正面から内回りの3〜4角へ。直線は328.4m。",
      "坂は3〜4角にあり、ゴール前は平坦。",
    ],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-1200",
    track: "芝",
    meters: 1200,
    badge: "内",
    course: "内回り",
    place: "2角の出口",
    summary: "内回り。向正面に入ってすぐ。",
    bullets: [
      "2角を出て向正面へ。1100の100m手前。",
      "3〜4角の坂を下り、平坦な直線328.4m。",
    ],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-1400",
    track: "芝",
    meters: 1400,
    badge: "内",
    course: "内回り",
    place: "1〜2角のあいだ",
    summary: "内回りの1400。外回り1400とは別。",
    bullets: [
      "1〜2角の途中から内回り。直線は328.4m。",
      "外回り1400の直線の長さを、この距離には使わない。",
    ],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-1400-outer",
    track: "芝",
    meters: 1400,
    badge: "外",
    course: "外回り",
    place: "2角の手前",
    summary: "外回りの1400。直線は403.7m。",
    bullets: [
      "2角の手前から、外回りの3〜4角を回る。",
      "直線は403.7m。坂は3〜4角で、ゴール前は平坦。",
    ],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-1600",
    track: "芝",
    meters: 1600,
    badge: "内",
    course: "内回り",
    place: "2角奥の引き込み",
    summary: "内回りマイル。引き込みが長い。",
    bullets: [
      "2角の奥の引き込みから。3角まで約810m。",
      "外回り1600より引き込みが長い。直線は328.4m。",
    ],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-1600-outer",
    track: "芝",
    meters: 1600,
    badge: "外",
    course: "外回り",
    place: "2角奥の引き込み",
    summary: "外回りマイル。引き込みから3〜4角の外。",
    bullets: [
      "2角の奥の引き込みから。3角まで約700m。",
      "1800は同じ引き込みの200m奥。直線は403.7m。",
    ],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-1800",
    track: "芝",
    meters: 1800,
    badge: "外",
    course: "外回り",
    place: "引き込みのいちばん奥",
    summary: "外回り。最初のコーナーまで長い。",
    bullets: [
      "外回り1600の200m奥、引き込みの端から。3角まで約900m。",
      "助走が長い。直線は403.7m。坂は3〜4角。",
    ],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-2000",
    track: "芝",
    meters: 2000,
    badge: "内",
    course: "内回り",
    place: "直線の途中",
    summary: "内回りの2000。外回り2000とは発走が違う。",
    bullets: [
      "内回りの直線途中から。ゴールまで約217m。",
      "外回り2000はこれよりゴールに近い。直線は328.4m。",
    ],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-2000-outer",
    track: "芝",
    meters: 2000,
    badge: "外",
    course: "外回り",
    place: "ゴール前の直線",
    summary: "外回りの2000。内回りよりゴールに近い。",
    bullets: [
      "外回りの直線、ゴールの約106m手前から。",
      "内回り2000の発走とは別地点。直線は403.7m。",
    ],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-2200",
    track: "芝",
    meters: 2200,
    badge: "外",
    course: "外回り",
    place: "4角を出てすぐ",
    summary: "外回り。4角の出口付近。",
    bullets: [
      "4角を出て約100mの地点から。直線は403.7m。",
      "坂は3〜4角を2回。ゴール前は平坦。",
    ],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-2400",
    track: "芝",
    meters: 2400,
    badge: "外",
    course: "外回り",
    place: "4角の途中",
    summary: "外回り。4角に入ってから。",
    bullets: [
      "外回りの4角の途中から1周あまり。直線は403.7m。",
      "坂は3〜4角。最後の直線は平坦。",
    ],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-3000",
    track: "芝",
    meters: 3000,
    badge: "外",
    course: "外回り",
    place: "3角の手前",
    summary: "外回り（菊花賞）。3角まで208m。",
    bullets: [
      "向正面の3角手前から。最初のコーナーまで208m。",
      "3〜4角の坂を2回。直線は403.7mで平坦。",
    ],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-3200",
    track: "芝",
    meters: 3200,
    badge: "外",
    course: "外回り",
    place: "向正面の入口",
    summary: "外回り（天皇賞春）。3000の200m手前。",
    bullets: [
      "向正面に入ってすぐ。3角まで約410m。3000とは200m離れる。",
      "坂を2回通り、直線403.7mは平坦。",
    ],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "dirt-1000",
    track: "ダート",
    meters: 1000,
    badge: "ダ",
    course: "ダート",
    place: "向正面",
    summary: "ダートの短距離。",
    bullets: ["向正面から。直線は329.1m。", "坂は3角側。ゴール前は平坦。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1100",
    track: "ダート",
    meters: 1100,
    badge: "ダ",
    course: "ダート",
    place: "2角の出口",
    summary: "ダートの短距離。",
    bullets: ["2角を出て向正面へ。直線は329.1m。", "3角の坂を下って平坦な直線。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1200",
    track: "ダート",
    meters: 1200,
    badge: "ダ",
    course: "ダート",
    place: "2角の手前",
    summary: "ワンターン。3角の坂へ向かう。",
    bullets: ["2角の手前から。3角の上りを回る。", "直線は329.1mで平坦。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1400",
    track: "ダート",
    meters: 1400,
    badge: "芝発",
    course: "芝スタート",
    place: "芝からダートへ",
    summary: "ダート1400だけ芝スタート。",
    bullets: ["芝を踏んでからダートに入る。他のダート距離はダート発走。", "直線は329.1m。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1800",
    track: "ダート",
    meters: 1800,
    badge: "ダ",
    course: "ダート",
    place: "直線の途中",
    summary: "直線の途中から1周あまり。",
    bullets: ["直線の途中から。1900はこの100m手前。", "直線は329.1m。坂は3角側。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1900",
    track: "ダート",
    meters: 1900,
    badge: "ダ",
    course: "ダート",
    place: "4角を出てすぐ",
    summary: "1800の100m手前。",
    bullets: ["4角を出てすぐ。1800より100m長い。", "直線は329.1m。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-2600",
    track: "ダート",
    meters: 2600,
    badge: "ダ",
    course: "ダート",
    place: "向正面",
    summary: "長距離ダート。施行は少ない。",
    bullets: ["向正面から1周あまり。直線は329.1m。", "距離のサンプルは薄い。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
];

export function kyotoTemplate(id: string) {
  return KYOTO_TEMPLATES.find((item) => item.id === id) ?? KYOTO_TEMPLATES[0];
}

export type MapLabel = { x: number; y: number; text: string };
export type MapLine = { x1: number; y1: number; x2: number; y2: number };

export type KyotoMap = {
  viewBox: string;
  innerD: string;
  outerD: string;
  dirtD: string;
  used: string[];
  hillD: string;
  labels: MapLabel[];
  start: MapLine;
  finish: MapLine;
  title: string;
};

function toScreen(p: Pt) {
  return { x: p.x * SCALE, y: -p.y * SCALE };
}

function screenSamples(samples: Sample[], shift: Pt): ScreenPt[] {
  return samples.map((p) => {
    const s = toScreen(p);
    const ox = -p.ix;
    const oy = p.iy;
    const v = hypot(ox, oy) || 1;
    return { m: p.m, x: s.x + shift.x, y: s.y + shift.y, ox: ox / v, oy: oy / v };
  });
}

function pathD(pts: { x: number; y: number }[]) {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

function shiftFor(groups: Sample[][]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const group of groups) {
    for (const p of group) {
      const s = toScreen(p);
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x);
      maxY = Math.max(maxY, s.y);
    }
  }
  return {
    shift: { x: PAD - minX, y: PAD - minY },
    viewBox: `0 0 ${(maxX - minX + PAD * 2).toFixed(1)} ${(maxY - minY + PAD * 2).toFixed(1)}`,
  };
}

const FIT = shiftFor([
  GEOM.inner,
  GEOM.outer,
  GEOM.dirt,
  backChute(sampleAt(GEOM.outer, GEOM.backJoinM), GEOM.chute1800),
  chute(GEOM.dirt, GEOM.dirt1400Join, GEOM.dirt1400Len, 36),
]);

function turfChute(id: string): { join: number; len: number; rail: Sample[] } | null {
  const g = GEOM;
  if (id === "turf-1600") return { join: g.backJoinM, len: g.chute1600Inner, rail: g.inner };
  if (id === "turf-1600-outer") return { join: g.backJoinM, len: g.chute1600Outer, rail: g.outer };
  if (id === "turf-1800") return { join: g.backJoinM, len: g.chute1800, rail: g.outer };
  return null;
}

function usedMeterPaths(template: KyotoTemplate): Sample[][] {
  const g = GEOM;
  const pocket = turfChute(template.id);
  if (pocket) {
    return [backChute(sampleAt(pocket.rail, pocket.join), pocket.len), slice(pocket.rail, pocket.join, pocket.rail.at(-1)!.m)];
  }
  if (template.id === "dirt-1400") {
    return [chute(g.dirt, g.dirt1400Join, g.dirt1400Len, 36), slice(g.dirt, g.dirt1400Join, DIRT_LAP)];
  }
  const rail = template.rail === "outer" ? g.outer : template.rail === "dirt" ? g.dirt : g.inner;
  const lap = rail[rail.length - 1].m;
  if (template.meters + 0.05 >= lap) return [rail];
  return [slice(rail, station(lap, template.meters), lap)];
}

function startSample(template: KyotoTemplate): Sample {
  const g = GEOM;
  const pocket = turfChute(template.id);
  if (pocket) return backChute(sampleAt(pocket.rail, pocket.join), pocket.len)[0];
  if (template.id === "dirt-1400") return chute(g.dirt, g.dirt1400Join, g.dirt1400Len, 36)[0];
  const rail = template.rail === "outer" ? g.outer : template.rail === "dirt" ? g.dirt : g.inner;
  return sampleAt(rail, station(rail[rail.length - 1].m, template.meters));
}

function finishSample(template: KyotoTemplate): Sample {
  if (template.track === "ダート") return sampleAt(GEOM.dirt, DIRT_LAP);
  return sampleAt(GEOM.inner, INNER_LAP);
}

function screenAt(samples: ScreenPt[], meter: number): ScreenPt {
  const m = Math.max(samples[0].m, Math.min(samples[samples.length - 1].m, meter));
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].m < m) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const t = b.m === a.m ? 0 : (m - a.m) / (b.m - a.m);
  return {
    m,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    ox: a.ox + (b.ox - a.ox) * t,
    oy: a.oy + (b.oy - a.oy) * t,
  };
}

function cornerLabels(template: KyotoTemplate, view: { inner: ScreenPt[]; outer: ScreenPt[]; dirt: ScreenPt[] }): MapLabel[] {
  const g = GEOM;
  const labels: MapLabel[] = [];
  const put = (samples: ScreenPt[], meter: number, text: string) => {
    const p = screenAt(samples, meter);
    labels.push({ x: p.x + p.ox * 22, y: p.y + p.oy * 22, text });
  };
  if (template.track === "ダート") {
    const { c1, c2, c3, c4 } = g.dirtCornerM;
    put(view.dirt, c1, "1角");
    put(view.dirt, c2, "2角");
    put(view.dirt, c3, "3角");
    put(view.dirt, c4, "4角");
    return labels;
  }
  const { c1, c2, c3, c4 } = g.innerCornerM;
  put(view.inner, c1, "1角");
  put(view.inner, c2, "2角");
  if (template.rail === "outer") {
    put(view.outer, g.outerCornerM.c3, "3角");
    put(view.outer, g.outerCornerM.c4, "4角");
  } else {
    put(view.inner, c3, "3角");
    put(view.inner, c4, "4角");
  }
  return labels;
}

function bar(p: { x: number; y: number; ox: number; oy: number }, half: number): MapLine {
  return {
    x1: p.x + p.ox * half,
    y1: p.y + p.oy * half,
    x2: p.x - p.ox * half,
    y2: p.y - p.oy * half,
  };
}

let cachedScreens: { inner: ScreenPt[]; outer: ScreenPt[]; dirt: ScreenPt[]; viewBox: string } | null = null;

function screens() {
  if (cachedScreens) return cachedScreens;
  cachedScreens = {
    inner: screenSamples(GEOM.inner, FIT.shift),
    outer: screenSamples(GEOM.outer, FIT.shift),
    dirt: screenSamples(GEOM.dirt, FIT.shift),
    viewBox: FIT.viewBox,
  };
  return cachedScreens;
}

function sliceScreen(samples: ScreenPt[], m0: number, m1: number) {
  const out: ScreenPt[] = [];
  for (const p of samples) {
    if (p.m >= m0 - 0.5 && p.m <= m1 + 0.5) out.push(p);
  }
  return out;
}

export function presentKyoto(id: string): KyotoMap {
  const template = kyotoTemplate(id);
  const view = screens();
  const used = usedMeterPaths(template).map((pts) => pathD(screenSamples(pts, FIT.shift)));
  const hillRail = template.track === "ダート" ? GEOM.dirt : template.rail === "outer" ? GEOM.outer : GEOM.inner;
  const hillView = template.track === "ダート" ? view.dirt : template.rail === "outer" ? view.outer : view.inner;
  const hillFrom = template.track === "ダート" ? GEOM.dirtCornerM.c3 - 40 : GEOM.corner3M;
  const hillD = pathD(screenSamples(slice(hillRail, hillFrom, hillFrom + 180), FIT.shift));
  const startS = screenSamples([startSample(template)], FIT.shift)[0];
  const finishS = screenSamples([finishSample(template)], FIT.shift)[0];
  const hillAt = screenAt(hillView, hillFrom + 80);
  const labels = [
    ...cornerLabels(template, view),
    { x: startS.x + startS.ox * 26, y: startS.y + startS.oy * 26, text: "発走" },
    { x: finishS.x + finishS.ox * 26, y: finishS.y + finishS.oy * 26, text: "ゴール" },
    { x: hillAt.x + hillAt.ox * 22, y: hillAt.y + hillAt.oy * 22, text: "坂" },
  ];
  return {
    viewBox: view.viewBox,
    innerD: pathD(view.inner),
    outerD: pathD(sliceScreen(view.outer, GEOM.outerSplitM, GEOM.outerJoinM)),
    dirtD: pathD(view.dirt),
    used,
    hillD,
    labels,
    start: bar(startS, 14),
    finish: bar(finishS, 16),
    title: `${template.track}${template.meters} ${template.course}`,
  };
}

export function kyotoRunPhrase(template: KyotoTemplate) {
  if (template.id === "dirt-1400") return "芝スタート";
  if (template.id === "turf-1600" || template.id === "turf-1600-outer" || template.id === "turf-1800") return "引き込み";
  return lapPhrase(template.meters, template.lap);
}

export function kyotoStraight(template: KyotoTemplate) {
  if (template.track === "ダート") return "329.1m";
  if (template.rail === "outer") return "403.7m";
  return "328.4m";
}

function projectPoint(p: { x: number; y: number; ix: number; iy: number }, m: number) {
  return { m, x: p.x, y: p.y, ix: p.ix, iy: p.iy };
}

/** 引き込みの端のさらに後ろ。本線には載せない */
function backApproach(join: Sample, length: number, back = 160) {
  const n = Math.max(8, Math.round(back / 8));
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const behind = back * (1 - i / n);
    pts.push(
      projectPoint(
        { x: join.x - length - behind, y: join.y, ix: join.ix, iy: join.iy },
        (i / n) * back,
      ),
    );
  }
  return pts;
}

/**
 * 芝1800外。2角の奥へ伸ばした引き込みの端から。140m地点はまだ引き込み。
 * ゴールから外回りを戻した位置（直線の入口付近）には置かない。
 * 坂は3〜4角。直線は403.7mで平坦。
 */
export function kyotoTurf1800Run() {
  const g = GEOM;
  const len = g.chute1800;
  const join = sampleAt(g.outer, g.backJoinM);
  const chute = backChute(join, len);
  const last = chute.length - 1;
  const run = chute.map((p, i) => projectPoint(p, len * (i / last)));
  const rail = slice(g.outer, g.backJoinM, OUTER_LAP);
  for (let i = 1; i < rail.length; i += 1) {
    const p = rail[i];
    const atEnd = i === rail.length - 1;
    run.push(projectPoint(p, atEnd ? 1800 : len + (p.m - g.backJoinM)));
  }
  const race = (railM: number) => len + (railM - g.backJoinM);
  const turnEnd = OUTER_LAP - OUTER_STRAIGHT;
  const corner4Rail = g.corner3M + (turnEnd - g.corner3M) * 0.72;
  return {
    run,
    idle: slice(g.outer, 0, g.backJoinM).map((p) => projectPoint(p, p.m)),
    approach: backApproach(join, len),
    join: len,
    corner3: race(g.outerCornerM.c3),
    corner4: race(corner4Rail),
    straightFrom: race(turnEnd),
    hillFrom: race(g.corner3M),
    hillTo: race(g.corner3M) + 180,
  };
}

/**
 * 芝1200内。2角の出口から内回りを1200m。
 * 坂は3角側（図と同じく corner3 から180m）。ゴール前は平坦。
 */
export function kyotoTurf1200Run() {
  const g = GEOM;
  const startM = station(INNER_LAP, 1200);
  const run = slice(g.inner, startM, INNER_LAP).map((p) => projectPoint(p, p.m - startM));
  const idle = slice(g.inner, 0, startM).map((p) => projectPoint(p, p.m));
  return {
    run,
    idle,
    corner3: g.innerCornerM.c3 - startM,
    corner4: g.innerCornerM.c4 - startM,
    hillFrom: g.corner3M - startM,
    hillTo: g.corner3M + 180 - startM,
    straightFrom: INNER_LAP - INNER_STRAIGHT - startM,
  };
}

/**
 * 芝2400外。4角の途中から入り、ゴールを一度通過してから外回りをもう一周。
 * ゴールから本線を戻した506mだけでは置かない。坂は3〜4角を一度。最後の直線は平坦。
 */
export function kyotoTurf2400Run() {
  const g = GEOM;
  const startM = station(OUTER_LAP, 2400);
  const passFinish = OUTER_LAP - startM;
  const head = slice(g.outer, startM, OUTER_LAP).map((p) => projectPoint(p, p.m - startM));
  const body = slice(g.outer, 0, OUTER_LAP).map((p) => projectPoint(p, passFinish + p.m));
  const run = head.concat(body.filter((p) => p.m > head[head.length - 1].m + 0.05));
  const idle = slice(g.outer, 0, startM).map((p) => projectPoint(p, p.m));
  const corner1Lap = nearestM(g.outer, sampleAt(g.inner, g.innerCornerM.c1));
  const hillFrom = passFinish + g.corner3M;
  const straightFrom = passFinish + (OUTER_LAP - OUTER_STRAIGHT);
  return {
    run,
    idle,
    passFinish,
    corner1: passFinish + corner1Lap,
    back: (passFinish + hillFrom) / 2,
    corner3: passFinish + g.outerCornerM.c3,
    hillFrom,
    hillTo: passFinish + g.corner3M + 180,
    corner4: straightFrom - 80,
    straightFrom,
  };
}

function runPoint(run: { m: number; x: number; y: number; ix: number; iy: number }[], meter: number) {
  let lo = 0;
  let hi = run.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (run[mid].m < meter) lo = mid;
    else hi = mid;
  }
  const a = run[lo];
  const b = run[hi];
  const t = b.m === a.m ? 0 : (meter - a.m) / (b.m - a.m);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function assertNear(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 3) {
    throw new Error(`${label}: ${actual.toFixed(1)} ≠ ${expected}`);
  }
}

function insideInner(p: Pt, radius: number, home: number) {
  if (hypot(p.x + home, p.y - radius) < radius - 3) return true;
  if (hypot(p.x, p.y - radius) < radius - 3) return true;
  return p.x > -home + 3 && p.x < -3 && p.y > 3 && p.y < 2 * radius - 3;
}

function checkTemplates() {
  const g = GEOM;
  assertNear(g.inner[g.inner.length - 1].m, INNER_LAP, "内回り");
  assertNear(g.outer[g.outer.length - 1].m, OUTER_LAP, "外回り");
  assertNear(g.dirt[g.dirt.length - 1].m, DIRT_LAP, "ダート");
  assertNear(g.corner3M - station(OUTER_LAP, 3000), 208, "芝3000の3角");
  assertNear(g.corner3M - station(OUTER_LAP, 3200), 408, "芝3200の3角");
  assertNear(g.chute1800 + (g.corner3M - g.backJoinM), 902, "芝1800の3角");
  assertNear(g.chute1600Outer + (g.corner3M - g.backJoinM), 702, "芝1600外の3角");
  assertNear(g.chute1600Inner + (g.corner3M - g.backJoinM), 814, "芝1600内の3角");
  assertNear(g.chute1800 - g.chute1600Outer, 200, "1800は外1600の200m奥");
  const p2000in = sampleAt(g.inner, station(INNER_LAP, 2000));
  const p2000out = sampleAt(g.outer, station(OUTER_LAP, 2000));
  const apart = hypot(p2000in.x - p2000out.x, p2000in.y - p2000out.y);
  if (apart < 80) throw new Error(`芝2000の内外が近すぎる ${apart.toFixed(0)}`);
  const joinIn = sampleAt(g.inner, g.backJoinM);
  const joinOut = sampleAt(g.outer, g.backJoinM);
  if (hypot(joinIn.x - joinOut.x, joinIn.y - joinOut.y) > 2) throw new Error("2角出口で内外がずれている");
  for (const p of g.outer) {
    if (p.m < g.outerSplitM || p.m > g.outerJoinM) continue;
    if (insideInner(p, g.innerR, HOME)) throw new Error(`外回りが内に入っている ${p.m.toFixed(0)}`);
  }
  let noseX = -Infinity;
  for (const p of g.outer) {
    if (p.m < g.outerSplitM || p.m > g.outerJoinM) continue;
    if (p.x > noseX) noseX = p.x;
  }
  if (noseX < g.innerR + 20) throw new Error(`外回りの3〜4角が広がっていない ${noseX.toFixed(0)}`);
  assertNear(g.dirt1400Len + (DIRT_LAP - g.dirt1400Join), 1400, "ダート1400");
  const turf1200 = kyotoTurf1200Run();
  assertNear(turf1200.run[turf1200.run.length - 1].m, 1200, "芝1200走行のゴール");
  assertNear(turf1200.corner3, 514.4, "芝1200走行の3角");
  assertNear(turf1200.corner4, 743.4, "芝1200走行の4角");
  assertNear(1200 - turf1200.straightFrom, INNER_STRAIGHT, "芝1200の直線");
  if (!(turf1200.hillFrom < turf1200.corner3 && turf1200.corner3 < turf1200.hillTo && turf1200.hillTo < turf1200.corner4)) {
    throw new Error("芝1200の坂が3角にかかっていない");
  }
  if (!(turf1200.corner4 < turf1200.straightFrom && turf1200.straightFrom < 1200)) {
    throw new Error("芝1200の直線が4角より前");
  }
  const turf2400 = kyotoTurf2400Run();
  const start2400 = station(OUTER_LAP, 2400);
  assertNear(turf2400.run[turf2400.run.length - 1].m, 2400, "芝2400走行のゴール");
  assertNear(turf2400.passFinish + OUTER_LAP, 2400, "芝2400は1周と余り");
  assertNear(2400 - turf2400.straightFrom, OUTER_STRAIGHT, "芝2400の直線");
  if (!(start2400 > g.outerCornerM.c3 && start2400 < g.outerCornerM.c4)) {
    throw new Error(`芝2400の発走が4角にない ${start2400.toFixed(0)}`);
  }
  if (turf2400.passFinish > 700) throw new Error("芝2400がゴール前の本線だけになっている");
  if (
    !(
      turf2400.passFinish < turf2400.corner1 &&
      turf2400.corner1 < turf2400.back &&
      turf2400.back < turf2400.hillFrom &&
      turf2400.hillFrom < turf2400.hillTo &&
      turf2400.hillTo < turf2400.corner4 &&
      turf2400.corner4 < turf2400.straightFrom
    )
  ) {
    throw new Error(
      `芝2400の並び: 通過${turf2400.passFinish.toFixed(0)} 1角${turf2400.corner1.toFixed(0)} 坂${turf2400.hillFrom.toFixed(0)} 直線${turf2400.straightFrom.toFixed(0)}`,
    );
  }
  const startOnRail = sampleAt(g.outer, start2400);
  if (hypot(turf2400.run[0].x - startOnRail.x, turf2400.run[0].y - startOnRail.y) > 2) {
    throw new Error("芝2400の発走が外回りにない");
  }
  const finish2400 = sampleAt(g.outer, OUTER_LAP);
  const atPass = runPoint(turf2400.run, turf2400.passFinish);
  const atGoal = turf2400.run[turf2400.run.length - 1];
  if (hypot(atPass.x - finish2400.x, atPass.y - finish2400.y) > 8) throw new Error("芝2400の最初のゴール通過がゴールにない");
  if (hypot(atGoal.x - finish2400.x, atGoal.y - finish2400.y) > 8) throw new Error("芝2400のゴールがゴールにない");
  const c1 = sampleAt(g.inner, g.innerCornerM.c1);
  const turf1800 = kyotoTurf1800Run();
  const walked1800 = sampleAt(g.outer, OUTER_LAP - 1800);
  const join1800 = sampleAt(g.outer, g.backJoinM);
  assertNear(turf1800.run[turf1800.run.length - 1].m, 1800, "芝1800走行のゴール");
  assertNear(turf1800.join, g.chute1800, "芝1800の引き込み");
  assertNear(turf1800.hillFrom, 902, "芝1800の坂");
  assertNear(1800 - turf1800.straightFrom, OUTER_STRAIGHT, "芝1800の直線");
  if (!(140 < turf1800.join && turf1800.join < turf1800.hillFrom && turf1800.hillFrom < turf1800.corner3)) {
    throw new Error(`芝1800の引き込み ${turf1800.join.toFixed(0)}`);
  }
  if (!(turf1800.corner3 < turf1800.hillTo && turf1800.hillTo < turf1800.corner4 && turf1800.corner4 < turf1800.straightFrom)) {
    throw new Error(`芝1800の並び 3角${turf1800.corner3.toFixed(0)} 4角${turf1800.corner4.toFixed(0)}`);
  }
  const at140 = runPoint(turf1800.run, 140);
  if (at140.x >= join1800.x - 20) throw new Error("芝1800の140mが引き込みを出ている");
  if (hypot(turf1800.run[0].x - walked1800.x, turf1800.run[0].y - walked1800.y) < 200) {
    throw new Error("芝1800の引き込みが本線の戻り位置にある");
  }
  const atJoin = runPoint(turf1800.run, turf1800.join);
  if (hypot(atJoin.x - join1800.x, atJoin.y - join1800.y) > 2) throw new Error("芝1800の本線が2角の出口にない");
  if (hypot(turf1800.approach[turf1800.approach.length - 1].x - turf1800.run[0].x, turf1800.approach[turf1800.approach.length - 1].y - turf1800.run[0].y) > 1) {
    throw new Error("芝1800のゲートが引き込みの後ろにない");
  }
  if (!turf1800.run.every((point, index) => index === 0 || point.m > turf1800.run[index - 1].m)) {
    throw new Error("芝1800の点列が戻っている");
  }
  const atCorner = runPoint(turf2400.run, turf2400.corner1);
  if (hypot(atCorner.x - c1.x, atCorner.y - c1.y) > 8) throw new Error("芝2400の1角が入口にない");
  const atHill = runPoint(turf2400.run, turf2400.hillFrom);
  if (atHill.y < 80) throw new Error("芝2400の坂が3〜4角にない");
  if (!turf2400.run.every((point, index) => index === 0 || point.m > turf2400.run[index - 1].m)) {
    throw new Error("芝2400の点列が戻っている");
  }
  const ids = new Set(KYOTO_TEMPLATES.map((item) => item.id));
  if (ids.size !== KYOTO_TEMPLATES.length) throw new Error("テンプレートidが重複");
  for (const item of KYOTO_TEMPLATES) {
    const map = presentKyoto(item.id);
    const [, , width, height] = map.viewBox.split(/\s+/).map(Number);
    for (const label of map.labels) {
      if (label.x < 16 || label.y < 12 || label.x > width - 16 || label.y > height - 12) {
        throw new Error(`${item.id} の${label.text}が図の外 (${label.x.toFixed(0)},${label.y.toFixed(0)})`);
      }
    }
  }
}

checkTemplates();

/** 内・外が同じ距離（1400・1600・2000）はここを呼ばない */
export function kyotoFlatGeom(templateId: string) {
  const template = KYOTO_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return null;
  const g = GEOM;
  if (template.id === "dirt-1400") {
    const chutePts = withSpan(chute(g.dirt, g.dirt1400Join, g.dirt1400Len, 36), g.dirt1400Len);
    const after = asRaw(slice(g.dirt, g.dirt1400Join, DIRT_LAP));
    return assembleFlat({
      meters: template.meters,
      head: [chutePts, after],
      loop: g.dirt1400Len + spanOf(after) + 8 < template.meters ? asRaw(g.dirt) : null,
      resume: 0,
      lap: DIRT_LAP,
      finishJoinRace: g.dirt1400Len,
      finishJoinRail: g.dirt1400Join,
      c1: g.dirtCornerM.c1,
      c3: g.dirtCornerM.c3,
      c4: g.dirtCornerM.c4,
      straight: DIRT_STRAIGHT,
      hillsBeforeFinish: [],
    });
  }
  const dirt = template.track === "ダート";
  const rail = template.rail === "outer" ? g.outer : dirt ? g.dirt : g.inner;
  const lap = rail[rail.length - 1].m;
  const start = station(lap, template.meters);
  const head = asRaw(slice(rail, start, lap));
  const corners = dirt
    ? g.dirtCornerM
    : template.rail === "outer"
      ? {
          c1: nearestM(g.outer, sampleAt(g.inner, g.innerCornerM.c1)),
          c3: g.outerCornerM.c3,
          c4: g.outerCornerM.c4,
        }
      : g.innerCornerM;
  return assembleFlat({
    meters: template.meters,
    head: [head],
    idle: template.meters + 0.05 < lap ? asRaw(slice(rail, 0, start)) : [],
    loop: spanOf(head) + 8 < template.meters ? asRaw(rail) : null,
    resume: 0,
    lap,
    finishJoinRace: 0,
    finishJoinRail: start,
    c1: corners.c1,
    c3: corners.c3,
    c4: corners.c4,
    straight: dirt ? DIRT_STRAIGHT : template.rail === "outer" ? OUTER_STRAIGHT : INNER_STRAIGHT,
    hillsBeforeFinish: [],
  });
}
