import { asRaw, assembleFlat, spanOf, withSpan } from "@/domain/sim/flatPath";

/**
 * 中京の平地テンプレート。障害コースは入れない。内・外の別はない。
 * Aコースの公表値（芝1705.9m・直線412.5m、ダート1530m・直線410.7m）。
 * 発走は、その距離をゴールからコースに沿って戻した位置。
 * ゴールから1角までを20mにし、芝2000の1角が314.1m、芝2200が514.1mになる。
 * 2角の出口を304.9mにし、芝1600の2角が199mになる。
 * 3角を821.4mにし、芝1200の3角が315.5m、芝1400の3角が515.5mになる。
 * その分、3〜4角を長くしてスパイラルにする。向正面の上には山を乗せない。
 * 上りは向正面の前半。急坂は直線の入口（残り340〜240m）。
 * 1600は1〜2角の外側を通り、2角の出口で本線に入る引き込み。140m地点はまだ引き込み。
 * 2200は4角の奥のポケット。
 * ダート1400だけ、2角の外側から芝を200m踏んで入る。3角まで580m。
 * 左回りの向きは東京と同じ。
 */

export type SimTrack = "芝" | "ダート";

export type ChukyoTemplate = {
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

const TURF_LAP = 1705.9;
const DIRT_LAP = 1530;
const TURF_STRAIGHT = 412.5;
const DIRT_STRAIGHT = 410.7;
/** ゴールから1角入口。芝2000の1角が314.1、芝2200が514.1 */
const FINISH_TO_CORNER = 20;
/** 2角の出口。芝1600の2角が199 */
const TURF_C2 = TURF_LAP - 1600 + 199;
/** 3角の入口。芝1200の3角が315.5、芝1400が515.5 */
const TURF_C3 = TURF_LAP - 1200 + 315.5;
const TURF_BACK = TURF_C3 - TURF_C2;
/** ダート1200の3角が380。1400の芝を200mにすると3角が580 */
const DIRT_TO_C3 = 380;
const DIRT_C3 = DIRT_LAP - 1200 + DIRT_TO_C3;
/** ダート1800の1角が298 */
const DIRT_FINISH_TO_CORNER = 28;
const DIRT_POCKET = 200;

const SCALE = 0.72;
const PAD = 108;
/** 1600は1〜2角の外側へ出す */
const TURF_1600_SIDE = 46;
/** 1400は2角の外側へ出す */
const DIRT_1400_SIDE = 72;

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
  join1600: number;
  chute1600: number;
  chute2200: number;
  dirtBackJoinM: number;
  dirtC3M: number;
  dirtJoin1400: number;
  turfR: number;
  dirtR: number;
  turfBackHill: Range;
  turfHomeHill: Range;
  dirtBackHill: Range;
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

/** 左回り。角度は増やす */
function pushArc(out: Pt[], cx: number, cy: number, r: number, a0: number, sweep: number, step = 4) {
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

/** 3〜4角。向正面の端から4角の出口まで、外（-x）へ膨らませて長さを合わせる。直線より下には出さない */
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
  let hi = 520;
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

function buildTurf() {
  const r = (TURF_C2 - FINISH_TO_CORNER) / Math.PI;
  const right = TURF_LAP - TURF_STRAIGHT - TURF_C3;
  const finish: Pt = { x: TURF_STRAIGHT, y: 0 };
  const c1: Pt = { x: TURF_STRAIGHT + FINISH_TO_CORNER, y: 0 };
  const back0: Pt = { x: c1.x, y: 2 * r };
  const back1: Pt = { x: c1.x - TURF_BACK, y: 2 * r };
  const c4: Pt = { x: 0, y: 0 };
  const pts: Pt[] = [];
  pushLine(pts, finish, c1);
  pushArc(pts, c1.x, r, r, -Math.PI / 2, Math.PI);
  pushLine(pts, back0, back1);
  const turn = spiralTurn(back1, c4, right);
  for (let i = 1; i < turn.length; i += 1) pts.push(turn[i]);
  pushLine(pts, c4, finish);
  return { samples: withMeters(pts, TURF_LAP), r, back0, c4 };
}

function buildDirt(turfR: number) {
  const dirtR = 70;
  const dy = 22;
  if (dy + 2 * dirtR > turfR * 2 - 12) throw new Error("ダートの向正面が芝に届く");
  const left = Math.PI * dirtR;
  const backJoin = DIRT_FINISH_TO_CORNER + left;
  const back = DIRT_C3 - backJoin;
  const right = DIRT_LAP - DIRT_STRAIGHT - DIRT_C3;
  const finishX = TURF_STRAIGHT - 16;
  const dFinish: Pt = { x: finishX, y: dy };
  const dC1: Pt = { x: finishX + DIRT_FINISH_TO_CORNER, y: dy };
  const back0: Pt = { x: dC1.x, y: dy + 2 * dirtR };
  const back1: Pt = { x: dC1.x - back, y: dy + 2 * dirtR };
  const dC4: Pt = { x: finishX - DIRT_STRAIGHT, y: dy };
  const pts: Pt[] = [];
  pushLine(pts, dFinish, dC1);
  pushArc(pts, dC1.x, dy + dirtR, dirtR, -Math.PI / 2, Math.PI);
  pushLine(pts, back0, back1);
  const turn = spiralTurn(back1, dC4, right);
  for (let i = 1; i < turn.length; i += 1) pts.push(turn[i]);
  pushLine(pts, dC4, dFinish);
  return { samples: withMeters(pts, DIRT_LAP), r: dirtR, back0 };
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
  const turf = buildTurf();
  const dirt = buildDirt(turf.r);
  const backJoinM = nearestM(turf.samples, turf.back0);
  const straightJoinM = nearestM(turf.samples, turf.c4);
  const dirtBackJoinM = nearestM(dirt.samples, dirt.back0);
  const turfC3M = backJoinM + TURF_BACK;
  const left = backJoinM - FINISH_TO_CORNER;
  const dirtLeft = dirtBackJoinM - DIRT_FINISH_TO_CORNER;
  // 2角の出口。中ほどで合流させると140m地点が本線に出てしまう
  const join1600 = backJoinM;
  const dirtStraightM = DIRT_LAP - DIRT_STRAIGHT;

  return {
    turf: turf.samples,
    dirt: dirt.samples,
    backJoinM,
    straightJoinM,
    turfC3M,
    join1600,
    chute1600: join1600 - (TURF_LAP - 1600),
    chute2200: 2200 - TURF_LAP - (TURF_LAP - straightJoinM),
    dirtBackJoinM,
    dirtC3M: DIRT_C3,
    dirtJoin1400: DIRT_LAP - 1200,
    turfR: turf.r,
    dirtR: dirt.r,
    turfBackHill: { from: backJoinM, to: backJoinM + TURF_BACK * 0.5 },
    turfHomeHill: { from: TURF_LAP - 340, to: TURF_LAP - 240 },
    dirtBackHill: { from: dirtBackJoinM, to: dirtBackJoinM + (DIRT_C3 - dirtBackJoinM) * 0.5 },
    dirtHomeHill: { from: DIRT_LAP - 380, to: DIRT_LAP - 220 },
    turfCornerM: {
      c1: FINISH_TO_CORNER + left * 0.35,
      c2: FINISH_TO_CORNER + left * 0.72,
      c3: turfC3M + (straightJoinM - turfC3M) * 0.28,
      c4: turfC3M + (straightJoinM - turfC3M) * 0.72,
    },
    dirtCornerM: {
      c1: DIRT_FINISH_TO_CORNER + dirtLeft * 0.35,
      c2: DIRT_FINISH_TO_CORNER + dirtLeft * 0.72,
      c3: DIRT_C3 + (dirtStraightM - DIRT_C3) * 0.28,
      c4: DIRT_C3 + (dirtStraightM - DIRT_C3) * 0.72,
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

/** ホームストレッチを4角の奥へまっすぐ伸ばす。左回りなので -x */
function homeChute(join: Sample, length: number): Sample[] {
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

export const CHUKYO_TEMPLATES: ChukyoTemplate[] = [
  {
    id: "turf-1200",
    track: "芝",
    meters: 1200,
    badge: "向",
    course: "芝",
    place: "向正面",
    summary: "向正面の上りから。直線の入口に坂。",
    bullets: ["2角を出て向正面。3角まで316m。スタートから上る。", "直線は412.5m。入口に坂がある。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-1300",
    track: "芝",
    meters: 1300,
    badge: "向",
    course: "芝",
    place: "向正面、2角寄り",
    summary: "2角を回って向正面へ。1200の100m手前。",
    bullets: ["向正面。3角まで416m。1200より100m後ろ。", "直線は412.5m。入口に坂がある。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-1400",
    track: "芝",
    meters: 1400,
    badge: "向",
    course: "芝",
    place: "2角の出口",
    summary: "2角を出たところ。1200より200m後ろ。",
    bullets: ["向正面の入り口。3角まで516m。", "直線は412.5m。入口に坂がある。テンは速くなりやすい。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-1600",
    track: "芝",
    meters: 1600,
    badge: "引",
    course: "引き込み",
    place: "1〜2角の引き込み",
    summary: "引き込みから。2角の出口で本線。",
    bullets: ["1〜2角の外側を通る。140m地点はまだ引き込み。", "2角の出口で本線に入る。2角まで199m。直線は412.5m。入口に坂がある。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-2000",
    track: "芝",
    meters: 2000,
    badge: "坂",
    course: "芝",
    place: "直線の坂の途中",
    summary: "坂の途中から。1角まで短い。",
    bullets: ["直線の坂の途中。ゴールまで294m。1角まで314m。", "直線は412.5m。ペースは上がりにくい。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-2200",
    track: "芝",
    meters: 2200,
    badge: "ポケ",
    course: "ポケット",
    place: "4角奥のポケット",
    summary: "4角の奥から。2000より200m後ろ。",
    bullets: ["4角の奥から直線へ。1角まで514m。2000より200m長い。", "スタート後に坂を登る。直線は412.5m。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-3000",
    track: "芝",
    meters: 3000,
    badge: "向",
    course: "芝",
    place: "向正面、2角寄り",
    summary: "向正面から1周半。坂を2回登る。",
    bullets: ["2角を出て向正面。3角まで410m。1300のすぐ先。", "坂は2回。直線は412.5m。施行は少ない。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "dirt-1200",
    track: "ダート",
    meters: 1200,
    badge: "向",
    course: "ダート",
    place: "向正面",
    summary: "2角を出て向正面の上りへ。",
    bullets: ["2角を出て向正面。3角まで380m。スタートから上る。", "直線は410.7m。入口に坂がある。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1400",
    track: "ダート",
    meters: 1400,
    badge: "芝発",
    course: "芝スタート",
    place: "2角の外側",
    summary: "この距離だけ芝スタート。外枠は芝が長い。",
    bullets: ["2角の外側から芝を200m踏んでダートへ。3角まで580m。", "直線は410.7m。入口に坂がある。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1800",
    track: "ダート",
    meters: 1800,
    badge: "坂",
    course: "ダート",
    place: "直線の坂の途中",
    summary: "坂の途中から。1角まで短い。",
    bullets: ["直線の坂の途中。ゴールまで270m。1角まで298m。", "直線は410.7m。前が残りやすい。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1900",
    track: "ダート",
    meters: 1900,
    badge: "坂",
    course: "ダート",
    place: "直線の坂の入口",
    summary: "1800より100m後ろ。発走してすぐ坂。",
    bullets: ["坂の入口。ゴールまで370m。1800より100m長い。", "直線は410.7m。差し最有利にはしない。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-2500",
    track: "ダート",
    meters: 2500,
    badge: "向",
    course: "ダート",
    place: "向正面の下り",
    summary: "向正面の頂点を過ぎてから。施行は少ない。",
    bullets: ["向正面。3角まで150m。スタート後は下り。", "直線は410.7m。坂は2回。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
];

export function chukyoTemplate(id: string) {
  return CHUKYO_TEMPLATES.find((item) => item.id === id) ?? CHUKYO_TEMPLATES[0];
}

export type MapLabel = { x: number; y: number; text: string };
export type MapLine = { x1: number; y1: number; x2: number; y2: number };

export type ChukyoMap = {
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
  chute(GEOM.turf, GEOM.join1600, GEOM.chute1600, TURF_1600_SIDE),
  homeChute(sampleAt(GEOM.turf, GEOM.straightJoinM), GEOM.chute2200),
  chute(GEOM.dirt, GEOM.dirtJoin1400, DIRT_POCKET, DIRT_1400_SIDE),
]);

function pocketPaths(id: string): Sample[][] | null {
  const g = GEOM;
  if (id === "turf-1600") {
    return [chute(g.turf, g.join1600, g.chute1600, TURF_1600_SIDE), slice(g.turf, g.join1600, TURF_LAP)];
  }
  if (id === "turf-2200") {
    return [homeChute(sampleAt(g.turf, g.straightJoinM), g.chute2200), g.turf];
  }
  if (id === "dirt-1400") {
    return [chute(g.dirt, g.dirtJoin1400, DIRT_POCKET, DIRT_1400_SIDE), slice(g.dirt, g.dirtJoin1400, DIRT_LAP)];
  }
  return null;
}

function usedMeterPaths(template: ChukyoTemplate): Sample[][] {
  const pocket = pocketPaths(template.id);
  if (pocket) return pocket;
  const rail = template.rail === "dirt" ? GEOM.dirt : GEOM.turf;
  const lap = rail[rail.length - 1].m;
  if (template.meters + 0.05 >= lap) return [rail];
  return [slice(rail, station(lap, template.meters), lap)];
}

function startSample(template: ChukyoTemplate): Sample {
  const pocket = pocketPaths(template.id);
  if (pocket) return pocket[0][0];
  const rail = template.rail === "dirt" ? GEOM.dirt : GEOM.turf;
  return sampleAt(rail, station(rail[rail.length - 1].m, template.meters));
}

function finishSample(template: ChukyoTemplate): Sample {
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

function cornerLabels(template: ChukyoTemplate, view: { turf: ScreenPt[]; dirt: ScreenPt[] }): MapLabel[] {
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

export function presentChukyo(id: string): ChukyoMap {
  const template = chukyoTemplate(id);
  const view = screens();
  const used = usedMeterPaths(template).map((pts) => pathD(screenSamples(pts, FIT.shift)));
  const backHill = template.track === "ダート" ? GEOM.dirtBackHill : GEOM.turfBackHill;
  const homeHill = template.track === "ダート" ? GEOM.dirtHomeHill : GEOM.turfHomeHill;
  const hillRail = template.track === "ダート" ? GEOM.dirt : GEOM.turf;
  const hillView = template.track === "ダート" ? view.dirt : view.turf;
  const hillD = [backHill, homeHill]
    .map((hill) => pathD(screenSamples(slice(hillRail, hill.from, hill.to), FIT.shift)))
    .join(" ");
  const startS = screenSamples([startSample(template)], FIT.shift)[0];
  const finishS = screenSamples([finishSample(template)], FIT.shift)[0];
  const backAt = screenAt(hillView, backHill.from + (backHill.to - backHill.from) * 0.22);
  const homeAt = screenAt(hillView, (homeHill.from + homeHill.to) / 2);
  const labels = [
    ...cornerLabels(template, view),
    { x: startS.x + startS.ox * 28, y: startS.y + startS.oy * 28, text: "発走" },
    { x: finishS.x + finishS.ox * 28, y: finishS.y + finishS.oy * 28, text: "ゴール" },
    { x: backAt.x - backAt.ox * 22, y: backAt.y - backAt.oy * 22, text: "上り" },
    { x: homeAt.x - homeAt.ox * 20, y: homeAt.y - homeAt.oy * 20, text: "坂" },
  ];
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

export function chukyoRunPhrase(template: ChukyoTemplate) {
  if (template.id === "turf-1600") return "引き込み";
  if (template.id === "turf-2200") return "ポケット";
  if (template.id === "dirt-1400") return "芝スタート";
  return lapPhrase(template.meters, template.lap);
}

export function chukyoStraight(template: ChukyoTemplate) {
  return template.track === "ダート" ? "410.7m" : "412.5m";
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

/**
 * 芝1200・1300・1400。向正面から本線をゴールまで。直線は412.5m。
 * 急坂は直線の入口。1600の引き込みはここには入れない。
 */
function chukyoTurfOneTurn(meters: 1200 | 1300 | 1400) {
  const g = GEOM;
  const startM = station(TURF_LAP, meters);
  const hills = [onRun(g.turfBackHill.from, g.turfBackHill.to, startM, meters), onRun(g.turfHomeHill.from, g.turfHomeHill.to, startM, meters)].filter(
    (hill): hill is [number, number] => hill != null,
  );
  const home = hills[hills.length - 1];
  return {
    run: slice(g.turf, startM, TURF_LAP).map((p) => projectPoint(p, p.m - startM)),
    idle: slice(g.turf, 0, startM).map((p) => projectPoint(p, p.m)),
    approach: [] as RunPoint[],
    opening: meters === 1400 ? ("long" as const) : ("rise" as const),
    turnFrom: g.turfC3M - startM,
    corner3: g.turfCornerM.c3 - startM,
    corner4: g.turfCornerM.c4 - startM,
    straightFrom: TURF_LAP - TURF_STRAIGHT - startM,
    homeFrom: home?.[0] ?? 0,
    homeTo: home?.[1] ?? 0,
    hills,
  };
}

export function chukyoTurf1200Run() {
  return chukyoTurfOneTurn(1200);
}

export function chukyoTurf1300Run() {
  return chukyoTurfOneTurn(1300);
}

export function chukyoTurf1400Run() {
  return chukyoTurfOneTurn(1400);
}

/** 引き込みの端のさらに後ろ。本線を戻した位置には載せない */
function leadApproach(start: Sample, next: Sample, back = 160) {
  const dx = start.x - next.x;
  const dy = start.y - next.y;
  const v = hypot(dx, dy) || 1;
  const n = Math.max(8, Math.round(back / 8));
  const pts: RunPoint[] = [];
  for (let i = 0; i <= n; i += 1) {
    const behind = back * (1 - i / n);
    pts.push({
      m: (i / n) * back,
      x: start.x + (dx / v) * behind,
      y: start.y + (dy / v) * behind,
      ix: start.ix,
      iy: start.iy,
    });
  }
  return pts;
}

/**
 * 芝1600。1〜2角の外側の引き込みから、2角の出口で本線に入る。
 * 140m地点はまだ引き込み。ゴールから本線を戻した位置には置かない。
 * 直線は412.5m。急坂は直線の入口。
 */
export function chukyoTurf1600Run() {
  const g = GEOM;
  const len = g.chute1600;
  const join = g.join1600;
  const pocket = chute(g.turf, join, len, TURF_1600_SIDE);
  const last = pocket.length - 1;
  const run = pocket.map((p, i) => projectPoint(p, len * (i / last)));
  const rail = slice(g.turf, join, TURF_LAP);
  for (let i = 1; i < rail.length; i += 1) {
    const p = rail[i];
    const atEnd = i === rail.length - 1;
    run.push(projectPoint(p, atEnd ? 1600 : len + (p.m - join)));
  }
  const race = (railM: number) => len + (railM - join);
  const hills = [g.turfBackHill, g.turfHomeHill]
    .map((hill) => {
      const from = Math.max(len, race(hill.from));
      const to = Math.min(1600, race(hill.to));
      return to - from >= 12 ? ([from, to] as [number, number]) : null;
    })
    .filter((hill): hill is [number, number] => hill != null);
  const home = hills[hills.length - 1];
  return {
    run,
    idle: slice(g.turf, 0, join).map((p) => projectPoint(p, p.m)),
    approach: leadApproach(pocket[0], pocket[Math.min(3, last)]),
    join: len,
    corner3: race(g.turfCornerM.c3),
    corner4: race(g.turfCornerM.c4),
    straightFrom: race(TURF_LAP - TURF_STRAIGHT),
    homeFrom: home?.[0] ?? 0,
    homeTo: home?.[1] ?? 0,
    hills,
  };
}

function assertNear(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 3) {
    throw new Error(`${label}: ${actual.toFixed(1)} ≠ ${expected}`);
  }
}

function runPoint(run: RunPoint[], meter: number) {
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
  assertNear(g.turfC3M - station(TURF_LAP, 1200), 315.5, "芝1200の3角");
  assertNear(g.turfC3M - station(TURF_LAP, 1300), 415.5, "芝1300の3角");
  assertNear(g.turfC3M - station(TURF_LAP, 1400), 515.5, "芝1400の3角");
  assertNear(station(TURF_LAP, 1200) - station(TURF_LAP, 1400), 200, "1400は1200より200m後ろ");
  assertNear(station(TURF_LAP, 1200) - station(TURF_LAP, 1300), 100, "1300は1200より100m後ろ");
  assertNear(g.chute1600 + (g.backJoinM - g.join1600), 199, "芝1600の2角");
  assertNear(g.chute1600 + (TURF_LAP - g.join1600), 1600, "芝1600");
  assertNear(TURF_LAP - station(TURF_LAP, 2000), 294.1, "芝2000のゴールまで");
  assertNear(TURF_LAP - station(TURF_LAP, 2000) + FINISH_TO_CORNER, 314.1, "芝2000の1角");
  assertNear(g.chute2200 + (TURF_LAP - g.straightJoinM) + FINISH_TO_CORNER, 514.1, "芝2200の1角");
  assertNear(g.chute2200 + (TURF_LAP - g.straightJoinM) + TURF_LAP, 2200, "芝2200");
  assertNear(
    g.chute2200 + (TURF_LAP - g.straightJoinM) + FINISH_TO_CORNER - (TURF_LAP - station(TURF_LAP, 2000) + FINISH_TO_CORNER),
    200,
    "2200は2000より200m長い",
  );
  assertNear(g.turfC3M - station(TURF_LAP, 3000), 409.6, "芝3000の3角");
  const s1200 = station(TURF_LAP, 1200);
  const s1300 = station(TURF_LAP, 1300);
  const s1400 = station(TURF_LAP, 1400);
  const s3000 = station(TURF_LAP, 3000);
  if (!(s1400 > g.backJoinM && s1400 < g.turfC3M)) throw new Error("芝1400が向正面にない");
  if (!(s1300 > g.backJoinM && s1300 < g.turfBackHill.to)) throw new Error("芝1300が上りにない");
  if (!(s1200 > g.backJoinM && s1200 < g.turfBackHill.to)) throw new Error("芝1200が上りにない");
  if (!(s3000 > s1300 && s3000 < s1200)) throw new Error("芝3000が1300と1200の間にない");
  const s2000 = station(TURF_LAP, 2000);
  if (!(s2000 > g.turfHomeHill.from && s2000 < g.turfHomeHill.to)) throw new Error("芝2000が坂の途中にない");
  if (!(g.turfHomeHill.from > g.straightJoinM && g.turfHomeHill.to < TURF_LAP)) throw new Error("芝の坂が直線にない");
  assertNear(DIRT_C3 - station(DIRT_LAP, 1200), 380, "ダート1200の3角");
  assertNear(DIRT_POCKET + (DIRT_C3 - g.dirtJoin1400), 580, "ダート1400の3角");
  assertNear(DIRT_POCKET + (DIRT_LAP - g.dirtJoin1400), 1400, "ダート1400");
  assertNear(DIRT_LAP - station(DIRT_LAP, 1800), 270, "ダート1800のゴールまで");
  assertNear(DIRT_LAP - station(DIRT_LAP, 1800) + DIRT_FINISH_TO_CORNER, 298, "ダート1800の1角");
  assertNear(DIRT_LAP - station(DIRT_LAP, 1900), 370, "ダート1900のゴールまで");
  assertNear(station(DIRT_LAP, 1800) - station(DIRT_LAP, 1900), 100, "1900は1800より100m後ろ");
  assertNear(DIRT_C3 - station(DIRT_LAP, 2500), 150, "ダート2500の3角");
  const sDirt1200 = station(DIRT_LAP, 1200);
  const sDirt1800 = station(DIRT_LAP, 1800);
  const sDirt1900 = station(DIRT_LAP, 1900);
  const sDirt2500 = station(DIRT_LAP, 2500);
  if (!(sDirt1200 > g.dirtBackJoinM && sDirt1200 < g.dirtBackHill.to)) throw new Error("ダート1200が上りにない");
  if (!(sDirt2500 > g.dirtBackHill.to && sDirt2500 < DIRT_C3)) throw new Error("ダート2500が下りにない");
  if (!(sDirt1800 > g.dirtHomeHill.from && sDirt1800 < g.dirtHomeHill.to)) throw new Error("ダート1800が坂の途中にない");
  if (!(sDirt1900 > g.dirtHomeHill.from && sDirt1900 < sDirt1800)) throw new Error("ダート1900が坂の入口にない");
  const backHill = sampleAt(g.turf, (g.turfBackHill.from + g.turfBackHill.to) / 2);
  const homeHill = sampleAt(g.turf, (g.turfHomeHill.from + g.turfHomeHill.to) / 2);
  if (backHill.y < g.turfR) throw new Error("向正面の上りが向正面にない");
  if (homeHill.y > g.turfR * 0.35) throw new Error("直線の坂が直線にない");
  const chute1600 = chute(g.turf, g.join1600, g.chute1600, TURF_1600_SIDE);
  const chute2200 = homeChute(sampleAt(g.turf, g.straightJoinM), g.chute2200);
  const chute1400 = chute(g.dirt, g.dirtJoin1400, DIRT_POCKET, DIRT_1400_SIDE);
  if (chute2200[0].x >= 0) throw new Error("芝2200のポケットが4角の奥にない");
  if (railInset(g.turf, chute1600[0]) > -8) throw new Error("芝1600の発走が芝の外側にない");
  for (const p of chute1600) {
    if (railInset(g.turf, p) > 3) throw new Error(`芝1600の引き込みが内側に入っている (${p.x.toFixed(0)},${p.y.toFixed(0)})`);
  }
  const turf1600 = chukyoTurf1600Run();
  const walked1600 = sampleAt(g.turf, TURF_LAP - 1600);
  assertNear(turf1600.run[turf1600.run.length - 1].m, 1600, "芝1600走行のゴール");
  assertNear(turf1600.join, 199, "芝1600の引き込み");
  assertNear(1600 - turf1600.straightFrom, TURF_STRAIGHT, "芝1600の直線");
  if (!(140 < turf1600.join && turf1600.join < turf1600.corner3 && turf1600.corner3 < turf1600.corner4)) {
    throw new Error(`芝1600の引き込み ${turf1600.join.toFixed(0)}`);
  }
  if (!(turf1600.corner4 < turf1600.straightFrom && turf1600.straightFrom < turf1600.homeFrom && turf1600.homeTo < 1600)) {
    throw new Error(`芝1600の急坂が直線にない ${turf1600.homeFrom.toFixed(0)}`);
  }
  const at1600 = runPoint(turf1600.run, 140);
  if (railInset(g.turf, at1600) > -4) throw new Error("芝1600の140mが本線にいる");
  if (hypot(turf1600.run[0].x - walked1600.x, turf1600.run[0].y - walked1600.y) < 20) {
    throw new Error("芝1600の引き込みが本線の戻り位置にある");
  }
  const atJoin1600 = runPoint(turf1600.run, turf1600.join);
  const join1600Pt = sampleAt(g.turf, g.join1600);
  if (hypot(atJoin1600.x - join1600Pt.x, atJoin1600.y - join1600Pt.y) > 2) throw new Error("芝1600の本線が2角の出口にない");
  const gate1600 = turf1600.approach[turf1600.approach.length - 1];
  if (hypot(gate1600.x - turf1600.run[0].x, gate1600.y - turf1600.run[0].y) > 1) {
    throw new Error("芝1600のゲートが引き込みの後ろにない");
  }
  if (!turf1600.run.every((point, index) => index === 0 || point.m > turf1600.run[index - 1].m)) {
    throw new Error("芝1600の点列が戻っている");
  }
  for (const p of chute2200) {
    if (railInset(g.turf, p) > 3) throw new Error(`芝2200のポケットが内側に入っている (${p.x.toFixed(0)},${p.y.toFixed(0)})`);
  }
  if (railInset(g.turf, chute1400[0]) > 8) throw new Error("ダート1400の発走が芝の外側にない");
  if (railInset(g.dirt, chute1400[0]) > -8) throw new Error("ダート1400の発走がダートに近すぎる");
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
  for (const p of g.dirt) {
    if (railInset(g.turf, p) < 8) {
      throw new Error(`ダートが芝の外に出ている ${railInset(g.turf, p).toFixed(1)} m=${p.m.toFixed(0)}`);
    }
  }
  const right = sampleAt(g.turf, (g.turfC3M + g.straightJoinM) / 2);
  const c3 = sampleAt(g.turf, g.turfC3M);
  const c4 = sampleAt(g.turf, g.straightJoinM);
  if (right.x > Math.min(c3.x, c4.x) - 40) throw new Error("3〜4角が外へ膨らんでいない");
  if (right.y < 4) throw new Error("3〜4角が直線より下に出ている");
  for (const meters of [1200, 1300, 1400] as const) {
    const run = chukyoTurfOneTurn(meters);
    assertNear(run.run[run.run.length - 1].m, meters, `芝${meters}走行のゴール`);
    assertNear(run.turnFrom, meters === 1200 ? 315.5 : meters === 1300 ? 415.5 : 515.5, `芝${meters}の3角`);
    assertNear(meters - run.straightFrom, TURF_STRAIGHT, `芝${meters}の直線`);
    if (!(run.straightFrom < run.homeFrom && run.homeTo < meters)) {
      throw new Error(`芝${meters}の急坂が直線にない ${run.homeFrom.toFixed(0)}`);
    }
    if (!(140 < run.corner3 && run.corner3 < run.corner4 && run.corner4 < run.straightFrom)) {
      throw new Error(`中京芝${meters}の並び 3角${run.corner3.toFixed(0)}`);
    }
    const at = sampleAt(g.turf, station(TURF_LAP, meters));
    if (hypot(run.run[0].x - at.x, run.run[0].y - at.y) > 1) throw new Error(`芝${meters}の発走が向正面にない`);
    for (let i = 1; i < run.run.length; i += 1) {
      if (!(run.run[i].m > run.run[i - 1].m)) throw new Error(`中京芝${meters}の点列が戻っている`);
    }
  }
  const ids = new Set(CHUKYO_TEMPLATES.map((item) => item.id));
  if (ids.size !== CHUKYO_TEMPLATES.length) throw new Error("テンプレートidが重複");
  for (const item of CHUKYO_TEMPLATES) {
    const map = presentChukyo(item.id);
    const [, , width, height] = map.viewBox.split(/\s+/).map(Number);
    for (const label of map.labels) {
      if (label.x < 16 || label.y < 12 || label.x > width - 16 || label.y > height - 12) {
        throw new Error(`${item.id} の${label.text}が図の外 (${label.x.toFixed(0)},${label.y.toFixed(0)})`);
      }
    }
  }
}

checkTemplates();

/** 2000以上の芝と全ダート。1600の引き込みは既存の台本のまま */
export function chukyoFlatGeom(templateId: string) {
  const template = CHUKYO_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return null;
  const g = GEOM;
  if (template.id === "turf-2200") {
    const chutePts = withSpan(homeChute(sampleAt(g.turf, g.straightJoinM), g.chute2200), g.chute2200);
    const after = asRaw(slice(g.turf, g.straightJoinM, TURF_LAP));
    return assembleFlat({
      meters: template.meters,
      head: [chutePts, after],
      loop: g.chute2200 + spanOf(after) + 8 < template.meters ? asRaw(g.turf) : null,
      resume: 0,
      lap: TURF_LAP,
      finishJoinRace: g.chute2200,
      finishJoinRail: g.straightJoinM,
      c1: g.turfCornerM.c1,
      c3: g.turfCornerM.c3,
      c4: g.turfCornerM.c4,
      straight: TURF_STRAIGHT,
      hillsBeforeFinish: [],
    });
  }
  if (template.id === "dirt-1400") {
    const chutePts = withSpan(chute(g.dirt, g.dirtJoin1400, DIRT_POCKET, DIRT_1400_SIDE), DIRT_POCKET);
    const after = asRaw(slice(g.dirt, g.dirtJoin1400, DIRT_LAP));
    return assembleFlat({
      meters: template.meters,
      head: [chutePts, after],
      loop: DIRT_POCKET + spanOf(after) + 8 < template.meters ? asRaw(g.dirt) : null,
      resume: 0,
      lap: DIRT_LAP,
      finishJoinRace: DIRT_POCKET,
      finishJoinRail: g.dirtJoin1400,
      c1: g.dirtCornerM.c1,
      c3: g.dirtCornerM.c3,
      c4: g.dirtCornerM.c4,
      straight: DIRT_STRAIGHT,
      hillsBeforeFinish: [],
    });
  }
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
