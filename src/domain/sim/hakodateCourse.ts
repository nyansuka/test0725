/**
 * 函館の平地テンプレート。障害コースは入れない。内・外の別はない。
 * Aコースの公表値（芝1626.6m・直線262.1m、ダート1475.8m・直線260.3m）。
 * 発走は、その距離をゴールからコースに沿って戻した位置。
 * ゴールから1角までを103.3mにし、芝1000の3角が290m、芝1200の3角が490mになる。
 * 1200は2角の奥へ直線を伸ばしたポケット。2000は4角の奥へ直線を伸ばしたポケット。
 * 坂は3〜4角。向正面の上には乗せない。直線は下りから平坦。
 * 右回りの向きは中山・阪神・京都と同じ。
 */

export type SimTrack = "芝" | "ダート";

export type HakodateTemplate = {
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

const TURF_LAP = 1626.6;
const DIRT_LAP = 1475.8;
const TURF_STRAIGHT = 262.1;
const DIRT_STRAIGHT = 260.3;
/** ゴールから1角入口。芝1000の3角が290m、芝1200の3角が490mになる */
const FINISH_TO_CORNER = 103.3;
/** 芝と同じ割合。ゴールから1角までは長め */
const DIRT_FINISH_TO_CORNER = 102.6;
const HOME = TURF_STRAIGHT + FINISH_TO_CORNER;
const DIRT_HOME = DIRT_STRAIGHT + DIRT_FINISH_TO_CORNER;

const SCALE = 0.8;
const PAD = 96;

type Pt = { x: number; y: number };
type Sample = Pt & { m: number; ix: number; iy: number };
type ScreenPt = { x: number; y: number; m: number; ox: number; oy: number };

type Built = {
  turf: Sample[];
  dirt: Sample[];
  backJoinM: number;
  straightJoinM: number;
  chute1200: number;
  chute2000: number;
  turfR: number;
  dirtR: number;
  turfHill: { from: number; to: number };
  dirtHill: { from: number; to: number };
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
  const dirtC3 = dirtBack + DIRT_HOME;
  const dirtC4 = DIRT_LAP - DIRT_STRAIGHT;

  return {
    turf: turf.samples,
    dirt: dirt.samples,
    backJoinM,
    straightJoinM,
    chute1200: 1200 - (TURF_LAP - backJoinM),
    chute2000: 2000 - TURF_LAP - (TURF_LAP - straightJoinM),
    turfR: turf.r,
    dirtR,
    turfHill: { from: backJoinM + HOME, to: straightJoinM },
    dirtHill: { from: dirtC3, to: dirtC4 },
    turfCornerM: {
      c1: FINISH_TO_CORNER + semi * 0.35,
      c2: FINISH_TO_CORNER + semi * 0.72,
      c3: backJoinM + HOME + semi * 0.22,
      c4: backJoinM + HOME + semi * 0.72,
    },
    dirtCornerM: {
      c1: dirtToCorner + dirtSemiM * 0.35,
      c2: dirtToCorner + dirtSemiM * 0.72,
      c3: dirtC3 + dirtSemiM * 0.22,
      c4: dirtC3 + dirtSemiM * 0.72,
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

export const HAKODATE_TEMPLATES: HakodateTemplate[] = [
  {
    id: "turf-1000",
    track: "芝",
    meters: 1000,
    badge: "向",
    course: "芝",
    place: "向正面の2角寄り",
    summary: "向正面から。3角まで上り。施行は少ない。",
    bullets: ["2角を出て向正面。3角まで290m。", "坂は3〜4角。直線262.1mは下りから平坦。"],
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
    summary: "ポケットから向正面の上りへ。",
    bullets: ["2角の奥からまっすぐ向正面へ。3角まで490m。", "坂は3〜4角。直線は262.1m。逃げ・先行が残りやすい。"],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-1700",
    track: "芝",
    meters: 1700,
    badge: "直線",
    course: "芝",
    place: "ゴールの手前",
    summary: "直線のゴール近くから1周あまり。",
    bullets: ["ゴールの73m手前。1角まで177m。", "直線は262.1m。坂は3〜4角。"],
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
    summary: "1700の100m手前。1角まで短い。",
    bullets: ["ゴールの173m手前。1角まで277m。", "直線は262.1m。内枠の逃げ・先行がロスなく行ける。"],
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
    bullets: ["4角の奥から直線へ。1角まで477m。1800より200m長い。", "直線は262.1m。差し一辺倒にはしない。"],
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
    summary: "向正面から。坂を2回。施行は少ない。",
    bullets: ["向正面から。3角まで263m。3〜4角の坂を2回。", "直線は262.1m。初出走だけでは拾わない。"],
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
    summary: "向正面の上りから。逃げが残る。",
    bullets: ["2角を出て向正面へ。3角まで365m。", "坂は3〜4角。直線は260.3m。枠では分けない。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1700",
    track: "ダート",
    meters: 1700,
    badge: "直線",
    course: "ダート",
    place: "直線の入口",
    summary: "4角を出てすぐ。向正面は上り。",
    bullets: ["4角を出て直線へ。ゴールまで224m。", "直線は260.3m。逃げ・先行が厚い。"],
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
    bullets: ["向正面から。3角まで289m。坂は3〜4角。", "直線は260.3m。距離のサンプルは薄い。"],
    lap: DIRT_LAP,
    rail: "dirt",
  },
];

export function hakodateTemplate(id: string) {
  return HAKODATE_TEMPLATES.find((item) => item.id === id) ?? HAKODATE_TEMPLATES[0];
}

export type MapLabel = { x: number; y: number; text: string };
export type MapLine = { x1: number; y1: number; x2: number; y2: number };

export type HakodateMap = {
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

function usedMeterPaths(template: HakodateTemplate): Sample[][] {
  const pocket = pocketPaths(template.id);
  if (pocket) return pocket;
  const rail = template.rail === "dirt" ? GEOM.dirt : GEOM.turf;
  const lap = rail[rail.length - 1].m;
  if (template.meters + 0.05 >= lap) return [rail];
  return [slice(rail, station(lap, template.meters), lap)];
}

function startSample(template: HakodateTemplate): Sample {
  const pocket = pocketPaths(template.id);
  if (pocket) return pocket[0][0];
  const rail = template.rail === "dirt" ? GEOM.dirt : GEOM.turf;
  return sampleAt(rail, station(rail[rail.length - 1].m, template.meters));
}

function finishSample(template: HakodateTemplate): Sample {
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

function cornerLabels(template: HakodateTemplate, view: { turf: ScreenPt[]; dirt: ScreenPt[] }): MapLabel[] {
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

export function presentHakodate(id: string): HakodateMap {
  const template = hakodateTemplate(id);
  const view = screens();
  const used = usedMeterPaths(template).map((pts) => pathD(screenSamples(pts, FIT.shift)));
  const hill = template.track === "ダート" ? GEOM.dirtHill : GEOM.turfHill;
  const hillRail = template.track === "ダート" ? GEOM.dirt : GEOM.turf;
  const hillView = template.track === "ダート" ? view.dirt : view.turf;
  const hillD = pathD(screenSamples(slice(hillRail, hill.from, hill.to), FIT.shift));
  const startS = screenSamples([startSample(template)], FIT.shift)[0];
  const finishS = screenSamples([finishSample(template)], FIT.shift)[0];
  const hillAt = screenAt(hillView, (hill.from + hill.to) / 2);
  const labels = [
    ...cornerLabels(template, view),
    { x: startS.x + startS.ox * 28, y: startS.y + startS.oy * 28, text: "発走" },
    { x: finishS.x + finishS.ox * 28, y: finishS.y + finishS.oy * 28, text: "ゴール" },
    { x: hillAt.x + hillAt.ox * 26, y: hillAt.y + hillAt.oy * 26, text: "坂" },
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

export function hakodateRunPhrase(template: HakodateTemplate) {
  if (template.id === "turf-1200" || template.id === "turf-2000") return "ポケット";
  return lapPhrase(template.meters, template.lap);
}

export function hakodateStraight(template: HakodateTemplate) {
  return template.track === "ダート" ? "260.3m" : "262.1m";
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

function hakodateRun(meters: 1000 | 1200, origin: number, run: RunPoint[], idle: RunPoint[], approach: RunPoint[], pocketJoin: number) {
  const g = GEOM;
  const hill = onRun(g.turfHill.from, g.turfHill.to, origin, meters);
  return {
    run,
    idle,
    approach,
    pocketJoin,
    turnFrom: g.turfHill.from - origin,
    corner3: g.turfCornerM.c3 - origin,
    corner4: g.turfCornerM.c4 - origin,
    straightFrom: TURF_LAP - TURF_STRAIGHT - origin,
    hillFrom: hill?.[0] ?? 0,
    hillTo: hill?.[1] ?? 0,
    hills: hill ? [hill] : [],
  };
}

/** 芝1000。向正面から。坂は3〜4角。直線262.1mは下りから平坦。 */
export function hakodateTurf1000Run() {
  const g = GEOM;
  const startM = station(TURF_LAP, 1000);
  return hakodateRun(
    1000,
    startM,
    slice(g.turf, startM, TURF_LAP).map((p) => projectPoint(p, p.m - startM)),
    slice(g.turf, 0, startM).map((p) => projectPoint(p, p.m)),
    [],
    0,
  );
}

/**
 * 芝1200。2角の奥のポケットから、向正面の上りへ。
 * ゴールから本線を戻した位置には置かない。
 */
export function hakodateTurf1200Run() {
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
  return hakodateRun(
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
  const c3 = g.turfHill.from;
  assertNear(c3 - station(TURF_LAP, 1000), 290, "芝1000の3角");
  assertNear(g.chute1200 + (c3 - g.backJoinM), 490, "芝1200の3角");
  assertNear(g.chute1200 + (TURF_LAP - g.backJoinM), 1200, "芝1200");
  assertNear(TURF_LAP - station(TURF_LAP, 1700), 73, "芝1700のゴールまで");
  assertNear(TURF_LAP - station(TURF_LAP, 1700) + FINISH_TO_CORNER, 177, "芝1700の1角");
  assertNear(TURF_LAP - station(TURF_LAP, 1800), 173, "芝1800のゴールまで");
  assertNear(TURF_LAP - station(TURF_LAP, 1800) + FINISH_TO_CORNER, 277, "芝1800の1角");
  assertNear(g.chute2000 + (TURF_LAP - g.straightJoinM) + FINISH_TO_CORNER, 477, "芝2000の1角");
  assertNear(g.chute2000 + (TURF_LAP - g.straightJoinM) + TURF_LAP, 2000, "芝2000");
  assertNear(
    g.chute2000 +
      (TURF_LAP - g.straightJoinM) +
      FINISH_TO_CORNER -
      (TURF_LAP - station(TURF_LAP, 1800) + FINISH_TO_CORNER),
    200,
    "2000は1800より200m長い",
  );
  assertNear(c3 - station(TURF_LAP, 2600), 263, "芝2600の3角");
  const s2600 = station(TURF_LAP, 2600);
  if (!(s2600 > g.backJoinM && s2600 < c3)) throw new Error("芝2600が向正面にない");
  if (FINISH_TO_CORNER < 90) throw new Error("ゴールから1角までが短すぎる");
  assertNear(g.dirtHill.from - station(DIRT_LAP, 1000), 365, "ダート1000の3角");
  assertNear(DIRT_LAP - station(DIRT_LAP, 1700), 224, "ダート1700のゴールまで");
  assertNear(g.dirtHill.from - station(DIRT_LAP, 2400), 289, "ダート2400の3角");
  const hillMid = sampleAt(g.turf, (g.turfHill.from + g.turfHill.to) / 2);
  if (hillMid.x < GEOM.turfR * 0.4) throw new Error("坂が3〜4角にない");
  if (hillMid.y < GEOM.turfR * 0.4) throw new Error("坂が直線に降りている");
  const chute1200 = backChute(sampleAt(g.turf, g.backJoinM), g.chute1200);
  const chute2000 = homeChute(sampleAt(g.turf, g.straightJoinM), g.chute2000);
  if (chute1200[0].x >= -HOME) throw new Error("芝1200のポケットが2角の奥にない");
  if (chute2000[0].x <= 0) throw new Error("芝2000のポケットが4角の奥にない");
  for (const p of [...chute1200, ...chute2000]) {
    if (turfInset(p) > 3) throw new Error(`ポケットが芝の内側に入っている (${p.x.toFixed(0)},${p.y.toFixed(0)})`);
  }
  let dirtGap = Infinity;
  for (const p of g.dirt) dirtGap = Math.min(dirtGap, turfInset(p));
  if (dirtGap < 12) throw new Error(`ダートが芝に近すぎる ${dirtGap.toFixed(1)}`);
  const turf1000 = hakodateTurf1000Run();
  const turf1200 = hakodateTurf1200Run();
  assertNear(turf1000.turnFrom, 290, "芝1000の3角");
  assertNear(turf1200.turnFrom, 490, "芝1200の3角");
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
    if (!(run.hillFrom < run.corner3 && run.corner3 < run.hillTo && run.hillTo <= run.straightFrom + 1)) {
      throw new Error(`函館の坂が3〜4角にない ${run.hillFrom.toFixed(0)}-${run.hillTo.toFixed(0)}`);
    }
    if (!(140 < run.corner3 && run.corner3 < run.corner4 && run.corner4 < run.straightFrom)) {
      throw new Error(`函館の並び 3角${run.corner3.toFixed(0)}`);
    }
    for (let i = 1; i < run.run.length; i += 1) {
      if (!(run.run[i].m > run.run[i - 1].m)) throw new Error("函館の点列が戻っている");
    }
  }
  const ids = new Set(HAKODATE_TEMPLATES.map((item) => item.id));
  if (ids.size !== HAKODATE_TEMPLATES.length) throw new Error("テンプレートidが重複");
  for (const item of HAKODATE_TEMPLATES) {
    const map = presentHakodate(item.id);
    const [, , width, height] = map.viewBox.split(/\s+/).map(Number);
    for (const label of map.labels) {
      if (label.x < 16 || label.y < 12 || label.x > width - 16 || label.y > height - 12) {
        throw new Error(`${item.id} の${label.text}が図の外 (${label.x.toFixed(0)},${label.y.toFixed(0)})`);
      }
    }
  }
}

checkTemplates();
