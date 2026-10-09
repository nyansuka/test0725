import { asRaw, assembleFlat, spanOf, withSpan } from "@/domain/sim/flatPath";

/**
 * 小倉の平地テンプレート。障害コースは入れない。内・外の別はない。
 * Aコースの公表値（芝1615.1m・直線293m、ダート1445.4m・直線291.3m）。
 * 発走は、その距離をゴールからコースに沿って戻した位置。
 * ゴールから1角までを87.1mにし、芝1700の1角が172m、芝1800が272m、芝2000が472mになる。
 * 3角を895.1mにし、芝1000の3角が280m、芝1200の3角が480mになる。
 * 1〜2角を400mにし、3〜4角を長くしてスパイラルにする。向正面の上には山を乗せない。
 * 丘は2角。直線に坂はない。1200は2角の奥、2000は4角の奥のポケット。
 * ダートは芝の内側。ダート1000の3角が365m、ダート2400の3角が320m、ダート1700の1角が343m。
 * ダートは残り400mから直線にかけて緩い上り。右回りの向きは中山・阪神・京都・福島と同じ。
 */

export type SimTrack = "芝" | "ダート";

export type KokuraTemplate = {
  id: string;
  track: SimTrack;
  meters: number;
  badge: string;
  course: string;
  place: string;
  summary: string;
  bullets: string[];
  lap: number;
  rail: "turf" | "dirt";
};

const TURF_LAP = 1615.1;
const DIRT_LAP = 1445.4;
const TURF_STRAIGHT = 293;
const DIRT_STRAIGHT = 291.3;
/** 芝1800の1角。1700は100m短く172、2000のポケットは200m長く472 */
const TURF_1800_TO_C1 = 272;
const FINISH_TO_CORNER = TURF_1800_TO_C1 - (1800 - TURF_LAP);
/** 芝1000の3角。1200は200m長く480 */
const TURF_1000_TO_C3 = 280;
const TURF_C3 = TURF_LAP - 1000 + TURF_1000_TO_C3;
/** 1〜2角。向正面をホームに近づけ、1200のポケットを残す */
const TURF_LEFT = 400;
/** ダート1700の1角 */
const DIRT_1700_TO_C1 = 343;
const DIRT_FINISH_TO_CORNER = DIRT_1700_TO_C1 - (1700 - DIRT_LAP);
/** ダート1000の3角。2400はそれより短く320前後 */
const DIRT_1000_TO_C3 = 365;
const DIRT_C3 = DIRT_LAP - 1000 + DIRT_1000_TO_C3;
const DIRT_R = 96;

const SCALE = 0.74;
const PAD = 120;

type Pt = { x: number; y: number };
type Sample = Pt & { m: number; ix: number; iy: number };
type ScreenPt = { x: number; y: number; m: number; ox: number; oy: number };
type Range = { from: number; to: number };

type Built = {
  turf: Sample[];
  dirt: Sample[];
  backJoinM: number;
  straightJoinM: number;
  turfC3M: number;
  dirtBackJoinM: number;
  dirtStraightJoinM: number;
  dirtC3M: number;
  chute1200: number;
  chute2000: number;
  turfR: number;
  dirtR: number;
  turfHill: Range;
  dirtHill: Range;
  dirtHomeHill: Range;
  turfCornerM: { c1: number; c2: number; c3: number; c4: number };
  dirtCornerM: { c1: number; c2: number; c3: number; c4: number };
};

function hypot(dx: number, dy: number) {
  return Math.hypot(dx, dy);
}

function pushLine(out: Pt[], a: Pt, b: Pt, step = 4) {
  const len = hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.round(len / step));
  const start = out.length > 0 ? 1 : 0;
  for (let i = start; i <= n; i += 1) {
    const t = i / n;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
}

/** 右回り。角度は減らす */
function pushArc(out: Pt[], cx: number, cy: number, r: number, a0: number, sweep: number, step = 4) {
  const len = Math.abs(r * sweep);
  const n = Math.max(12, Math.round(len / step));
  const start = out.length > 0 ? 1 : 0;
  for (let i = start; i <= n; i += 1) {
    const a = a0 - sweep * (i / n);
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
}

function polyLen(pts: Pt[]) {
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) len += hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

/** 3〜4角。向正面の端から4角の出口まで、外へ膨らませて長さを合わせる。直線より下には出さない */
function spiralTurn(from: Pt, to: Pt, target: number): Pt[] {
  const r = (from.y - to.y) / 2;
  const sample = (bulge: number) => {
    const n = 96;
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      const ang = Math.PI / 2 - Math.PI * t;
      pts.push({
        x: from.x + (to.x - from.x) * t + bulge * Math.sin(Math.PI * t),
        y: to.y + r * (1 + Math.sin(ang)),
      });
    }
    return pts;
  };
  const base = polyLen(sample(0));
  if (base > target + 1) throw new Error(`3〜4角がすでに長い ${base.toFixed(1)} > ${target.toFixed(1)}`);
  let lo = 0;
  let hi = 420;
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

function buildTurf() {
  const back = TURF_C3 - FINISH_TO_CORNER - TURF_LEFT;
  const right = TURF_LAP - TURF_STRAIGHT - TURF_C3;
  const r = TURF_LEFT / Math.PI;
  const home = TURF_STRAIGHT + FINISH_TO_CORNER;
  const finish: Pt = { x: -TURF_STRAIGHT, y: 0 };
  const c1: Pt = { x: -home, y: 0 };
  const back0: Pt = { x: -home, y: 2 * r };
  const back1: Pt = { x: -home + back, y: 2 * r };
  const c4: Pt = { x: 0, y: 0 };
  const pts: Pt[] = [];
  pushLine(pts, finish, c1);
  pushArc(pts, c1.x, r, r, -Math.PI / 2, Math.PI);
  pushLine(pts, back0, back1);
  const turn = spiralTurn(back1, c4, right);
  for (let i = 1; i < turn.length; i += 1) pts.push(turn[i]);
  pushLine(pts, c4, finish);
  return { samples: withMeters(pts, TURF_LAP), r, back0, back1, c4 };
}

function buildDirt(turfR: number) {
  const dirtR = DIRT_R;
  const left = Math.PI * dirtR;
  const back = DIRT_C3 - DIRT_FINISH_TO_CORNER - left;
  const right = DIRT_LAP - DIRT_STRAIGHT - DIRT_C3;
  const dy = turfR - dirtR - 6;
  const home = DIRT_STRAIGHT + DIRT_FINISH_TO_CORNER;
  const dC4: Pt = { x: -10, y: dy };
  const dFinish: Pt = { x: dC4.x - DIRT_STRAIGHT, y: dy };
  const dC1: Pt = { x: dC4.x - home, y: dy };
  const back0: Pt = { x: dC1.x, y: dy + 2 * dirtR };
  const back1: Pt = { x: dC1.x + back, y: dy + 2 * dirtR };
  const pts: Pt[] = [];
  pushLine(pts, dFinish, dC1);
  pushArc(pts, dC1.x, dy + dirtR, dirtR, -Math.PI / 2, Math.PI);
  pushLine(pts, back0, back1);
  const turn = spiralTurn(back1, dC4, right);
  for (let i = 1; i < turn.length; i += 1) pts.push(turn[i]);
  pushLine(pts, dC4, dFinish);
  return { samples: withMeters(pts, DIRT_LAP), r: dirtR, back0, back1, c4: dC4 };
}

function buildGeometry(): Built {
  const turf = buildTurf();
  const dirt = buildDirt(turf.r);
  const backJoinM = nearestM(turf.samples, turf.back0);
  const straightJoinM = nearestM(turf.samples, turf.c4);
  const turfC3M = nearestM(turf.samples, turf.back1);
  const dirtBackJoinM = nearestM(dirt.samples, dirt.back0);
  const dirtStraightJoinM = nearestM(dirt.samples, dirt.c4);
  const dirtC3M = nearestM(dirt.samples, dirt.back1);
  const left = backJoinM - FINISH_TO_CORNER;
  const dirtLeft = dirtBackJoinM - DIRT_FINISH_TO_CORNER;

  return {
    turf: turf.samples,
    dirt: dirt.samples,
    backJoinM,
    straightJoinM,
    turfC3M,
    dirtBackJoinM,
    dirtStraightJoinM,
    dirtC3M,
    chute1200: 1200 - (TURF_LAP - backJoinM),
    chute2000: 2000 - TURF_LAP - (TURF_LAP - straightJoinM),
    turfR: turf.r,
    dirtR: dirt.r,
    turfHill: { from: backJoinM - 160, to: backJoinM + 24 },
    dirtHill: { from: dirtBackJoinM - 130, to: dirtBackJoinM + 16 },
    dirtHomeHill: { from: DIRT_LAP - 400, to: DIRT_LAP - 70 },
    turfCornerM: {
      c1: FINISH_TO_CORNER + left * 0.35,
      c2: FINISH_TO_CORNER + left * 0.58,
      c3: turfC3M + (straightJoinM - turfC3M) * 0.28,
      c4: turfC3M + (straightJoinM - turfC3M) * 0.72,
    },
    dirtCornerM: {
      c1: DIRT_FINISH_TO_CORNER + dirtLeft * 0.35,
      c2: DIRT_FINISH_TO_CORNER + dirtLeft * 0.58,
      c3: dirtC3M + (dirtStraightJoinM - dirtC3M) * 0.28,
      c4: dirtC3M + (dirtStraightJoinM - dirtC3M) * 0.72,
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

/** ホームストレッチを4角の奥へまっすぐ伸ばす */
function homeChute(join: Sample, length: number): Sample[] {
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

const GEOM = buildGeometry();

function lapPhrase(meters: number, lap: number) {
  if (meters + 0.05 < lap) return "ワンターン";
  const n = Math.floor((meters + 0.05) / lap);
  const rem = Math.round(meters - n * lap);
  if (rem <= 0) return `${n}周`;
  return `${n}周と${rem}m`;
}

export const KOKURA_TEMPLATES: KokuraTemplate[] = [
  {
    id: "turf-1000",
    track: "芝",
    meters: 1000,
    badge: "向",
    course: "芝",
    place: "向正面の2角寄り",
    summary: "向正面から。施行は少ない。",
    bullets: ["2角を出て向正面。3角まで280m。", "直線は293mで坂はない。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-1200",
    track: "芝",
    meters: 1200,
    badge: "ポケ",
    course: "ポケット",
    place: "2角奥のポケット",
    summary: "下りスタート。ハイでも前が残る。",
    bullets: ["2角の奥から。3角まで480m。丘の上から下る。", "直線は293mで坂はない。逃げ・先行が残りやすい。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-1700",
    track: "芝",
    meters: 1700,
    badge: "直線",
    course: "芝",
    place: "ゴール前",
    summary: "ゴール前から。1角まで短い。",
    bullets: ["ゴールまで85m。1角まで172m。", "1角から2角の丘へ上る。直線は293mで坂はない。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-1800",
    track: "芝",
    meters: 1800,
    badge: "直線",
    course: "芝",
    place: "スタンド前",
    summary: "1角まで短く、前と内枠。",
    bullets: [
      "ゴールの185m手前。1角まで272m。すぐ1角から丘へ上る。",
      "向正面の後半は下り、直線は293mで坂はない。内枠の逃げ・先行がロスなく先行できる。",
    ],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-2000",
    track: "芝",
    meters: 2000,
    badge: "ポケ",
    course: "ポケット",
    place: "4角奥のポケット",
    summary: "1800より1角まで長く、好位。差し一辺倒ではない。",
    bullets: ["4角の奥から。1角まで472m。1800より200m長い。", "直線は293mで坂はない。逃げ・先行が優勢で、まくりも水準以上。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-2600",
    track: "芝",
    meters: 2600,
    badge: "向",
    course: "芝",
    place: "向正面",
    summary: "施行が少ない長距離。サンプルは薄い。",
    bullets: ["向正面から。3角まで265m。1000より15m先。コーナーは6回。", "直線は293mで坂はない。初出走だけでは拾わない。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "dirt-1000",
    track: "ダート",
    meters: 1000,
    badge: "向",
    course: "ダート",
    place: "向正面の2角寄り",
    summary: "逃げが極端に残る。",
    bullets: [
      "2角を出て向正面へ下り。3角まで365m。",
      "直線は291.3m。残り400mから緩い上り。逃げの複勝は集計で約67〜79%。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1700",
    track: "ダート",
    meters: 1700,
    badge: "直線",
    course: "ダート",
    place: "4角を出てすぐ",
    summary: "小倉ダートの主距離。前が残る。",
    bullets: [
      "4角を出てすぐ、緩い上りの途中。ゴールまで255m。1角まで343m。",
      "2角の丘を越えると下り。直線は291.3m。逃げ・先行が厚い。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-2400",
    track: "ダート",
    meters: 2400,
    badge: "向",
    course: "ダート",
    place: "向正面",
    summary: "長距離ダート。施行は少ない。",
    bullets: ["向正面から。3角まで320m。コーナーは6回。", "直線は291.3m。距離のサンプルは薄い。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
];

export function kokuraTemplate(id: string) {
  return KOKURA_TEMPLATES.find((item) => item.id === id) ?? KOKURA_TEMPLATES[0];
}

export type MapLabel = { x: number; y: number; text: string };
export type MapLine = { x1: number; y1: number; x2: number; y2: number };

export type KokuraMap = {
  viewBox: string;
  turfD: string;
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
  GEOM.turf,
  GEOM.dirt,
  backChute(sampleAt(GEOM.turf, GEOM.backJoinM), GEOM.chute1200),
  homeChute(sampleAt(GEOM.turf, GEOM.straightJoinM), GEOM.chute2000),
]);

function pocketPaths(id: string): Sample[][] | null {
  const g = GEOM;
  if (id === "turf-1200") {
    return [backChute(sampleAt(g.turf, g.backJoinM), g.chute1200), slice(g.turf, g.backJoinM, TURF_LAP)];
  }
  if (id === "turf-2000") {
    return [homeChute(sampleAt(g.turf, g.straightJoinM), g.chute2000), g.turf];
  }
  return null;
}

function usedMeterPaths(template: KokuraTemplate): Sample[][] {
  const pocket = pocketPaths(template.id);
  if (pocket) return pocket;
  const rail = template.rail === "dirt" ? GEOM.dirt : GEOM.turf;
  const lap = rail[rail.length - 1].m;
  if (template.meters + 0.05 >= lap) return [rail];
  return [slice(rail, station(lap, template.meters), lap)];
}

function startSample(template: KokuraTemplate): Sample {
  const pocket = pocketPaths(template.id);
  if (pocket) return pocket[0][0];
  const rail = template.rail === "dirt" ? GEOM.dirt : GEOM.turf;
  return sampleAt(rail, station(rail[rail.length - 1].m, template.meters));
}

function finishSample(template: KokuraTemplate): Sample {
  if (template.track === "ダート") return sampleAt(GEOM.dirt, DIRT_LAP);
  return sampleAt(GEOM.turf, TURF_LAP);
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

function cornerLabels(template: KokuraTemplate, view: { turf: ScreenPt[]; dirt: ScreenPt[] }): MapLabel[] {
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
  const { c1, c2, c3, c4 } = g.turfCornerM;
  put(view.turf, c1, "1角");
  put(view.turf, c2, "2角");
  put(view.turf, c3, "3角");
  put(view.turf, c4, "4角");
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

let cachedScreens: { turf: ScreenPt[]; dirt: ScreenPt[]; viewBox: string } | null = null;

function screens() {
  if (cachedScreens) return cachedScreens;
  cachedScreens = {
    turf: screenSamples(GEOM.turf, FIT.shift),
    dirt: screenSamples(GEOM.dirt, FIT.shift),
    viewBox: FIT.viewBox,
  };
  return cachedScreens;
}

export function presentKokura(id: string): KokuraMap {
  const template = kokuraTemplate(id);
  const view = screens();
  const used = usedMeterPaths(template).map((pts) => pathD(screenSamples(pts, FIT.shift)));
  const hillRail = template.track === "ダート" ? GEOM.dirt : GEOM.turf;
  const hills = template.track === "ダート" ? [GEOM.dirtHill, GEOM.dirtHomeHill] : [GEOM.turfHill];
  const hillD = hills.map((hill) => pathD(screenSamples(slice(hillRail, hill.from, hill.to), FIT.shift))).join(" ");
  const startS = screenSamples([startSample(template)], FIT.shift)[0];
  const finishS = screenSamples([finishSample(template)], FIT.shift)[0];
  const labels = [
    ...cornerLabels(template, view),
    { x: startS.x + startS.ox * 28, y: startS.y + startS.oy * 28, text: "発走" },
    { x: finishS.x + finishS.ox * 28, y: finishS.y + finishS.oy * 28, text: "ゴール" },
  ];
  if (template.track === "ダート") {
    const crest = screenAt(view.dirt, GEOM.dirtBackJoinM);
    const rise = screenAt(view.dirt, (GEOM.dirtHomeHill.from + GEOM.dirtHomeHill.to) / 2);
    labels.push({ x: crest.x + crest.ox * 38, y: crest.y + crest.oy * 38, text: "丘" });
    labels.push({ x: rise.x + rise.ox * 26, y: rise.y + rise.oy * 26, text: "上り" });
  } else {
    const crest = screenAt(view.turf, GEOM.backJoinM);
    labels.push({ x: crest.x + crest.ox * 38, y: crest.y + crest.oy * 38, text: "丘" });
  }
  return {
    viewBox: view.viewBox,
    turfD: pathD(view.turf),
    dirtD: pathD(view.dirt),
    used,
    hillD,
    labels,
    start: bar(startS, 14),
    finish: bar(finishS, 16),
    title: `${template.track}${template.meters} ${template.course}`,
  };
}

export function kokuraRunPhrase(template: KokuraTemplate) {
  if (template.id === "turf-1200" || template.id === "turf-2000") return "ポケット";
  return lapPhrase(template.meters, template.lap);
}

export function kokuraStraight(template: KokuraTemplate) {
  return template.track === "ダート" ? "291.3m" : "293m";
}

export function kokuraLapLabel(template: KokuraTemplate) {
  return template.track === "ダート" ? "1445.4m" : "1615.1m";
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

function chuteApproach(join: Sample, length: number, back = 160): RunPoint[] {
  const n = Math.max(8, Math.round(back / 8));
  const pts: RunPoint[] = [];
  for (let i = 0; i <= n; i += 1) {
    const behind = length + back * (1 - i / n);
    pts.push(projectPoint({ x: join.x - behind, y: join.y, ix: join.ix, iy: join.iy }, (i / n) * back));
  }
  return pts;
}

function kokuraRun(meters: 1000 | 1200, origin: number, run: RunPoint[], idle: RunPoint[], approach: RunPoint[], pocketJoin: number) {
  const g = GEOM;
  const hill = onRun(g.turfHill.from, g.turfHill.to, origin, meters);
  return {
    run,
    idle,
    approach,
    pocketJoin,
    turnFrom: g.turfC3M - origin,
    corner3: g.turfCornerM.c3 - origin,
    corner4: g.turfCornerM.c4 - origin,
    straightFrom: TURF_LAP - TURF_STRAIGHT - origin,
    hillFrom: hill?.[0] ?? -1,
    hillTo: hill?.[1] ?? -1,
    hills: hill ? [hill] : [],
  };
}

/** 芝1000。丘を過ぎた向正面から。直線293mに坂はない。 */
export function kokuraTurf1000Run() {
  const g = GEOM;
  const startM = station(TURF_LAP, 1000);
  return kokuraRun(
    1000,
    startM,
    slice(g.turf, startM, TURF_LAP).map((p) => projectPoint(p, p.m - startM)),
    slice(g.turf, 0, startM).map((p) => projectPoint(p, p.m)),
    [],
    0,
  );
}

/**
 * 芝1200。2角の丘の上からポケットへ。直線に坂はない。
 * ゴールから本線を戻した位置には置かない。
 */
export function kokuraTurf1200Run() {
  const g = GEOM;
  const len = g.chute1200;
  const join = g.backJoinM;
  const joinPt = sampleAt(g.turf, join);
  const chute = backChute(joinPt, len);
  const last = chute.length - 1;
  const run = chute.map((p, i) => projectPoint(p, len * (i / last)));
  const rail = slice(g.turf, join, TURF_LAP);
  for (let i = 1; i < rail.length; i += 1) {
    const p = rail[i];
    run.push(projectPoint(p, len + (p.m - join)));
  }
  return kokuraRun(
    1200,
    join - len,
    run,
    slice(g.turf, 0, join).map((p) => projectPoint(p, p.m)),
    chuteApproach(joinPt, len),
    len,
  );
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
  assertNear(g.turf[g.turf.length - 1].m, TURF_LAP, "芝");
  assertNear(g.dirt[g.dirt.length - 1].m, DIRT_LAP, "ダート");
  assertNear(TURF_LAP - g.straightJoinM, TURF_STRAIGHT, "芝の直線");
  assertNear(DIRT_LAP - g.dirtStraightJoinM, DIRT_STRAIGHT, "ダートの直線");
  assertNear(g.turfC3M - station(TURF_LAP, 1000), TURF_1000_TO_C3, "芝1000の3角");
  assertNear(g.chute1200 + (g.turfC3M - g.backJoinM), TURF_1000_TO_C3 + 200, "芝1200の3角");
  assertNear(g.chute1200 + (TURF_LAP - g.backJoinM), 1200, "芝1200");
  assertNear(TURF_LAP - station(TURF_LAP, 1700), 1700 - TURF_LAP, "芝1700のゴールまで");
  assertNear(TURF_LAP - station(TURF_LAP, 1700) + FINISH_TO_CORNER, 172, "芝1700の1角");
  assertNear(TURF_LAP - station(TURF_LAP, 1800), 1800 - TURF_LAP, "芝1800のゴールまで");
  assertNear(TURF_LAP - station(TURF_LAP, 1800) + FINISH_TO_CORNER, TURF_1800_TO_C1, "芝1800の1角");
  assertNear(g.chute2000 + (TURF_LAP - g.straightJoinM) + FINISH_TO_CORNER, 472, "芝2000の1角");
  assertNear(g.chute2000 + (TURF_LAP - g.straightJoinM) + TURF_LAP, 2000, "芝2000");
  const toC1 = (meters: number) => TURF_LAP - station(TURF_LAP, meters) + FINISH_TO_CORNER;
  assertNear(
    g.chute2000 + (TURF_LAP - g.straightJoinM) + FINISH_TO_CORNER - toC1(1800),
    200,
    "2000は1800より200m長い",
  );
  const ahead = station(TURF_LAP, 2600) - station(TURF_LAP, 1000);
  assertNear(ahead, 1000 - (2600 - TURF_LAP), "芝2600は芝1000より先");
  assertNear(g.turfC3M - station(TURF_LAP, 2600), TURF_1000_TO_C3 - ahead, "芝2600の3角");
  const s1000 = station(TURF_LAP, 1000);
  const s2600 = station(TURF_LAP, 2600);
  if (!(s1000 > g.backJoinM && s1000 < g.turfC3M)) throw new Error("芝1000が向正面にない");
  if (!(s2600 > g.backJoinM && s2600 < g.turfC3M)) throw new Error("芝2600が向正面にない");
  if (s1000 - g.backJoinM > g.turfC3M - s1000) throw new Error("芝1000が向正面の3角寄り");
  if (s2600 <= s1000) throw new Error("芝2600が芝1000より手前");
  if (s1000 < g.turfHill.to) throw new Error("芝1000が丘の上から始まっている");
  const s1700 = station(TURF_LAP, 1700);
  const s1800 = station(TURF_LAP, 1800);
  if (!(s1700 > g.straightJoinM && s1700 < TURF_LAP)) throw new Error("芝1700が直線にない");
  if (!(s1800 > g.straightJoinM && s1800 < s1700)) throw new Error("芝1800がスタンド前にない");
  if (g.turfHill.to > g.straightJoinM) throw new Error("芝の丘が直線にかかっている");
  assertNear(DIRT_C3 - station(DIRT_LAP, 1000), DIRT_1000_TO_C3, "ダート1000の3角");
  assertNear(g.dirtC3M - station(DIRT_LAP, 2400), 320, "ダート2400の3角");
  assertNear(DIRT_LAP - station(DIRT_LAP, 1700), 1700 - DIRT_LAP, "ダート1700のゴールまで");
  assertNear(DIRT_LAP - station(DIRT_LAP, 1700) + DIRT_FINISH_TO_CORNER, DIRT_1700_TO_C1, "ダート1700の1角");
  const sDirt1000 = station(DIRT_LAP, 1000);
  const sDirt2400 = station(DIRT_LAP, 2400);
  const sDirt1700 = station(DIRT_LAP, 1700);
  if (!(sDirt1000 > g.dirtBackJoinM && sDirt1000 < g.dirtC3M)) throw new Error("ダート1000が向正面にない");
  if (!(sDirt2400 > sDirt1000 && sDirt2400 < g.dirtC3M)) throw new Error("ダート2400が向正面にない");
  if (!(sDirt1700 > g.dirtStraightJoinM && sDirt1700 < DIRT_LAP)) throw new Error("ダート1700が直線にない");
  if (sDirt1700 - g.dirtStraightJoinM > 50) throw new Error("ダート1700が4角の出口から遠い");
  if (!(sDirt1700 > g.dirtHomeHill.from && sDirt1700 < g.dirtHomeHill.to)) {
    throw new Error("ダート1700が緩い上りの途中にない");
  }
  if (sDirt1000 < g.dirtHill.to) throw new Error("ダート1000が丘の上から始まっている");
  const crest = sampleAt(g.turf, g.backJoinM);
  if (crest.y < g.turfR * 1.7) throw new Error("丘が2角にない");
  if (crest.x > -TURF_STRAIGHT) throw new Error("丘が向正面の途中にある");
  let maxY = -Infinity;
  for (const p of g.turf) maxY = Math.max(maxY, p.y);
  if (maxY > g.turfR * 2 + 2) throw new Error("向正面の上に山がある");
  const right = sampleAt(g.turf, (g.turfC3M + g.straightJoinM) / 2);
  if (right.x < g.turfR * 0.15) throw new Error("3〜4角が外へ膨らんでいない");
  if (right.y > g.turfR * 2 - 8) throw new Error("3〜4角が向正面の上に乗っている");
  const dirtRight = sampleAt(g.dirt, (g.dirtC3M + g.dirtStraightJoinM) / 2);
  if (dirtRight.x > right.x - 8) throw new Error("ダートの3〜4角が芝の外に出ている");
  const rise = sampleAt(g.dirt, (g.dirtHomeHill.from + g.dirtHomeHill.to) / 2);
  if (rise.y > g.dirtR) throw new Error("ダートの緩い上りが直線にない");
  if (rise.m < DIRT_LAP - DIRT_STRAIGHT) throw new Error("ダートの緩い上りが直線の手前だけにある");
  const chute1200 = backChute(sampleAt(g.turf, g.backJoinM), g.chute1200);
  const chute2000 = homeChute(sampleAt(g.turf, g.straightJoinM), g.chute2000);
  if (chute1200[0].x >= crest.x) throw new Error("芝1200のポケットが2角の奥にない");
  if (Math.abs(chute1200[0].y - crest.y) > 2) throw new Error("芝1200のポケットが丘の高さにない");
  if (chute2000[0].x <= 0) throw new Error("芝2000のポケットが4角の奥にない");
  for (const p of [...chute1200, ...chute2000]) {
    if (railInset(g.turf, p) > 3) throw new Error(`ポケットが芝の内側に入っている (${p.x.toFixed(0)},${p.y.toFixed(0)})`);
  }
  let dirtGap = Infinity;
  let dirtAt = g.dirt[0];
  for (const p of g.dirt) {
    const gap = railInset(g.turf, p);
    if (gap < dirtGap) {
      dirtGap = gap;
      dirtAt = p;
    }
  }
  if (dirtGap < 12) {
    throw new Error(`ダートが芝に近すぎる ${dirtGap.toFixed(1)} at (${dirtAt.x.toFixed(0)},${dirtAt.y.toFixed(0)}) m=${dirtAt.m.toFixed(0)}`);
  }
  const turf1000 = kokuraTurf1000Run();
  const turf1200 = kokuraTurf1200Run();
  assertNear(turf1000.turnFrom, TURF_1000_TO_C3, "芝1000の3角");
  assertNear(turf1200.turnFrom, TURF_1000_TO_C3 + 200, "芝1200の3角");
  assertNear(1000 - turf1000.straightFrom, TURF_STRAIGHT, "芝1000の直線");
  assertNear(1200 - turf1200.straightFrom, TURF_STRAIGHT, "芝1200の直線");
  if (turf1000.hills.length !== 0) throw new Error("芝1000の直線に坂を描いている");
  if (!(turf1200.hillTo > 0 && turf1200.hillTo < turf1200.turnFrom)) {
    throw new Error(`芝1200の丘が直線にある ${turf1200.hillTo.toFixed(0)}`);
  }
  if (!(turf1200.pocketJoin > 40 && turf1200.pocketJoin < 140)) {
    throw new Error(`芝1200のポケット ${turf1200.pocketJoin.toFixed(0)}`);
  }
  const walked = sampleAt(g.turf, station(TURF_LAP, 1200));
  if (hypot(turf1200.run[0].x - walked.x, turf1200.run[0].y - walked.y) < 20) {
    throw new Error("芝1200の発走が本線を戻した位置");
  }
  for (const run of [turf1000, turf1200]) {
    if (!(140 < run.corner3 && run.corner3 < run.corner4 && run.corner4 < run.straightFrom)) {
      throw new Error(`小倉の並び 3角${run.corner3.toFixed(0)} 4角${run.corner4.toFixed(0)} 直線${run.straightFrom.toFixed(0)}`);
    }
    for (let i = 1; i < run.run.length; i += 1) {
      if (!(run.run[i].m > run.run[i - 1].m)) throw new Error("小倉の点列が戻っている");
    }
  }
  const ids = new Set(KOKURA_TEMPLATES.map((item) => item.id));
  if (ids.size !== KOKURA_TEMPLATES.length) throw new Error("テンプレートidが重複");
  for (const item of KOKURA_TEMPLATES) {
    const map = presentKokura(item.id);
    const [, , width, height] = map.viewBox.split(/\s+/).map(Number);
    for (const label of map.labels) {
      if (label.x < 16 || label.y < 12 || label.x > width - 16 || label.y > height - 12) {
        throw new Error(`${item.id} の${label.text}が図の外 (${label.x.toFixed(0)},${label.y.toFixed(0)})`);
      }
    }
  }
}

checkTemplates();

/** 1700以上の芝と全ダート。直線は短く平坦なので上限は short */
export function kokuraFlatGeom(templateId: string) {
  const template = KOKURA_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return null;
  const g = GEOM;
  const dirt = template.track === "ダート";
  const rail = dirt ? g.dirt : g.turf;
  const lap = rail[rail.length - 1].m;
  const start = station(lap, template.meters);
  const head = asRaw(slice(rail, start, lap));
  const corners = dirt ? g.dirtCornerM : g.turfCornerM;
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
    straight: dirt ? DIRT_STRAIGHT : TURF_STRAIGHT,
    hillsBeforeFinish: [],
  });
}
