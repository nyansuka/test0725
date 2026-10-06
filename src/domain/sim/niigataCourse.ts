/**
 * 新潟の平地テンプレート。障害コースは入れない。
 * Aコース（芝内1623m・直線358.7m、芝外2223m・直線658.7m、ダート1472.5m・直線353.9m）。
 * 発走は、その距離をゴールからコースに沿って戻した位置。
 * ゴールから1角までを59mにし、内2000の1角が436m、内2200が636m、内2400が836mになる。
 * 向正面を448mにし、芝1200の3角が448m、ポケットの芝1400内が648mになる。
 * 外回りは2角まで内回りと同じ。分岐の先の向正面を300m延ばし、3〜4角は同じ長さの外側の弧。
 * 直線は658.7m。向正面の上には山を乗せない。上りは分岐の先だけ。
 * 直線1000はホームの延長。内2200はその途中、内2400は外の4角より奥。
 * 1400内と2000外は、2角の奥へ200m伸ばした同じポケット。
 * ダート1200だけ、2角の外側から芝を踏んで入る。3角まで525m。
 * 左回りの向きは東京と同じ。
 */

export type SimTrack = "芝" | "ダート";

export type NiigataTemplate = {
  id: string;
  track: SimTrack;
  meters: number;
  badge: string;
  course: string;
  place: string;
  summary: string;
  bullets: string[];
  lap: number;
  rail: "inner" | "outer" | "dirt" | "straight";
};

const INNER_LAP = 1623;
const OUTER_LAP = 2223;
const DIRT_LAP = 1472.5;
const INNER_STRAIGHT = 358.7;
const OUTER_STRAIGHT = 658.7;
const DIRT_STRAIGHT = 353.9;
/** ゴールから1角入口。内2000の1角が436、内2200が636、内2400が836 */
const FINISH_TO_CORNER = 59;
/** 向正面。芝1200の3角が448、芝1400内の3角が648 */
const INNER_BACK = 448;
/** 外の向正面。芝1800の3角が748。芝1600は200m先で548（公表は約550） */
const OUTER_BACK = 748;
/** 2角の奥。1400内と2000外 */
const POCKET = 200;
/** ダート1800の1角が389 */
const DIRT_FINISH_TO_CORNER = 61.5;
/** ダート1200の芝を100mにすると、3角が525 */
const DIRT_BACK = 425;
const DIRT_POCKET = 100;
const STRAIGHT_RACE = 1000;

const SCALE = 0.88;
const PAD = 108;
/** 1200は2角の外側へ出す */
const DIRT_1200_SIDE = 42;

type Pt = { x: number; y: number };
type Sample = Pt & { m: number; ix: number; iy: number };
type ScreenPt = { x: number; y: number; m: number; ox: number; oy: number };
type Range = { from: number; to: number };

type Built = {
  inner: Sample[];
  outer: Sample[];
  dirt: Sample[];
  straight: Sample[];
  backJoinM: number;
  splitM: number;
  innerC4M: number;
  outerC4M: number;
  outerJoinM: number;
  outerC3M: number;
  innerC3M: number;
  dirtBackJoinM: number;
  dirtC3M: number;
  dirtC4M: number;
  pocket: number;
  dirtPocket: number;
  innerR: number;
  dirtR: number;
  outerUp: Range;
  outerDown: Range;
  straightUp: Range;
  innerCornerM: { c1: number; c2: number; c3: number; c4: number };
  outerCornerM: { c1: number; c2: number; c3: number; c4: number };
  dirtCornerM: { c1: number; c2: number; c3: number; c4: number };
};

function hypot(dx: number, dy: number) {
  return Math.hypot(dx, dy);
}

function pushLine(out: Pt[], a: Pt, b: Pt, step = 5) {
  const len = hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.round(len / step));
  const start = out.length > 0 ? 1 : 0;
  for (let i = start; i <= n; i += 1) {
    const t = i / n;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
}

/** 左回り。角度は増やす */
function pushArc(out: Pt[], cx: number, cy: number, r: number, a0: number, sweep: number, step = 5) {
  const len = Math.abs(r * sweep);
  const n = Math.max(12, Math.round(len / step));
  const start = out.length > 0 ? 1 : 0;
  for (let i = start; i <= n; i += 1) {
    const a = a0 + sweep * (i / n);
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
}

function polyLen(pts: Pt[]) {
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) len += hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

/** 3〜4角。向正面の端から4角の出口まで、外（-x）へ膨らませて長さを合わせる */
function spiralTurn(from: Pt, to: Pt, target: number): Pt[] {
  const r = (from.y - to.y) / 2;
  const sample = (bulge: number) => {
    const n = 96;
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      const ang = Math.PI / 2 - Math.PI * t;
      pts.push({
        x: from.x + (to.x - from.x) * t - bulge * Math.sin(Math.PI * t) ** 2,
        y: to.y + r * (1 + Math.sin(ang)),
      });
    }
    return pts;
  };
  const base = polyLen(sample(0));
  if (base > target + 1) throw new Error(`3〜4角がすでに長い ${base.toFixed(1)} > ${target.toFixed(1)}`);
  let lo = 0;
  let hi = 280;
  if (polyLen(sample(hi)) < target) {
    throw new Error(`3〜4角が届かない ${polyLen(sample(hi)).toFixed(1)} < ${target.toFixed(1)}`);
  }
  for (let i = 0; i < 28; i += 1) {
    const mid = (lo + hi) / 2;
    if (polyLen(sample(mid)) > target) hi = mid;
    else lo = mid;
  }
  return sample((lo + hi) / 2);
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
  // 左回り。進行方向の左手が内。yは北が正。
  for (let i = 0; i < raw.length; i += 1) {
    const prev = raw[Math.max(0, i - 1)];
    const next = raw[Math.min(raw.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const v = hypot(tx, ty) || 1;
    raw[i].ix = -ty / v;
    raw[i].iy = tx / v;
  }
  return raw;
}

function front(r: number) {
  const finish: Pt = { x: INNER_STRAIGHT, y: 0 };
  const c1: Pt = { x: INNER_STRAIGHT + FINISH_TO_CORNER, y: 0 };
  const back0: Pt = { x: c1.x, y: 2 * r };
  return { finish, c1, back0 };
}

function buildInner(r: number) {
  const { finish, c1, back0 } = front(r);
  const back1: Pt = { x: c1.x - INNER_BACK, y: 2 * r };
  const c4: Pt = { x: 0, y: 0 };
  const left = Math.PI * r;
  const right = INNER_LAP - FINISH_TO_CORNER - left - INNER_BACK - INNER_STRAIGHT;
  const pts: Pt[] = [];
  pushLine(pts, finish, c1);
  pushArc(pts, c1.x, r, r, -Math.PI / 2, Math.PI);
  pushLine(pts, back0, back1);
  const turn = spiralTurn(back1, c4, right);
  for (let i = 1; i < turn.length; i += 1) pts.push(turn[i]);
  pushLine(pts, c4, finish);
  return { samples: withMeters(pts, INNER_LAP), back0, back1, c4, r };
}

function buildOuter(r: number, back0: Pt) {
  const { finish, c1 } = front(r);
  const back1: Pt = { x: c1.x - OUTER_BACK, y: 2 * r };
  const c4: Pt = { x: INNER_STRAIGHT - OUTER_STRAIGHT, y: 0 };
  const left = Math.PI * r;
  const right = OUTER_LAP - FINISH_TO_CORNER - left - OUTER_BACK - OUTER_STRAIGHT;
  const pts: Pt[] = [];
  pushLine(pts, finish, c1);
  pushArc(pts, c1.x, r, r, -Math.PI / 2, Math.PI);
  pushLine(pts, back0, back1);
  const turn = spiralTurn(back1, c4, right);
  for (let i = 1; i < turn.length; i += 1) pts.push(turn[i]);
  pushLine(pts, c4, finish);
  return { samples: withMeters(pts, OUTER_LAP), back1, c4 };
}

function buildDirt() {
  const dirtR = 311 / Math.PI;
  const y = 18;
  const finishX = INNER_STRAIGHT + FINISH_TO_CORNER - DIRT_FINISH_TO_CORNER;
  const dC4: Pt = { x: finishX - DIRT_STRAIGHT, y };
  const dFinish: Pt = { x: finishX, y };
  const dC1: Pt = { x: finishX + DIRT_FINISH_TO_CORNER, y };
  const back0: Pt = { x: dC1.x, y: y + 2 * dirtR };
  const back1: Pt = { x: dC1.x - DIRT_BACK, y: y + 2 * dirtR };
  const right = DIRT_LAP - DIRT_STRAIGHT - DIRT_BACK - DIRT_FINISH_TO_CORNER - Math.PI * dirtR;
  const pts: Pt[] = [];
  pushLine(pts, dFinish, dC1);
  pushArc(pts, dC1.x, y + dirtR, dirtR, -Math.PI / 2, Math.PI);
  pushLine(pts, back0, back1);
  const turn = spiralTurn(back1, dC4, right);
  for (let i = 1; i < turn.length; i += 1) pts.push(turn[i]);
  pushLine(pts, dC4, dFinish);
  return { samples: withMeters(pts, DIRT_LAP), r: dirtR, back0 };
}

function buildStraight(): Sample[] {
  const finish: Pt = { x: INNER_STRAIGHT, y: 0 };
  const start: Pt = { x: INNER_STRAIGHT - STRAIGHT_RACE, y: 0 };
  const pts: Pt[] = [];
  pushLine(pts, start, finish, 8);
  return withMeters(pts, STRAIGHT_RACE);
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

function buildGeometry(): Built {
  const turfR = (INNER_LAP - 1200 - FINISH_TO_CORNER) / Math.PI;
  const inner = buildInner(turfR);
  const outer = buildOuter(turfR, inner.back0);
  const dirt = buildDirt();
  const straight = buildStraight();
  const backJoinM = nearestM(inner.samples, inner.back0);
  const splitM = nearestM(outer.samples, inner.back1);
  const innerC4M = nearestM(inner.samples, inner.c4);
  const outerC4M = nearestM(outer.samples, outer.c4);
  const outerJoinM = nearestM(outer.samples, inner.c4);
  const dirtBackJoinM = nearestM(dirt.samples, dirt.back0);
  const innerC3M = backJoinM + INNER_BACK;
  const outerC3M = backJoinM + OUTER_BACK;
  const dirtC3M = dirtBackJoinM + DIRT_BACK;
  const dirtC4M = DIRT_LAP - DIRT_STRAIGHT;
  return {
    inner: inner.samples,
    outer: outer.samples,
    dirt: dirt.samples,
    straight,
    backJoinM,
    splitM,
    innerC4M,
    outerC4M,
    outerJoinM,
    outerC3M,
    innerC3M,
    dirtBackJoinM,
    dirtC3M,
    dirtC4M,
    pocket: POCKET,
    dirtPocket: DIRT_POCKET,
    innerR: inner.r,
    dirtR: dirt.r,
    outerUp: { from: splitM, to: outerC3M },
    outerDown: { from: outerC3M, to: outerC4M },
    straightUp: { from: 0, to: 200 },
    innerCornerM: {
      c1: FINISH_TO_CORNER,
      c2: backJoinM,
      c3: innerC3M,
      c4: innerC4M,
    },
    outerCornerM: {
      c1: FINISH_TO_CORNER,
      c2: backJoinM,
      c3: outerC3M,
      c4: outerC4M,
    },
    dirtCornerM: {
      c1: DIRT_FINISH_TO_CORNER,
      c2: dirtBackJoinM,
      c3: dirtC3M,
      c4: dirtC4M,
    },
  };
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

/** 合流地点の手前を、外へずらしてゲートまで戻す */
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

/** 向正面を2角の奥へまっすぐ伸ばす。左回りなので +x */
function backChute(join: Sample, length: number): Sample[] {
  const n = Math.max(8, Math.round(length / 8));
  const pts: Sample[] = [];
  for (let i = 0; i <= n; i += 1) {
    const back = length * (1 - i / n);
    pts.push({
      m: i,
      x: join.x + back,
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

function toFinish(lap: number, meters: number) {
  const rem = meters % lap;
  if (rem < 0.05) return lap;
  return rem;
}

const GEOM = buildGeometry();

function lapPhrase(meters: number, lap: number) {
  if (meters + 0.05 < lap) return "ワンターン";
  const n = Math.floor((meters + 0.05) / lap);
  const rem = Math.round(meters - n * lap);
  if (rem <= 0) return `${n}周`;
  return `${n}周と${rem}m`;
}

export const NIIGATA_TEMPLATES: NiigataTemplate[] = [
  {
    id: "turf-1000",
    track: "芝",
    meters: 1000,
    badge: "直線",
    course: "直線",
    place: "直線コースの端",
    summary: "コーナーのない直線。最初の200mが上り。",
    bullets: ["外の4角より341m奥から、ゴールまでまっすぐ1000m。", "最初の200mが上り。そこから先は平坦。"],
    lap: STRAIGHT_RACE,
    rail: "straight",
  },
  {
    id: "turf-1200",
    track: "芝",
    meters: 1200,
    badge: "内",
    course: "内回り",
    place: "向正面の入り口",
    summary: "内回りの短距離。2角を出てすぐ。",
    bullets: ["2角の出口。3角まで448m。", "直線は358.7mで平坦。1800は同じ地点から外回り。"],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-1400",
    track: "芝",
    meters: 1400,
    badge: "ポケ",
    course: "内回り",
    place: "2角奥のポケット",
    summary: "1200の200m奥。内回りのポケット。",
    bullets: ["2角の奥へ200m。3角まで648m。", "2000外はこのポケットから外回りへ入る。直線は358.7m。"],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-1400-outer",
    track: "芝",
    meters: 1400,
    badge: "外",
    course: "外回り",
    place: "向正面、分岐の手前",
    summary: "外回りの1400。内回りの1400とは別の地点。",
    bullets: ["向正面、内と外の分岐の48m手前。3角まで348m。", "分岐の先が上り、3〜4角は下り。直線は658.7m。"],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-1600",
    track: "芝",
    meters: 1600,
    badge: "外",
    course: "外回り",
    place: "向正面の2角寄り",
    summary: "外回りマイル。直線が全場最長。",
    bullets: ["1800の200m手前。3角まで548m。", "分岐を過ぎてから上り、3〜4角は下り。直線は平坦で658.7m。"],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-1800",
    track: "芝",
    meters: 1800,
    badge: "外",
    course: "外回り",
    place: "向正面の入り口",
    summary: "1200と同じ地点から、外回りの3〜4角を回る。",
    bullets: ["2角の出口。内回りの1200と同じ地点。3角まで748m。", "2000内は別の発走。直線は658.7m。"],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-2000",
    track: "芝",
    meters: 2000,
    badge: "内",
    course: "内回り",
    place: "4角を出る直前",
    summary: "内回りの2000。1800の延長ではない。",
    bullets: ["内の4角を出る18m手前。1角まで436m。", "1800は外回りの向正面。直線は358.7m。"],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-2000-outer",
    track: "芝",
    meters: 2000,
    badge: "ポケ",
    course: "外回り",
    place: "2角奥のポケット",
    summary: "1400内と同じポケットから外回り。コーナーは2回。",
    bullets: ["1400内と同じ地点。3角まで948m。コーナーは3〜4角だけ。", "分岐の先が上り、直線は658.7m。"],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-2200",
    track: "芝",
    meters: 2200,
    badge: "内",
    course: "内回り",
    place: "外の4角と内の合流の間",
    summary: "長い直線の途中から内回り。",
    bullets: ["外の4角から82m、内の4角まで218m。1角まで636m。", "ゴールまでは内回りの直線358.7m。"],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-2400",
    track: "芝",
    meters: 2400,
    badge: "ポケ",
    course: "内回り",
    place: "直線1000の引き込み",
    summary: "外の4角より奥。2200の200m後ろ。",
    bullets: ["直線1000の上りを過ぎたところ。外の4角まで118m。1角まで836m。", "2200より200m奥。内回りで、直線は358.7m。"],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-3000",
    track: "芝",
    meters: 3000,
    badge: "外",
    course: "外回り",
    place: "外の4角手前",
    summary: "外回りの3〜4角から1周あまり。",
    bullets: ["外の直線の118m手前、3〜4角の出口側。", "直線は658.7m。2400の引き込みとは別の地点。"],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-3200",
    track: "芝",
    meters: 3200,
    badge: "外",
    course: "外回り",
    place: "外の3角を出てすぐ",
    summary: "外回りの3〜4角に入ったところから。",
    bullets: ["3角から75m。4角の出口まで318m。", "直線は658.7m。直線1000の発走とは別の地点。"],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "dirt-1000",
    track: "ダート",
    meters: 1000,
    badge: "向",
    course: "ダート",
    place: "向正面",
    summary: "向正面から。番組は少ない。",
    bullets: ["2角を出て100m。3角まで325m。", "直線は353.9m。ほぼ平坦。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1200",
    track: "ダート",
    meters: 1200,
    badge: "芝発",
    course: "芝スタート",
    place: "2角の外側",
    summary: "この距離だけ芝スタート。外枠の前が残りやすい。",
    bullets: ["2角の外側から芝を100m。3角まで525m。外側ほど芝が長い。", "直線は353.9m。外枠の逃げ・先行が残りやすい。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1700",
    track: "ダート",
    meters: 1700,
    badge: "直線",
    course: "ダート",
    place: "直線の途中",
    summary: "直線から。施行は少ない。",
    bullets: ["4角を出て126m。1角まで289m。", "直線は353.9m。ほぼ平坦。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1800",
    track: "ダート",
    meters: 1800,
    badge: "直線",
    course: "ダート",
    place: "4角寄り",
    summary: "4角を出てすぐ。ダートの主距離。",
    bullets: ["4角を出て26m。1角まで389m。", "直線は353.9m。高低差は0.6mで、ほぼ平坦。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-2500",
    track: "ダート",
    meters: 2500,
    badge: "向",
    course: "ダート",
    place: "向正面",
    summary: "向正面から1周あまり。",
    bullets: ["2角を出て73m。3角まで353m。", "直線は353.9m。ほぼ平坦。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
];

export function niigataTemplate(id: string) {
  return NIIGATA_TEMPLATES.find((item) => item.id === id) ?? NIIGATA_TEMPLATES[0];
}

export type MapLabel = { x: number; y: number; text: string };
export type MapLine = { x1: number; y1: number; x2: number; y2: number };

export type NiigataMap = {
  viewBox: string;
  innerD: string;
  outerD: string;
  dirtD: string;
  straightD: string;
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

function turfPocket() {
  return backChute(sampleAt(GEOM.inner, GEOM.backJoinM), GEOM.pocket);
}

function dirtPocket() {
  return chute(GEOM.dirt, GEOM.dirtBackJoinM, GEOM.dirtPocket, DIRT_1200_SIDE);
}

const FIT = shiftFor([
  GEOM.inner,
  GEOM.outer,
  GEOM.dirt,
  GEOM.straight,
  turfPocket(),
  dirtPocket(),
]);

/** 内2200・内2400は、内レールの手前にある直線上 */
function homeExtension(id: string): number | null {
  if (id === "turf-2200") return toFinish(INNER_LAP, 2200);
  if (id === "turf-2400") return toFinish(INNER_LAP, 2400);
  return null;
}

function pocketPaths(id: string): Sample[][] | null {
  const g = GEOM;
  if (id === "turf-1400") {
    return [turfPocket(), slice(g.inner, g.backJoinM, INNER_LAP)];
  }
  if (id === "turf-2000-outer") {
    return [turfPocket(), slice(g.outer, g.backJoinM, OUTER_LAP)];
  }
  if (id === "dirt-1200") {
    return [dirtPocket(), slice(g.dirt, g.dirtBackJoinM, DIRT_LAP)];
  }
  return null;
}

function usedMeterPaths(template: NiigataTemplate): Sample[][] {
  if (template.id === "turf-1000") return [GEOM.straight];
  const along = homeExtension(template.id);
  if (along != null) {
    return [slice(GEOM.straight, STRAIGHT_RACE - along, STRAIGHT_RACE), GEOM.inner];
  }
  const pocket = pocketPaths(template.id);
  if (pocket) return pocket;
  const rail = template.rail === "outer" ? GEOM.outer : template.rail === "dirt" ? GEOM.dirt : GEOM.inner;
  const lap = rail[rail.length - 1].m;
  if (template.meters + 0.05 >= lap) return [rail];
  return [slice(rail, station(lap, template.meters), lap)];
}

function startSample(template: NiigataTemplate): Sample {
  if (template.id === "turf-1000") return GEOM.straight[0];
  const along = homeExtension(template.id);
  if (along != null) return sampleAt(GEOM.straight, STRAIGHT_RACE - along);
  const pocket = pocketPaths(template.id);
  if (pocket) return pocket[0][0];
  const rail = template.rail === "outer" ? GEOM.outer : template.rail === "dirt" ? GEOM.dirt : GEOM.inner;
  return sampleAt(rail, station(rail[rail.length - 1].m, template.meters));
}

function finishSample(template: NiigataTemplate): Sample {
  if (template.track === "ダート") return sampleAt(GEOM.dirt, DIRT_LAP);
  if (template.id === "turf-1000") return sampleAt(GEOM.straight, STRAIGHT_RACE);
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

function cornerLabels(template: NiigataTemplate, view: { inner: ScreenPt[]; outer: ScreenPt[]; dirt: ScreenPt[] }): MapLabel[] {
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
  put(view.inner, g.innerCornerM.c1, "1角");
  put(view.inner, g.innerCornerM.c2, "2角");
  if (template.rail === "outer") {
    put(view.outer, g.outerCornerM.c3, "3角");
    put(view.outer, g.outerCornerM.c4, "4角");
    return labels;
  }
  put(view.inner, g.innerCornerM.c3, "3角");
  put(view.inner, g.innerCornerM.c4, "4角");
  if (template.id === "turf-1000" || template.id === "turf-2200" || template.id === "turf-2400") {
    put(view.outer, g.outerCornerM.c4, "外4");
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

function hillPaths(template: NiigataTemplate): Sample[][] {
  const g = GEOM;
  if (template.rail === "outer") {
    return [slice(g.outer, g.outerUp.from, g.outerUp.to), slice(g.outer, g.outerDown.from, g.outerDown.to)];
  }
  if (template.id === "turf-1000") return [slice(g.straight, g.straightUp.from, g.straightUp.to)];
  return [];
}

export function presentNiigata(id: string): NiigataMap {
  const template = niigataTemplate(id);
  const view = screens();
  const used = usedMeterPaths(template).map((pts) => pathD(screenSamples(pts, FIT.shift)));
  const hills = hillPaths(template);
  const hillD = hills.map((pts) => pathD(screenSamples(pts, FIT.shift))).join(" ");
  const startS = screenSamples([startSample(template)], FIT.shift)[0];
  const finishS = screenSamples([finishSample(template)], FIT.shift)[0];
  const labels: MapLabel[] = [
    ...cornerLabels(template, view),
    { x: startS.x + startS.ox * 28, y: startS.y + startS.oy * 28, text: "発走" },
    { x: finishS.x + finishS.ox * 28, y: finishS.y + finishS.oy * 28, text: "ゴール" },
  ];
  if (template.rail === "outer") {
    const up = screenAt(view.outer, (GEOM.outerUp.from + GEOM.outerUp.to) / 2);
    const down = screenAt(view.outer, (GEOM.outerDown.from + GEOM.outerDown.to) / 2);
    labels.push({ x: up.x + up.ox * 24, y: up.y + up.oy * 24, text: "上り" });
    labels.push({ x: down.x + down.ox * 24, y: down.y + down.oy * 24, text: "下り" });
  }
  if (template.id === "turf-1000") {
    const up = screenSamples([sampleAt(GEOM.straight, 100)], FIT.shift)[0];
    labels.push({ x: up.x - up.ox * 22, y: up.y - up.oy * 22, text: "上り" });
  }
  const chuteEnd = STRAIGHT_RACE - OUTER_STRAIGHT;
  return {
    viewBox: view.viewBox,
    innerD: pathD(view.inner),
    outerD: pathD(sliceScreen(view.outer, GEOM.splitM, GEOM.outerJoinM)),
    dirtD: pathD(view.dirt),
    straightD: pathD(screenSamples(slice(GEOM.straight, 0, chuteEnd), FIT.shift)),
    used,
    hillD,
    labels,
    start: bar(startS, 14),
    finish: bar(finishS, 16),
    title: `${template.track}${template.meters} ${template.course}`,
  };
}

export function niigataRunPhrase(template: NiigataTemplate) {
  if (template.id === "turf-1000") return "直線";
  if (template.id === "turf-1400" || template.id === "turf-2000-outer" || template.id === "turf-2400") return "ポケット";
  if (template.id === "dirt-1200") return "芝スタート";
  return lapPhrase(template.meters, template.lap);
}

export function niigataStraight(template: NiigataTemplate) {
  if (template.id === "turf-1000") return "1000m";
  if (template.track === "ダート") return "353.9m";
  if (template.rail === "outer") return "658.7m";
  return "358.7m";
}

type RunPoint = { m: number; x: number; y: number; ix: number; iy: number };

function projectPoint(p: { x: number; y: number; ix: number; iy: number }, m: number): RunPoint {
  return { m, x: p.x, y: p.y, ix: p.ix, iy: p.iy };
}

function onRun(from: number, to: number, origin: number, meters: number): [number, number] | null {
  const a = Math.max(0, from - origin);
  const b = Math.min(meters, to - origin);
  if (b - a < 12) return null;
  return [a, b];
}

/** 4角の出口が直線の入口と重なるとき、標識はコーナーの中に置く */
function cornerBeforeStraight(corner3: number, exit: number, straightFrom: number) {
  const mark = Math.min(exit, straightFrom) - 36;
  if (!(mark > corner3 + 30)) {
    throw new Error(`4角が置けない 3角${corner3.toFixed(0)} 出口${exit.toFixed(0)} 直線${straightFrom.toFixed(0)}`);
  }
  return mark;
}

/**
 * 芝1200内。2角の出口から内回りを1200m。直線は358.7mで平坦。
 * 外回りの長い直線にはしない。
 */
export function niigataTurf1200Run() {
  const g = GEOM;
  const startM = station(INNER_LAP, 1200);
  const straightFrom = INNER_LAP - INNER_STRAIGHT - startM;
  const corner3 = g.innerC3M - startM;
  return {
    run: slice(g.inner, startM, INNER_LAP).map((p) => projectPoint(p, p.m - startM)),
    idle: slice(g.inner, 0, startM).map((p) => projectPoint(p, p.m)),
    approach: [] as RunPoint[],
    corner3,
    corner4: cornerBeforeStraight(corner3, g.innerC4M - startM, straightFrom),
    straightFrom,
    hills: [] as Array<[number, number]>,
  };
}

/**
 * 芝1600・1800外。向正面から外回りをゴールまで。直線は658.7m。
 * 1400は内と外が距離だけでは分かれないのでここには入れない。
 * 2000外のポケットも入れない。
 */
function niigataTurfOuter(meters: 1600 | 1800) {
  const g = GEOM;
  const startM = station(OUTER_LAP, meters);
  const straightFrom = OUTER_LAP - OUTER_STRAIGHT - startM;
  const corner3 = g.outerC3M - startM;
  const hills = [onRun(g.splitM, g.outerC3M, startM, meters), onRun(g.outerC3M, g.outerC4M, startM, meters)].filter(
    (hill): hill is [number, number] => hill != null,
  );
  return {
    run: slice(g.outer, startM, OUTER_LAP).map((p) => projectPoint(p, p.m - startM)),
    idle: slice(g.outer, 0, startM).map((p) => projectPoint(p, p.m)),
    approach: [] as RunPoint[],
    corner3,
    corner4: cornerBeforeStraight(corner3, g.outerC4M - startM, straightFrom),
    straightFrom,
    hills,
  };
}

export function niigataTurf1600Run() {
  return niigataTurfOuter(1600);
}

export function niigataTurf1800Run() {
  return niigataTurfOuter(1800);
}

function assertNear(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 3) {
    throw new Error(`${label}: ${actual.toFixed(1)} ≠ ${expected}`);
  }
}

/** レールの内側が正 */
function railInset(rail: Sample[], p: Pt) {
  let best = rail[0];
  let bestD = Infinity;
  for (const q of rail) {
    const d = hypot(q.x - p.x, q.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return (p.x - best.x) * best.ix + (p.y - best.y) * best.iy;
}

function checkTemplates() {
  const g = GEOM;
  assertNear(g.inner[g.inner.length - 1].m, INNER_LAP, "内回り");
  assertNear(g.outer[g.outer.length - 1].m, OUTER_LAP, "外回り");
  assertNear(g.dirt[g.dirt.length - 1].m, DIRT_LAP, "ダート");
  assertNear(g.straight[g.straight.length - 1].m, STRAIGHT_RACE, "直線");
  assertNear(g.backJoinM, INNER_LAP - 1200, "2角の出口");
  assertNear(g.innerC3M - g.backJoinM, 448, "向正面");
  assertNear(g.outerC3M - g.backJoinM, 748, "外の向正面");
  assertNear(g.innerC3M - station(INNER_LAP, 1200), 448, "芝1200の3角");
  assertNear(g.pocket + (g.innerC3M - g.backJoinM), 648, "芝1400内の3角");
  assertNear(g.pocket + (INNER_LAP - g.backJoinM), 1400, "芝1400内");
  assertNear(g.outerC3M - station(OUTER_LAP, 1600), 548, "芝1600の3角");
  assertNear(g.outerC3M - station(OUTER_LAP, 1800), 748, "芝1800の3角");
  assertNear(g.pocket + (g.outerC3M - g.backJoinM), 948, "芝2000外の3角");
  assertNear(g.pocket + (OUTER_LAP - g.backJoinM), 2000, "芝2000外");
  assertNear(g.outerC3M - station(OUTER_LAP, 1400), 348, "芝1400外の3角");
  assertNear(g.splitM - station(OUTER_LAP, 1400), 48, "芝1400外から分岐");
  assertNear(INNER_LAP - station(INNER_LAP, 2000) + FINISH_TO_CORNER, 436, "芝2000内の1角");
  assertNear(toFinish(INNER_LAP, 2200) + FINISH_TO_CORNER, 636, "芝2200の1角");
  assertNear(toFinish(INNER_LAP, 2400) + FINISH_TO_CORNER, 836, "芝2400の1角");
  assertNear(toFinish(INNER_LAP, 2400) - toFinish(INNER_LAP, 2200), 200, "2400は2200の200m奥");
  assertNear(OUTER_STRAIGHT - toFinish(INNER_LAP, 2200), 82, "2200は外4角から");
  assertNear(toFinish(INNER_LAP, 2200) - INNER_STRAIGHT, 218, "2200から内4角");
  assertNear(toFinish(INNER_LAP, 2400) - OUTER_STRAIGHT, 118, "2400から外4角");
  assertNear(STRAIGHT_RACE - OUTER_STRAIGHT, 341, "直線1000は外4角の奥");
  assertNear(g.innerC4M - station(INNER_LAP, 2000), 18, "芝2000内は4角の手前");
  assertNear(g.outerC4M - station(OUTER_LAP, 3000), 118, "芝3000は直線の手前");
  assertNear(station(OUTER_LAP, 3200) - g.outerC3M, 75, "芝3200は3角から");
  assertNear(g.outerC4M - station(OUTER_LAP, 3200), 318, "芝3200から4角");
  assertNear(STRAIGHT_RACE - toFinish(OUTER_LAP, 3200), 23, "3200と直線1000");

  const p1200 = sampleAt(g.inner, station(INNER_LAP, 1200));
  const p1800 = sampleAt(g.outer, station(OUTER_LAP, 1800));
  if (hypot(p1200.x - p1800.x, p1200.y - p1800.y) > 2) throw new Error("芝1200と芝1800の発走がずれている");
  const pocketIn = turfPocket()[0];
  const pocketOut = backChute(sampleAt(g.outer, g.backJoinM), g.pocket)[0];
  if (hypot(pocketIn.x - pocketOut.x, pocketIn.y - pocketOut.y) > 2) throw new Error("1400内と2000外のポケットがずれている");
  if (pocketIn.x <= p1200.x) throw new Error("ポケットが2角の奥にない");

  const s2200 = sampleAt(g.straight, STRAIGHT_RACE - toFinish(INNER_LAP, 2200));
  const s2400 = sampleAt(g.straight, STRAIGHT_RACE - toFinish(INNER_LAP, 2400));
  const outer4 = sampleAt(g.outer, g.outerC4M);
  const inner4 = sampleAt(g.inner, g.innerC4M);
  if (!(s2200.x < inner4.x - 40 && s2200.x > outer4.x + 40)) throw new Error("芝2200が二つの4角の間にない");
  if (s2400.x >= outer4.x) throw new Error("芝2400が外4角の奥にない");
  if (g.straight[0].x >= s2400.x) throw new Error("直線1000が2400より奥にない");

  for (const p of g.outer) {
    if (p.m < g.splitM + 25 || p.m > g.outerJoinM - 25) continue;
    const inset = railInset(g.inner, p);
    if (inset > 8) throw new Error(`外回りが内に入っている ${inset.toFixed(1)} m=${p.m.toFixed(0)}`);
  }
  let innerNose = Infinity;
  let outerNose = Infinity;
  for (const p of g.inner) {
    if (p.m < g.innerC3M || p.m > g.innerC4M) continue;
    innerNose = Math.min(innerNose, p.x);
  }
  for (const p of g.outer) {
    if (p.m < g.outerC3M || p.m > g.outerC4M) continue;
    outerNose = Math.min(outerNose, p.x);
    if (p.y < 4 && p.x < outer4.x - 30) {
      throw new Error(
        `外の3〜4角が直線より下に出ている x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} m=${p.m.toFixed(0)} 外4=${outer4.x.toFixed(1)}`,
      );
    }
  }
  if (outerNose > innerNose - 40) throw new Error(`外の3〜4角が広がっていない ${outerNose.toFixed(0)} / ${innerNose.toFixed(0)}`);
  const branch = sampleAt(g.outer, (g.splitM + g.outerC3M) / 2);
  if (branch.y < g.innerR * 1.7) throw new Error("外回りの延長が向正面にない");
  if (branch.x > sampleAt(g.inner, g.innerC3M).x) throw new Error("外回りが分岐より手前で曲がっている");

  assertNear(g.dirtC3M - g.dirtBackJoinM, 425, "ダート向正面");
  assertNear(g.dirtPocket + (g.dirtC3M - g.dirtBackJoinM), 525, "ダート1200の3角");
  assertNear(g.dirtPocket + (DIRT_LAP - g.dirtBackJoinM), 1200, "ダート1200");
  assertNear(DIRT_LAP - station(DIRT_LAP, 1800) + DIRT_FINISH_TO_CORNER, 389, "ダート1800の1角");
  assertNear(station(DIRT_LAP, 1800) - g.dirtC4M, 26, "ダート1800は4角の先");
  assertNear(DIRT_LAP - station(DIRT_LAP, 1700) + DIRT_FINISH_TO_CORNER, 289, "ダート1700の1角");
  assertNear(station(DIRT_LAP, 1700) - g.dirtC4M, 126, "ダート1700は直線");
  assertNear(g.dirtC3M - station(DIRT_LAP, 1000), 325, "ダート1000の3角");
  assertNear(station(DIRT_LAP, 1000) - g.dirtBackJoinM, 100, "ダート1000は向正面");
  assertNear(g.dirtC3M - station(DIRT_LAP, 2500), 353, "ダート2500の3角");

  const chute1200 = dirtPocket();
  if (railInset(g.dirt, chute1200[0]) > -8) throw new Error("ダート1200の発走がダートの外にない");
  if (railInset(g.inner, chute1200[0]) > 6) throw new Error("ダート1200の発走が芝の内側に入っている");
  for (const p of turfPocket()) {
    if (railInset(g.inner, p) > 4) throw new Error("芝ポケットが内回りに入っている");
  }
  let dirtGap = Infinity;
  let dirtAt = g.dirt[0];
  for (const p of g.dirt) {
    const gap = railInset(g.inner, p);
    if (gap < dirtGap) {
      dirtGap = gap;
      dirtAt = p;
    }
  }
  if (dirtGap < 12) {
    throw new Error(`ダートが芝に近すぎる ${dirtGap.toFixed(1)} at (${dirtAt.x.toFixed(0)},${dirtAt.y.toFixed(0)}) m=${dirtAt.m.toFixed(0)}`);
  }

  const inner1200 = niigataTurf1200Run();
  const outer1600 = niigataTurf1600Run();
  const outer1800 = niigataTurf1800Run();
  assertNear(inner1200.corner3, 448, "芝1200の3角");
  assertNear(outer1600.corner3, 548, "芝1600の3角");
  assertNear(outer1800.corner3, 748, "芝1800の3角");
  assertNear(1200 - inner1200.straightFrom, INNER_STRAIGHT, "芝1200の直線");
  assertNear(1600 - outer1600.straightFrom, OUTER_STRAIGHT, "芝1600の直線");
  assertNear(1800 - outer1800.straightFrom, OUTER_STRAIGHT, "芝1800の直線");
  if (inner1200.hills.length !== 0) throw new Error("内回りの直線に坂を描いている");
  if (outer1600.hills.length < 1 || outer1800.hills.length < 1) throw new Error("外回りの上りがない");
  const at1200 = sampleAt(g.inner, station(INNER_LAP, 1200));
  if (hypot(inner1200.run[0].x - at1200.x, inner1200.run[0].y - at1200.y) > 1) {
    throw new Error("芝1200の発走が内回りの向正面にない");
  }
  for (const [run, meters, rail] of [
    [outer1600, 1600, g.outer],
    [outer1800, 1800, g.outer],
  ] as const) {
    const at = sampleAt(rail, station(OUTER_LAP, meters));
    if (hypot(run.run[0].x - at.x, run.run[0].y - at.y) > 1) throw new Error(`芝${meters}の発走が外回りにない`);
  }
  for (const run of [inner1200, outer1600, outer1800]) {
    if (!(140 < run.corner3 && run.corner3 < run.corner4 && run.corner4 < run.straightFrom)) {
      throw new Error(`新潟の並び 3角${run.corner3.toFixed(0)} 4角${run.corner4.toFixed(0)} 直線${run.straightFrom.toFixed(0)}`);
    }
    for (let i = 1; i < run.run.length; i += 1) {
      if (!(run.run[i].m > run.run[i - 1].m)) throw new Error("新潟の点列が戻っている");
    }
  }
  const ids = new Set(NIIGATA_TEMPLATES.map((item) => item.id));
  if (ids.size !== NIIGATA_TEMPLATES.length) throw new Error("テンプレートidが重複");
  for (const item of NIIGATA_TEMPLATES) {
    const map = presentNiigata(item.id);
    const [, , width, height] = map.viewBox.split(/\s+/).map(Number);
    for (const label of map.labels) {
      if (label.x < 8 || label.y < 12 || label.x > width - 8 || label.y > height - 12) {
        throw new Error(`${item.id} の${label.text}が図の外 (${label.x.toFixed(0)},${label.y.toFixed(0)})`);
      }
    }
  }
}

checkTemplates();
