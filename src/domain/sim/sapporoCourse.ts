import { asRaw, assembleFlat, spanOf, withSpan } from "@/domain/sim/flatPath";

/**
 * 札幌の平地テンプレート。障害コースは入れない。内・外の別はない。
 * Aコースの公表値（芝1640.9m・直線266.1m、ダート1487m・直線264.3m）。
 * 発走は、その距離をゴールからコースに沿って戻した位置。
 * ゴールから1角までを25.9mにし、芝1800の1角が185m、芝1000の3角が205mになる。
 * 1200は2角の奥へ直線を伸ばしたポケット（3角まで405m）。
 * 2000は4角の奥へ直線を伸ばしたポケット（1角まで385m）。
 * 1500だけ1角の奥へ170m出るポケット。ほぼ平坦なので坂は描かない。
 * 右回りの向きは中山・阪神・京都と同じ。
 */

export type SimTrack = "芝" | "ダート";

export type SapporoTemplate = {
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

const TURF_LAP = 1640.9;
const DIRT_LAP = 1487;
const TURF_STRAIGHT = 266.1;
const DIRT_STRAIGHT = 264.3;
/** ゴールから1角入口。芝1800の1角が185mになる */
const FINISH_TO_CORNER = 25.9;
/** ダート1000の3角が280mになる */
const DIRT_FINISH_TO_CORNER = 23.5;
const HOME = TURF_STRAIGHT + FINISH_TO_CORNER;
const DIRT_HOME = DIRT_STRAIGHT + DIRT_FINISH_TO_CORNER;

const SCALE = 0.8;
const PAD = 96;
/** 1500のポケットが1角の外へ出る幅 */
const POCKET_1500_SIDE = 72;

type Pt = { x: number; y: number };
type Sample = Pt & { m: number; ix: number; iy: number };
type ScreenPt = { x: number; y: number; m: number; ox: number; oy: number };

type Built = {
  turf: Sample[];
  dirt: Sample[];
  backJoinM: number;
  straightJoinM: number;
  chute1200: number;
  chute1500: number;
  chute1500Join: number;
  chute2000: number;
  turfR: number;
  dirtR: number;
  turfCornerM: { c1: number; c2: number; c3: number; c4: number };
  dirtCornerM: { c1: number; c2: number; c3: number; c4: number };
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

/** 右回り。角度は減らす */
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

function buildOval(lap: number, straight: number, toCorner: number, origin: Pt): { samples: Sample[]; r: number; home: number } {
  const home = straight + toCorner;
  const semi = (lap - 2 * home) / 2;
  const r = semi / Math.PI;
  const finish: Pt = { x: origin.x - straight, y: origin.y };
  const c1: Pt = { x: origin.x - home, y: origin.y };
  const back0: Pt = { x: origin.x - home, y: origin.y + 2 * r };
  const back1: Pt = { x: origin.x, y: origin.y + 2 * r };
  const c4out: Pt = { x: origin.x, y: origin.y };
  const pts: Pt[] = [];
  pushLine(pts, finish, c1);
  pushArc(pts, c1.x, origin.y + r, r, -Math.PI / 2, Math.PI);
  pushLine(pts, back0, back1);
  pushArc(pts, origin.x, origin.y + r, r, Math.PI / 2, Math.PI);
  pushLine(pts, c4out, finish);
  return { samples: withMeters(pts, lap), r, home };
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
  const turf = buildOval(TURF_LAP, TURF_STRAIGHT, FINISH_TO_CORNER, { x: 0, y: 0 });
  const dirtSemi = (DIRT_LAP - 2 * DIRT_HOME) / 2;
  const dirtR = dirtSemi / Math.PI;
  const dirtOrigin: Pt = {
    x: -turf.home / 2 + DIRT_HOME / 2,
    y: turf.r - dirtR,
  };
  const dirt = buildOval(DIRT_LAP, DIRT_STRAIGHT, DIRT_FINISH_TO_CORNER, dirtOrigin);

  const back0: Pt = { x: -HOME, y: 2 * turf.r };
  const c4out: Pt = { x: 0, y: 0 };
  const backJoinM = nearestM(turf.samples, back0);
  const straightJoinM = nearestM(turf.samples, c4out);
  const semi = (TURF_LAP - 2 * HOME) / 2;
  const dirtToCorner = DIRT_FINISH_TO_CORNER;
  const dirtSemiM = (DIRT_LAP - 2 * DIRT_HOME) / 2;
  const dirtBack = dirtToCorner + dirtSemiM;

  return {
    turf: turf.samples,
    dirt: dirt.samples,
    backJoinM,
    straightJoinM,
    chute1200: 1200 - (TURF_LAP - backJoinM),
    chute1500: 170,
    chute1500Join: 170 + (TURF_LAP - 1500),
    chute2000: 2000 - TURF_LAP - (TURF_LAP - straightJoinM),
    turfR: turf.r,
    dirtR,
    turfCornerM: {
      c1: FINISH_TO_CORNER + semi * 0.35,
      c2: FINISH_TO_CORNER + semi * 0.72,
      c3: backJoinM + HOME + semi * 0.22,
      c4: backJoinM + HOME + semi * 0.72,
    },
    dirtCornerM: {
      c1: dirtToCorner + dirtSemiM * 0.35,
      c2: dirtToCorner + dirtSemiM * 0.72,
      c3: dirtBack + DIRT_HOME + dirtSemiM * 0.28,
      c4: dirtBack + DIRT_HOME + dirtSemiM * 0.72,
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

export const SAPPORO_TEMPLATES: SapporoTemplate[] = [
  {
    id: "turf-1000",
    track: "芝",
    meters: 1000,
    badge: "向",
    course: "芝",
    place: "向正面の2角寄り",
    summary: "向正面から。3角まで短い。施行は少ない。",
    bullets: ["2角を出て向正面。3角まで205m。", "直線は266.1m。年によって行われない。"],
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
    summary: "ポケットから向正面へ。直線は短い。",
    bullets: ["2角の奥からまっすぐ向正面へ。3角まで405m。", "直線は266.1m。逃げ・先行が残りやすい。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-1500",
    track: "芝",
    meters: 1500,
    badge: "ポケ",
    course: "ポケット",
    place: "1角奥のポケット",
    summary: "この距離は札幌だけ。すぐコーナーへ向く。",
    bullets: ["1角の奥から。170mで1〜2角に入る。", "直線は266.1m。内で先行しやすい。"],
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
    summary: "直線の途中から。1角まで短い。",
    bullets: ["ゴールの159m手前。1角まで185m。", "直線は266.1m。内枠の逃げ・先行がロスなく行ける。"],
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
    bullets: ["4角の奥から直線へ。1角まで385m。1800より200m長い。", "直線は266.1m。"],
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
    bullets: ["向正面から。3角まで165m。コーナーは6回。", "直線は266.1m。初出走だけでは拾わない。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "dirt-1000",
    track: "ダート",
    meters: 1000,
    badge: "向",
    course: "ダート",
    place: "向正面の入口",
    summary: "向正面からワンターン。外枠の前。",
    bullets: ["2角を出てすぐ。3角まで280m。", "直線は264.3m。外枠の逃げ・先行が残りやすい。"],
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
    summary: "ゴール前の直線から1周あまり。",
    bullets: ["4角を出て直線へ。ゴールまで213m。", "直線は264.3m。先行が厚く、捲りも決まる。"],
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
    bullets: ["向正面から1周あまり。直線は264.3m。", "距離のサンプルは薄い。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
];

export function sapporoTemplate(id: string) {
  return SAPPORO_TEMPLATES.find((item) => item.id === id) ?? SAPPORO_TEMPLATES[0];
}

export type MapLabel = { x: number; y: number; text: string };
export type MapLine = { x1: number; y1: number; x2: number; y2: number };

export type SapporoMap = {
  viewBox: string;
  turfD: string;
  dirtD: string;
  used: string[];
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
  chute(GEOM.turf, GEOM.chute1500Join, GEOM.chute1500, POCKET_1500_SIDE),
]);

function pocketPaths(id: string): Sample[][] | null {
  const g = GEOM;
  if (id === "turf-1200") {
    return [backChute(sampleAt(g.turf, g.backJoinM), g.chute1200), slice(g.turf, g.backJoinM, TURF_LAP)];
  }
  if (id === "turf-1500") {
    return [chute(g.turf, g.chute1500Join, g.chute1500, POCKET_1500_SIDE), slice(g.turf, g.chute1500Join, TURF_LAP)];
  }
  if (id === "turf-2000") {
    return [homeChute(sampleAt(g.turf, g.straightJoinM), g.chute2000), g.turf];
  }
  return null;
}

function usedMeterPaths(template: SapporoTemplate): Sample[][] {
  const pocket = pocketPaths(template.id);
  if (pocket) return pocket;
  const rail = template.rail === "dirt" ? GEOM.dirt : GEOM.turf;
  const lap = rail[rail.length - 1].m;
  if (template.meters + 0.05 >= lap) return [rail];
  return [slice(rail, station(lap, template.meters), lap)];
}

function startSample(template: SapporoTemplate): Sample {
  const pocket = pocketPaths(template.id);
  if (pocket) return pocket[0][0];
  const rail = template.rail === "dirt" ? GEOM.dirt : GEOM.turf;
  return sampleAt(rail, station(rail[rail.length - 1].m, template.meters));
}

function finishSample(template: SapporoTemplate): Sample {
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

function cornerLabels(template: SapporoTemplate, view: { turf: ScreenPt[]; dirt: ScreenPt[] }): MapLabel[] {
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

export function presentSapporo(id: string): SapporoMap {
  const template = sapporoTemplate(id);
  const view = screens();
  const used = usedMeterPaths(template).map((pts) => pathD(screenSamples(pts, FIT.shift)));
  const startS = screenSamples([startSample(template)], FIT.shift)[0];
  const finishS = screenSamples([finishSample(template)], FIT.shift)[0];
  const labels = [
    ...cornerLabels(template, view),
    { x: startS.x + startS.ox * 28, y: startS.y + startS.oy * 28, text: "発走" },
    { x: finishS.x + finishS.ox * 28, y: finishS.y + finishS.oy * 28, text: "ゴール" },
  ];
  return {
    viewBox: view.viewBox,
    turfD: pathD(view.turf),
    dirtD: pathD(view.dirt),
    used,
    labels,
    start: bar(startS, 14),
    finish: bar(finishS, 16),
    title: `${template.track}${template.meters} ${template.course}`,
  };
}

export function sapporoRunPhrase(template: SapporoTemplate) {
  if (template.id === "turf-1200" || template.id === "turf-1500" || template.id === "turf-2000") return "ポケット";
  return lapPhrase(template.meters, template.lap);
}

export function sapporoStraight(template: SapporoTemplate) {
  return template.track === "ダート" ? "264.3m" : "266.1m";
}

type RunPoint = { m: number; x: number; y: number; ix: number; iy: number };

function projectPoint(p: { x: number; y: number; ix: number; iy: number }, m: number): RunPoint {
  return { m, x: p.x, y: p.y, ix: p.ix, iy: p.iy };
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

/** 芝1000。向正面から本線を1000m。直線は266.1m。ほぼ平坦なので坂は描かない。 */
export function sapporoTurf1000Run() {
  const g = GEOM;
  const startM = station(TURF_LAP, 1000);
  return {
    run: slice(g.turf, startM, TURF_LAP).map((p) => projectPoint(p, p.m - startM)),
    idle: slice(g.turf, 0, startM).map((p) => projectPoint(p, p.m)),
    approach: [] as RunPoint[],
    pocketJoin: 0,
    turnFrom: g.backJoinM + HOME - startM,
    corner3: g.turfCornerM.c3 - startM,
    corner4: g.turfCornerM.c4 - startM,
    straightFrom: TURF_LAP - TURF_STRAIGHT - startM,
    hills: [] as Array<[number, number]>,
  };
}

/**
 * 芝1200。2角の奥へ伸ばしたポケットから本線へ。
 * ゴールから本線を戻した位置には置かない。直線は266.1m。
 */
export function sapporoTurf1200Run() {
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
  const origin = join - len;
  return {
    run,
    idle: slice(g.turf, 0, join).map((p) => projectPoint(p, p.m)),
    approach: chuteApproach(joinPt, len),
    pocketJoin: len,
    turnFrom: g.backJoinM + HOME - origin,
    corner3: g.turfCornerM.c3 - origin,
    corner4: g.turfCornerM.c4 - origin,
    straightFrom: TURF_LAP - TURF_STRAIGHT - origin,
    hills: [] as Array<[number, number]>,
  };
}

function assertNear(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 3) {
    throw new Error(`${label}: ${actual.toFixed(1)} ≠ ${expected}`);
  }
}

/** 芝レールの内側が正。直線の外は負 */
function turfInset(p: Pt) {
  const r = GEOM.turfR;
  if (p.x < -HOME) return r - hypot(p.x + HOME, p.y - r);
  if (p.x > 0) return r - hypot(p.x, p.y - r);
  return Math.min(p.y, 2 * r - p.y);
}

function checkTemplates() {
  const g = GEOM;
  assertNear(g.turf[g.turf.length - 1].m, TURF_LAP, "芝");
  assertNear(g.dirt[g.dirt.length - 1].m, DIRT_LAP, "ダート");
  const c3 = g.backJoinM + HOME;
  assertNear(c3 - station(TURF_LAP, 1000), 205, "芝1000の3角");
  assertNear(g.chute1200 + (c3 - g.backJoinM), 405, "芝1200の3角");
  assertNear(g.chute1200 + (TURF_LAP - g.backJoinM), 1200, "芝1200");
  assertNear(TURF_LAP - station(TURF_LAP, 1800), 159, "芝1800のゴールまで");
  assertNear(TURF_LAP - station(TURF_LAP, 1800) + FINISH_TO_CORNER, 185, "芝1800の1角");
  assertNear(g.chute2000 + (TURF_LAP - g.straightJoinM) + FINISH_TO_CORNER, 385, "芝2000の1角");
  assertNear(g.chute2000 + (TURF_LAP - g.straightJoinM) + TURF_LAP, 2000, "芝2000");
  assertNear(
    g.chute2000 + (TURF_LAP - g.straightJoinM) + FINISH_TO_CORNER - (TURF_LAP - station(TURF_LAP, 1800) + FINISH_TO_CORNER),
    200,
    "2000は1800より200m長い",
  );
  assertNear(g.chute1500 + (TURF_LAP - g.chute1500Join), 1500, "芝1500");
  assertNear(c3 - station(TURF_LAP, 2600), 165, "芝2600の3角");
  const s2600 = station(TURF_LAP, 2600);
  if (!(s2600 > g.backJoinM && s2600 < c3)) throw new Error("芝2600が向正面にない");
  const dirtC3 = g.dirtCornerM.c3 - (DIRT_LAP - 2 * DIRT_HOME) / 2 * 0.28;
  assertNear(dirtC3 - station(DIRT_LAP, 1000), 280, "ダート1000の3角");
  assertNear(DIRT_LAP - station(DIRT_LAP, 1700), 213, "ダート1700のゴールまで");
  const chute1200 = backChute(sampleAt(g.turf, g.backJoinM), g.chute1200);
  const chute2000 = homeChute(sampleAt(g.turf, g.straightJoinM), g.chute2000);
  const chute1500 = chute(g.turf, g.chute1500Join, g.chute1500, POCKET_1500_SIDE);
  if (chute1200[0].x >= -HOME) throw new Error("芝1200のポケットが2角の奥にない");
  if (chute2000[0].x <= 0) throw new Error("芝2000のポケットが4角の奥にない");
  for (const p of [...chute1200, ...chute2000, ...chute1500]) {
    if (turfInset(p) > 3) throw new Error(`ポケットが芝の内側に入っている (${p.x.toFixed(0)},${p.y.toFixed(0)})`);
  }
  let dirtGap = Infinity;
  for (const p of g.dirt) dirtGap = Math.min(dirtGap, turfInset(p));
  if (dirtGap < 12) throw new Error(`ダートが芝に近すぎる ${dirtGap.toFixed(1)}`);
  const turf1000 = sapporoTurf1000Run();
  const turf1200 = sapporoTurf1200Run();
  assertNear(turf1000.run[turf1000.run.length - 1].m, 1000, "芝1000走行のゴール");
  assertNear(turf1200.run[turf1200.run.length - 1].m, 1200, "芝1200走行のゴール");
  assertNear(turf1000.turnFrom, 205, "芝1000の3角");
  assertNear(turf1200.turnFrom, 405, "芝1200の3角");
  assertNear(1000 - turf1000.straightFrom, TURF_STRAIGHT, "芝1000の直線");
  assertNear(1200 - turf1200.straightFrom, TURF_STRAIGHT, "芝1200の直線");
  if (!(turf1200.pocketJoin > 40 && turf1200.pocketJoin < 140)) {
    throw new Error(`芝1200のポケット ${turf1200.pocketJoin.toFixed(0)}`);
  }
  const walked1200 = sampleAt(g.turf, station(TURF_LAP, 1200));
  if (hypot(turf1200.run[0].x - walked1200.x, turf1200.run[0].y - walked1200.y) < 20) {
    throw new Error("芝1200の発走が本線を戻した位置");
  }
  const at1000 = sampleAt(g.turf, station(TURF_LAP, 1000));
  if (hypot(turf1000.run[0].x - at1000.x, turf1000.run[0].y - at1000.y) > 1) {
    throw new Error("芝1000の発走が向正面にない");
  }
  for (const run of [turf1000, turf1200]) {
    if (!(run.turnFrom < run.corner3 && run.corner3 < run.corner4 && run.corner4 < run.straightFrom)) {
      throw new Error(`札幌の並び 3角${run.corner3.toFixed(0)} 直線${run.straightFrom.toFixed(0)}`);
    }
    if (!(140 < run.corner3)) throw new Error("向正面の局面が3角を越えている");
    for (let i = 1; i < run.run.length; i += 1) {
      if (!(run.run[i].m > run.run[i - 1].m)) throw new Error("札幌の点列が戻っている");
    }
  }
  const ids = new Set(SAPPORO_TEMPLATES.map((item) => item.id));
  if (ids.size !== SAPPORO_TEMPLATES.length) throw new Error("テンプレートidが重複");
  for (const item of SAPPORO_TEMPLATES) {
    const map = presentSapporo(item.id);
    const [, , width, height] = map.viewBox.split(/\s+/).map(Number);
    for (const label of map.labels) {
      if (label.x < 16 || label.y < 12 || label.x > width - 16 || label.y > height - 12) {
        throw new Error(`${item.id} の${label.text}が図の外 (${label.x.toFixed(0)},${label.y.toFixed(0)})`);
      }
    }
  }
}

checkTemplates();

/** 1500のポケット、1800以上の芝、全ダート */
export function sapporoFlatGeom(templateId: string) {
  const template = SAPPORO_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return null;
  const g = GEOM;
  if (template.id === "turf-1500") {
    const chutePts = withSpan(chute(g.turf, g.chute1500Join, g.chute1500, POCKET_1500_SIDE), g.chute1500);
    const after = asRaw(slice(g.turf, g.chute1500Join, TURF_LAP));
    return assembleFlat({
      meters: template.meters,
      head: [chutePts, after],
      loop: g.chute1500 + spanOf(after) + 8 < template.meters ? asRaw(g.turf) : null,
      resume: 0,
      lap: TURF_LAP,
      finishJoinRace: g.chute1500,
      finishJoinRail: g.chute1500Join,
      c1: g.turfCornerM.c1,
      c3: g.turfCornerM.c3,
      c4: g.turfCornerM.c4,
      straight: TURF_STRAIGHT,
      hillsBeforeFinish: [],
    });
  }
  if (template.id === "turf-2000") {
    const chutePts = withSpan(homeChute(sampleAt(g.turf, g.straightJoinM), g.chute2000), g.chute2000);
    const after = asRaw(slice(g.turf, g.straightJoinM, TURF_LAP));
    return assembleFlat({
      meters: template.meters,
      head: [chutePts, after],
      loop: g.chute2000 + spanOf(after) + 8 < template.meters ? asRaw(g.turf) : null,
      resume: 0,
      lap: TURF_LAP,
      finishJoinRace: g.chute2000,
      finishJoinRail: g.straightJoinM,
      c1: g.turfCornerM.c1,
      c3: g.turfCornerM.c3,
      c4: g.turfCornerM.c4,
      straight: TURF_STRAIGHT,
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
