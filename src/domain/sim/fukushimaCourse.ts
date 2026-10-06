/**
 * 福島の平地テンプレート。障害コースは入れない。内・外の別はない。
 * Aコースの公表値（芝1600m・直線292.0m、ダート1444.6m・直線295.7m）。
 * 発走は、その距離をゴールからコースに沿って戻した位置。
 * ゴールから1角までを105mにし、芝1700の1角が205m、芝1800が305m、芝2000が505mになる。
 * 向正面を304mにし、芝1000の3角が212m、芝1200の3角が412mになる。
 * その分、3〜4角を長くしてスパイラルにする。向正面の上には山を乗せない。
 * 上りは向正面と、直線の残り170〜50m。1200は2角の奥、2000は4角の奥のポケット。
 * ダート1150だけ、2角の外側から芝を踏んで入る。
 * 右回りの向きは中山・阪神・京都と同じ。
 */

export type SimTrack = "芝" | "ダート";

export type FukushimaTemplate = {
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

const TURF_LAP = 1600;
const DIRT_LAP = 1444.6;
const TURF_STRAIGHT = 292;
const DIRT_STRAIGHT = 295.7;
/** ゴールから1角入口。芝1700の1角が205m、芝1800が305m、芝2000が505m */
const FINISH_TO_CORNER = 105;
/** ダート1700の1角が338m */
const DIRT_FINISH_TO_CORNER = 82.6;
/** 向正面。芝1000の3角が212m、芝1200の3角が412m */
const TURF_BACK = 304;
/** ダート1000の3角が330m、ダート1150の3角が480m */
const DIRT_C3 = DIRT_LAP - 1000 + 330;
const HOME = TURF_STRAIGHT + FINISH_TO_CORNER;
const DIRT_HOME = DIRT_STRAIGHT + DIRT_FINISH_TO_CORNER;

const SCALE = 0.8;
const PAD = 108;
/** 1150は2角の外側へ出す */
const DIRT_1150_SIDE = 52;

type Pt = { x: number; y: number };
type Sample = Pt & { m: number; ix: number; iy: number };
type ScreenPt = { x: number; y: number; m: number; ox: number; oy: number };
type Range = { from: number; to: number };

type Built = {
  turf: Sample[];
  dirt: Sample[];
  backJoinM: number;
  straightJoinM: number;
  dirtBackJoinM: number;
  chute1200: number;
  chute2000: number;
  chute1150: number;
  chute1150Join: number;
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
  const backJoin = TURF_LAP / 2 - TURF_STRAIGHT;
  const left = backJoin - FINISH_TO_CORNER;
  const right = TURF_LAP - FINISH_TO_CORNER - left - TURF_BACK - TURF_STRAIGHT;
  const r = left / Math.PI;
  const finish: Pt = { x: -TURF_STRAIGHT, y: 0 };
  const c1: Pt = { x: -HOME, y: 0 };
  const back0: Pt = { x: -HOME, y: 2 * r };
  const back1: Pt = { x: -HOME + TURF_BACK, y: 2 * r };
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
  const dirtR = 108;
  const left = Math.PI * dirtR;
  const back = DIRT_C3 - DIRT_FINISH_TO_CORNER - left;
  const right = DIRT_LAP - DIRT_STRAIGHT - DIRT_C3;
  const dy = turfR - dirtR - 6;
  const dC4: Pt = { x: -10, y: dy };
  const dFinish: Pt = { x: dC4.x - DIRT_STRAIGHT, y: dy };
  const dC1: Pt = { x: dC4.x - DIRT_HOME, y: dy };
  const back0: Pt = { x: dC1.x, y: dy + 2 * dirtR };
  const back1: Pt = { x: dC1.x + back, y: dy + 2 * dirtR };
  const pts: Pt[] = [];
  pushLine(pts, dFinish, dC1);
  pushArc(pts, dC1.x, dy + dirtR, dirtR, -Math.PI / 2, Math.PI);
  pushLine(pts, back0, back1);
  const turn = spiralTurn(back1, dC4, right);
  for (let i = 1; i < turn.length; i += 1) pts.push(turn[i]);
  pushLine(pts, dC4, dFinish);
  return { samples: withMeters(pts, DIRT_LAP), r: dirtR, back0 };
}

function buildGeometry(): Built {
  const turf = buildTurf();
  const dirt = buildDirt(turf.r);
  const backJoinM = nearestM(turf.samples, turf.back0);
  const straightJoinM = nearestM(turf.samples, turf.c4);
  const dirtBackJoinM = nearestM(dirt.samples, dirt.back0);
  const left = backJoinM - FINISH_TO_CORNER;
  const dirtLeft = dirtBackJoinM - DIRT_FINISH_TO_CORNER;
  const turfC3 = backJoinM + TURF_BACK;
  const dirtBack = DIRT_C3 - dirtBackJoinM;

  return {
    turf: turf.samples,
    dirt: dirt.samples,
    backJoinM,
    straightJoinM,
    dirtBackJoinM,
    chute1200: 1200 - (TURF_LAP - backJoinM),
    chute2000: 2000 - TURF_LAP - (TURF_LAP - straightJoinM),
    chute1150: 1150 - (DIRT_LAP - dirtBackJoinM),
    chute1150Join: dirtBackJoinM,
    turfR: turf.r,
    dirtR: dirt.r,
    turfBackHill: { from: TURF_LAP - 1000, to: TURF_LAP - 1000 + 150 },
    turfHomeHill: { from: TURF_LAP - 170, to: TURF_LAP - 50 },
    dirtBackHill: { from: dirtBackJoinM + 40, to: DIRT_C3 - 30 },
    dirtHomeHill: { from: DIRT_LAP - 170, to: DIRT_LAP - 50 },
    turfCornerM: {
      c1: FINISH_TO_CORNER + left * 0.35,
      c2: FINISH_TO_CORNER + left * 0.72,
      c3: turfC3 + (straightJoinM - turfC3) * 0.28,
      c4: turfC3 + (straightJoinM - turfC3) * 0.72,
    },
    dirtCornerM: {
      c1: DIRT_FINISH_TO_CORNER + dirtLeft * 0.35,
      c2: DIRT_FINISH_TO_CORNER + dirtLeft * 0.72,
      c3: dirtBackJoinM + dirtBack + (DIRT_LAP - DIRT_STRAIGHT - DIRT_C3) * 0.28,
      c4: dirtBackJoinM + dirtBack + (DIRT_LAP - DIRT_STRAIGHT - DIRT_C3) * 0.72,
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

export const FUKUSHIMA_TEMPLATES: FukushimaTemplate[] = [
  {
    id: "turf-1000",
    track: "芝",
    meters: 1000,
    badge: "向",
    course: "芝",
    place: "向正面の2角寄り",
    summary: "向正面からすぐ上る。施行は少ない。",
    bullets: ["2角を出て向正面。3角まで212m。スタートから上り。", "直線の残り170mからもう一度上る。直線は292m。"],
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
    summary: "ポケットから向正面の上りへ。前が残りやすい。",
    bullets: ["2角の奥からまっすぐ向正面へ。3角まで412m。", "向正面で上る。直線は292m。逃げ・先行が残りやすい。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-1700",
    track: "芝",
    meters: 1700,
    badge: "直線",
    course: "芝",
    place: "直線の上り",
    summary: "ゴール前の上りの途中から。1角まで短い。",
    bullets: ["上りの途中。ゴールまで100m。1角まで205m。", "直線は292m。内の逃げ・先行がロスなく行ける。"],
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
    summary: "直線から。スタート後に上り、1角まで短い。",
    bullets: ["ゴールの200m手前。1角まで305m。", "直線の残り170mから上る。内枠の逃げ・先行がロスなく行ける。"],
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
    summary: "4角の奥から。1800より1角まで長い。",
    bullets: ["4角の奥から直線へ。1角まで505m。1800より200m長い。", "直線は残り170mから上る。差し一辺倒にはしない。"],
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
    summary: "向正面から1周あまり。施行は少ない。",
    bullets: ["向正面から。3角まで212m。コーナーは6回。", "向正面と直線の上りを、どちらも2回。初出走だけでは拾わない。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "dirt-1000",
    track: "ダート",
    meters: 1000,
    badge: "向",
    course: "ダート",
    place: "2角の出口",
    summary: "向正面の上りから。施行は少ない。",
    bullets: ["2角を出て向正面へ。3角まで330m。", "直線は295.7m。1150が短距離の主流。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1150",
    track: "ダート",
    meters: 1150,
    badge: "芝発",
    course: "芝スタート",
    place: "2角の外側",
    summary: "この距離だけ芝スタート。逃げが残る。",
    bullets: ["2角の外側から芝を踏んでダートへ。3角まで480m。", "直線は295.7m。大外は芝が長い。"],
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
    summary: "福島ダートの主距離。前が残る。",
    bullets: ["4角を出てすぐ。ゴールまで255m。1角まで338m。", "直線の残り170mから上る。直線は295.7m。追い込みは届きにくい。"],
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
    bullets: ["向正面から。3角まで285m。上りを2回。", "直線は295.7m。距離のサンプルは薄い。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
];

export function fukushimaTemplate(id: string) {
  return FUKUSHIMA_TEMPLATES.find((item) => item.id === id) ?? FUKUSHIMA_TEMPLATES[0];
}

export type MapLabel = { x: number; y: number; text: string };
export type MapLine = { x1: number; y1: number; x2: number; y2: number };

export type FukushimaMap = {
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
  chute(GEOM.dirt, GEOM.chute1150Join, GEOM.chute1150, DIRT_1150_SIDE),
]);

function pocketPaths(id: string): Sample[][] | null {
  const g = GEOM;
  if (id === "turf-1200") {
    return [backChute(sampleAt(g.turf, g.backJoinM), g.chute1200), slice(g.turf, g.backJoinM, TURF_LAP)];
  }
  if (id === "turf-2000") {
    return [homeChute(sampleAt(g.turf, g.straightJoinM), g.chute2000), g.turf];
  }
  if (id === "dirt-1150") {
    return [
      chute(g.dirt, g.chute1150Join, g.chute1150, DIRT_1150_SIDE),
      slice(g.dirt, g.chute1150Join, DIRT_LAP),
    ];
  }
  return null;
}

function usedMeterPaths(template: FukushimaTemplate): Sample[][] {
  const pocket = pocketPaths(template.id);
  if (pocket) return pocket;
  const rail = template.rail === "dirt" ? GEOM.dirt : GEOM.turf;
  const lap = rail[rail.length - 1].m;
  if (template.meters + 0.05 >= lap) return [rail];
  return [slice(rail, station(lap, template.meters), lap)];
}

function startSample(template: FukushimaTemplate): Sample {
  const pocket = pocketPaths(template.id);
  if (pocket) return pocket[0][0];
  const rail = template.rail === "dirt" ? GEOM.dirt : GEOM.turf;
  return sampleAt(rail, station(rail[rail.length - 1].m, template.meters));
}

function finishSample(template: FukushimaTemplate): Sample {
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

function cornerLabels(template: FukushimaTemplate, view: { turf: ScreenPt[]; dirt: ScreenPt[] }): MapLabel[] {
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

export function presentFukushima(id: string): FukushimaMap {
  const template = fukushimaTemplate(id);
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
  const backAt = screenAt(hillView, (backHill.from + backHill.to) / 2);
  const homeAt = screenAt(hillView, (homeHill.from + homeHill.to) / 2);
  const labels = [
    ...cornerLabels(template, view),
    { x: startS.x + startS.ox * 28, y: startS.y + startS.oy * 28, text: "発走" },
    { x: finishS.x + finishS.ox * 28, y: finishS.y + finishS.oy * 28, text: "ゴール" },
    { x: backAt.x + backAt.ox * 24, y: backAt.y + backAt.oy * 24, text: "上り" },
    { x: homeAt.x - homeAt.ox * 20, y: homeAt.y - homeAt.oy * 20, text: "上り" },
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

export function fukushimaRunPhrase(template: FukushimaTemplate) {
  if (template.id === "turf-1200" || template.id === "turf-2000") return "ポケット";
  if (template.id === "dirt-1150") return "芝スタート";
  return lapPhrase(template.meters, template.lap);
}

export function fukushimaStraight(template: FukushimaTemplate) {
  return template.track === "ダート" ? "295.7m" : "292m";
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

function fukushimaRun(meters: 1000 | 1200, origin: number, run: RunPoint[], idle: RunPoint[], approach: RunPoint[], pocketJoin: number) {
  const g = GEOM;
  const hills = [onRun(g.turfBackHill.from, g.turfBackHill.to, origin, meters), onRun(g.turfHomeHill.from, g.turfHomeHill.to, origin, meters)].filter(
    (hill): hill is [number, number] => hill != null,
  );
  const home = hills[hills.length - 1];
  return {
    run,
    idle,
    approach,
    pocketJoin,
    turnFrom: g.backJoinM + TURF_BACK - origin,
    corner3: g.turfCornerM.c3 - origin,
    corner4: g.turfCornerM.c4 - origin,
    straightFrom: TURF_LAP - TURF_STRAIGHT - origin,
    homeFrom: home?.[0] ?? 0,
    homeTo: home?.[1] ?? 0,
    hills,
  };
}

/** 芝1000。向正面から上り、直線の残り170〜50mでもう一度上る。 */
export function fukushimaTurf1000Run() {
  const g = GEOM;
  const startM = station(TURF_LAP, 1000);
  return fukushimaRun(
    1000,
    startM,
    slice(g.turf, startM, TURF_LAP).map((p) => projectPoint(p, p.m - startM)),
    slice(g.turf, 0, startM).map((p) => projectPoint(p, p.m)),
    [],
    0,
  );
}

/**
 * 芝1200。2角の奥のポケットから向正面の上りへ。
 * ゴールから本線を戻した位置には置かない。
 */
export function fukushimaTurf1200Run() {
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
  return fukushimaRun(
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
  const turfC3 = g.backJoinM + TURF_BACK;
  assertNear(turfC3 - station(TURF_LAP, 1000), 212, "芝1000の3角");
  assertNear(g.chute1200 + (turfC3 - g.backJoinM), 412, "芝1200の3角");
  assertNear(g.chute1200 + (TURF_LAP - g.backJoinM), 1200, "芝1200");
  assertNear(TURF_LAP - station(TURF_LAP, 1700), 100, "芝1700のゴールまで");
  assertNear(TURF_LAP - station(TURF_LAP, 1700) + FINISH_TO_CORNER, 205, "芝1700の1角");
  assertNear(TURF_LAP - station(TURF_LAP, 1800), 200, "芝1800のゴールまで");
  assertNear(TURF_LAP - station(TURF_LAP, 1800) + FINISH_TO_CORNER, 305, "芝1800の1角");
  assertNear(g.chute2000 + (TURF_LAP - g.straightJoinM) + FINISH_TO_CORNER, 505, "芝2000の1角");
  assertNear(g.chute2000 + (TURF_LAP - g.straightJoinM) + TURF_LAP, 2000, "芝2000");
  assertNear(
    g.chute2000 +
      (TURF_LAP - g.straightJoinM) +
      FINISH_TO_CORNER -
      (TURF_LAP - station(TURF_LAP, 1800) + FINISH_TO_CORNER),
    200,
    "2000は1800より200m長い",
  );
  assertNear(turfC3 - station(TURF_LAP, 2600), 212, "芝2600の3角");
  const s1000 = station(TURF_LAP, 1000);
  const s2600 = station(TURF_LAP, 2600);
  if (!(s1000 > g.backJoinM && s1000 < turfC3)) throw new Error("芝1000が向正面にない");
  if (Math.abs(s2600 - s1000) > 1) throw new Error("芝2600と芝1000の発走が違う");
  const homeStart = station(TURF_LAP, 1700);
  if (!(homeStart > g.turfHomeHill.from && homeStart < g.turfHomeHill.to)) throw new Error("芝1700が上りの途中にない");
  if (station(TURF_LAP, 1800) > g.turfHomeHill.from) throw new Error("芝1800が上りの途中から始まっている");
  assertNear(DIRT_C3 - station(DIRT_LAP, 1000), 330, "ダート1000の3角");
  assertNear(g.chute1150 + (DIRT_C3 - g.chute1150Join), 480, "ダート1150の3角");
  assertNear(g.chute1150 + (DIRT_LAP - g.chute1150Join), 1150, "ダート1150");
  assertNear(DIRT_LAP - station(DIRT_LAP, 1700), 255.4, "ダート1700のゴールまで");
  assertNear(DIRT_LAP - station(DIRT_LAP, 1700) + DIRT_FINISH_TO_CORNER, 338, "ダート1700の1角");
  assertNear(DIRT_C3 - station(DIRT_LAP, 2400), 285.4, "ダート2400の3角");
  const sDirt1000 = station(DIRT_LAP, 1000);
  const sDirt2400 = station(DIRT_LAP, 2400);
  if (!(sDirt1000 > g.dirtBackJoinM && sDirt1000 < DIRT_C3)) throw new Error("ダート1000が向正面にない");
  if (!(sDirt2400 > g.dirtBackJoinM && sDirt2400 < DIRT_C3)) throw new Error("ダート2400が向正面にない");
  const backHill = sampleAt(g.turf, (g.turfBackHill.from + g.turfBackHill.to) / 2);
  const homeHill = sampleAt(g.turf, (g.turfHomeHill.from + g.turfHomeHill.to) / 2);
  if (backHill.y < g.turfR) throw new Error("向正面の上りが向正面にない");
  if (homeHill.y > g.turfR * 0.35) throw new Error("直線の上りが直線にない");
  if (homeHill.x > -40 || homeHill.x < -TURF_STRAIGHT) throw new Error("直線の上りが残り170〜50mにない");
  const chute1200 = backChute(sampleAt(g.turf, g.backJoinM), g.chute1200);
  const chute2000 = homeChute(sampleAt(g.turf, g.straightJoinM), g.chute2000);
  const chute1150 = chute(g.dirt, g.chute1150Join, g.chute1150, DIRT_1150_SIDE);
  if (chute1200[0].x >= -HOME) throw new Error("芝1200のポケットが2角の奥にない");
  if (chute2000[0].x <= 0) throw new Error("芝2000のポケットが4角の奥にない");
  for (const p of [...chute1200, ...chute2000]) {
    if (railInset(g.turf, p) > 3) throw new Error(`ポケットが芝の内側に入っている (${p.x.toFixed(0)},${p.y.toFixed(0)})`);
  }
  if (railInset(g.turf, chute1150[0]) > 8) throw new Error("ダート1150の発走が芝の外側にない");
  if (railInset(g.dirt, chute1150[0]) > -8) throw new Error("ダート1150の発走がダートに近すぎる");
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
  const right = sampleAt(g.turf, (turfC3 + g.straightJoinM) / 2);
  if (right.x < g.turfR * 0.15) throw new Error("3〜4角が外へ膨らんでいない");
  const turf1000 = fukushimaTurf1000Run();
  const turf1200 = fukushimaTurf1200Run();
  assertNear(turf1000.turnFrom, 212, "芝1000の3角");
  assertNear(turf1200.turnFrom, 412, "芝1200の3角");
  assertNear(1000 - turf1000.straightFrom, TURF_STRAIGHT, "芝1000の直線");
  assertNear(1200 - turf1200.straightFrom, TURF_STRAIGHT, "芝1200の直線");
  if (!(turf1200.pocketJoin > 40 && turf1200.pocketJoin < 140)) {
    throw new Error(`芝1200のポケット ${turf1200.pocketJoin.toFixed(0)}`);
  }
  const walked = sampleAt(g.turf, station(TURF_LAP, 1200));
  if (hypot(turf1200.run[0].x - walked.x, turf1200.run[0].y - walked.y) < 20) {
    throw new Error("芝1200の発走が本線を戻した位置");
  }
  for (const run of [turf1000, turf1200]) {
    if (!(run.straightFrom < run.homeFrom && run.homeTo < (run === turf1000 ? 1000 : 1200))) {
      throw new Error(`福島の直線の上りが直線にない ${run.homeFrom.toFixed(0)}`);
    }
    if (!(run.hills.length >= 2)) throw new Error("福島の上りが2つない");
    if (!(140 < run.corner3 && run.corner3 < run.corner4 && run.corner4 < run.straightFrom)) {
      throw new Error(`福島の並び 3角${run.corner3.toFixed(0)} 4角${run.corner4.toFixed(0)} 直線${run.straightFrom.toFixed(0)}`);
    }
    for (let i = 1; i < run.run.length; i += 1) {
      if (!(run.run[i].m > run.run[i - 1].m)) throw new Error("福島の点列が戻っている");
    }
  }
  const ids = new Set(FUKUSHIMA_TEMPLATES.map((item) => item.id));
  if (ids.size !== FUKUSHIMA_TEMPLATES.length) throw new Error("テンプレートidが重複");
  for (const item of FUKUSHIMA_TEMPLATES) {
    const map = presentFukushima(item.id);
    const [, , width, height] = map.viewBox.split(/\s+/).map(Number);
    for (const label of map.labels) {
      if (label.x < 16 || label.y < 12 || label.x > width - 16 || label.y > height - 12) {
        throw new Error(`${item.id} の${label.text}が図の外 (${label.x.toFixed(0)},${label.y.toFixed(0)})`);
      }
    }
  }
}

checkTemplates();
