import { asRaw, assembleFlat, spanOf, withSpan } from "@/domain/sim/flatPath";

/**
 * 阪神の平地テンプレート。障害コースは入れない。
 * Aコースの公表値（芝内1689m・直線356.5m、芝外2089m・直線473.6m、ダート1517.6m・直線352.7m）。
 * 発走は、その距離をゴールからコースに沿って戻した位置。
 * 芝2000の「1角まで約325m」と芝2200の「約525m」が合うよう、ゴールから1角までを14mにしている。
 * 外回りは1〜2角を内回りと共有し、向正面の先から3〜4角を外側の弧で回って長い直線に入る。
 * 左右の直線は同じ長さの模式図。内回り1200の3角はコースメモの243mより長く見える。
 * ダート1400は芝を約150m。1200と外回り1600は同じ地点から発走する。
 */

export type SimTrack = "芝" | "ダート";

export type HanshinTemplate = {
  id: string;
  track: SimTrack;
  meters: number;
  badge: string;
  course: string;
  place: string;
  summary: string;
  bullets: string[];
  lap: number;
  rail: "inner" | "outer" | "dirt" | "outer-inner";
};

const INNER_LAP = 1689;
const OUTER_LAP = 2089;
const DIRT_LAP = 1517.6;
const INNER_STRAIGHT = 356.5;
const OUTER_STRAIGHT = 473.6;
const DIRT_STRAIGHT = 352.7;
/** ゴールから1角入口。2000は325m、2200は525mになる */
const FINISH_TO_CORNER = 14;
const DIRT_FINISH_TO_CORNER = 14;
const HOME = INNER_STRAIGHT + FINISH_TO_CORNER;
const DIRT_HOME = DIRT_STRAIGHT + DIRT_FINISH_TO_CORNER;

const SCALE = 0.55;
const PAD = 72;

type Pt = { x: number; y: number };
type Sample = Pt & { m: number; ix: number; iy: number };
type ScreenPt = { x: number; y: number; m: number; ox: number; oy: number };

type Built = {
  inner: Sample[];
  outer: Sample[];
  dirt: Sample[];
  outerJoinM: number;
  outerSplitM: number;
  outerApexM: number;
  outerCorner4M: number;
  dirt1400Join: number;
  dirt1400Len: number;
  dirt2000Join: number;
  dirt2000Len: number;
  innerCornerM: { c1: number; c2: number; c3: number; c4: number };
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
  // 右回り。進行方向の右手が内。yは北が正。
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

/** 弦の短い側の円弧。内場から遠い側を返す */
function minorArc(a: Pt, b: Pt, targetLen: number, infield: Pt): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = hypot(dx, dy) || 1;
  const ratio = targetLen / chord;
  if (!(ratio > 1.002 && ratio < Math.PI / 2 - 0.01)) {
    throw new Error(`外回りの弧が半円に収まらない ${ratio.toFixed(2)}`);
  }
  let lo = 0.05;
  let hi = Math.PI - 0.02;
  for (let i = 0; i < 48; i += 1) {
    const mid = (lo + hi) / 2;
    const got = mid / (2 * Math.sin(mid / 2));
    if (got > ratio) hi = mid;
    else lo = mid;
  }
  const theta = (lo + hi) / 2;
  const radius = targetLen / theta;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const px = -dy / chord;
  const py = dx / chord;
  const d = Math.sqrt(Math.max(0, radius * radius - (chord / 2) * (chord / 2)));
  const centers = [
    { x: mx + px * d, y: my + py * d },
    { x: mx - px * d, y: my - py * d },
  ];
  let best: Pt[] | null = null;
  let bestDist = -1;
  for (const center of centers) {
    const a0 = Math.atan2(a.y - center.y, a.x - center.x);
    let sweep = a0 - Math.atan2(b.y - center.y, b.x - center.x);
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep < -Math.PI) sweep += 2 * Math.PI;
    const pts: Pt[] = [];
    pushArc(pts, center.x, center.y, radius, a0, sweep);
    pts[pts.length - 1] = { x: b.x, y: b.y };
    const mid = pts[Math.floor(pts.length / 2)];
    const dist = hypot(mid.x - infield.x, mid.y - infield.y);
    if (dist > bestDist) {
      bestDist = dist;
      best = pts;
    }
  }
  return best ?? [];
}

function insideInner(p: Pt, radius: number, home: number) {
  if (hypot(p.x + home, p.y - radius) < radius - 3) return true;
  if (hypot(p.x, p.y - radius) < radius - 3) return true;
  return p.x > -home + 3 && p.x < -3 && p.y > 3 && p.y < 2 * radius - 3;
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

  // 2角出口まで内回りと同じ。向正面を右へ延ばし、3〜4角は外側の弧。直線は473.6m。
  const splitM = FINISH_TO_CORNER + semi;
  const yBack = 2 * r;
  const splitPt: Pt = { x: -HOME, y: yBack };
  const p4: Pt = { x: OUTER_STRAIGHT - INNER_STRAIGHT, y: 0 };
  const infield = { x: -HOME / 2, y: r };
  const prefix: Pt[] = [];
  for (const p of inner) {
    if (p.m >= splitM - 0.05) break;
    prefix.push({ x: p.x, y: p.y });
  }
  prefix.push(splitPt);
  const prefixLen = polyLen(prefix);
  const straightLen = hypot(finish.x - p4.x, finish.y - p4.y);

  let outerPts: Pt[] | null = null;
  let bestScore = Infinity;
  for (let xb = 180; xb <= 480; xb += 2) {
    const backEnd = { x: xb, y: yBack };
    const backLen = xb - splitPt.x;
    const arcLen = OUTER_LAP - prefixLen - backLen - straightLen;
    const chord = hypot(p4.x - backEnd.x, p4.y - backEnd.y);
    if (arcLen < chord + 12 || arcLen > chord * (Math.PI / 2) - 12) continue;
    const ratio = arcLen / chord;
    let arc: Pt[];
    try {
      arc = minorArc(backEnd, p4, arcLen, infield);
    } catch {
      continue;
    }
    if (arc.some((p) => insideInner(p, r, HOME) || p.y < -4)) continue;
    const score = Math.abs(ratio - 1.32);
    if (score >= bestScore) continue;
    const pts = prefix.map((p) => ({ x: p.x, y: p.y }));
    pushLine(pts, splitPt, backEnd);
    for (let i = 1; i < arc.length; i += 1) pts.push(arc[i]);
    pushLine(pts, p4, finish);
    outerPts = pts;
    bestScore = score;
  }
  if (!outerPts) throw new Error("外回りの形が決まらない");
  const outer = withMeters(outerPts, OUTER_LAP);
  const outerSplitM = nearestM(outer, splitPt);
  const outerJoinM = nearestM(outer, c4out);

  let apex = outer[0];
  for (const p of outer) {
    if (p.m < outerSplitM || p.m > outerJoinM) continue;
    if (p.x > apex.x) apex = p;
  }

  const dirtY = 22;
  const dirtSemi = (DIRT_LAP - 2 * DIRT_HOME) / 2;
  const rd = dirtSemi / Math.PI;
  const dC4: Pt = { x: -6, y: dirtY };
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
  const dirt1400Join = dirt1400Len + (DIRT_LAP - 1400);
  const dirt2000Len = 120;
  const dirt2000Join = station(DIRT_LAP, 2000) + dirt2000Len;

  const dirtToCorner = DIRT_FINISH_TO_CORNER;
  const dirtBack0m = dirtToCorner + dirtSemi;

  return {
    inner,
    outer,
    dirt,
    outerJoinM,
    outerSplitM,
    outerApexM: apex.m,
    outerCorner4M: OUTER_LAP - OUTER_STRAIGHT,
    dirt1400Join,
    dirt1400Len,
    dirt2000Join,
    dirt2000Len,
    innerCornerM: {
      c1: FINISH_TO_CORNER + semi * 0.35,
      c2: FINISH_TO_CORNER + semi * 0.72,
      c3: FINISH_TO_CORNER + semi + HOME + semi * 0.28,
      c4: FINISH_TO_CORNER + semi + HOME + semi * 0.72,
    },
    dirtCornerM: {
      c1: dirtToCorner + dirtSemi * 0.35,
      c2: dirtToCorner + dirtSemi * 0.72,
      c3: dirtBack0m + DIRT_HOME + dirtSemi * 0.28,
      c4: dirtBack0m + DIRT_HOME + dirtSemi * 0.72,
    },
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

export const HANSHIN_TEMPLATES: HanshinTemplate[] = [
  {
    id: "turf-1200",
    track: "芝",
    meters: 1200,
    badge: "内",
    course: "内回り",
    place: "向正面の入口",
    summary: "内回り。前と内枠。",
    bullets: [
      "内回りワンターン。向正面に入ってすぐ。外回り1600と同じ地点。",
      "逃げ・先行と内枠が残りやすい。外から差し切る想定は弱い。",
      "ゴール前の急坂あり。",
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
    place: "2角の手前",
    summary: "内回り。逃げ切り一辺倒ではないが、前残り・内枠。",
    bullets: [
      "内回り。1200の200m手前から。",
      "逃げ切りは減るが差し有利にはならない。内でロスなく運べる馬。",
      "8枠は成績を落としやすい。",
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
    place: "向正面、このあと外回り",
    summary: "外回りの1400。内回りの1400とは別のコース。",
    bullets: [
      "向正面から外回りの3〜4角へ入る。直線は473.6m。",
      "内回り1400の前残り・内枠を、そのまま外回りには使わない。",
    ],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-1600",
    track: "芝",
    meters: 1600,
    badge: "外",
    course: "外回り",
    place: "向正面の入口",
    summary: "外回りマイル。直線が長くても前が残りやすい。",
    bullets: [
      "内回り1200と同じ地点から、外回りの3〜4角を回る。",
      "直線473.6m（右回り最長）でもペースは落ち着きやすい。逃げ・好位が粘る。",
      "枠の有利不利は距離ほど強くない。",
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
    place: "向正面",
    summary: "外回り。3角まで長く枠差は小さい。",
    bullets: [
      "外回り。2000は内回り。スタートを200mずらした延長ではない。",
      "枠順の偏りは小さい。実力どおりになりやすい。",
      "極端な前有利でも差し一辺倒でもない。",
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
    place: "4角を出てすぐ",
    summary: "内回り（大阪杯）。好位と内枠。",
    bullets: [
      "内回り。最初のコーナーまで約325mと短い。",
      "1800は外回り。この距離の200m延長ではない。",
      "序盤が緩みやすく、前につけた馬が残りやすい。内枠がポジションを取りやすい。",
    ],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-2200",
    track: "芝",
    meters: 2200,
    badge: "内",
    course: "内回り",
    place: "4角の途中",
    summary: "内回り（宝塚記念）。2000より差しも届く。",
    bullets: [
      "内回り。2000の200m後ろ。最初のコーナーまで約525m。",
      "道中が緩み、ロングスパートになりやすい。差しも届く。",
      "極端なスローでは前が残る。枠は距離ほど強くない。",
    ],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-2400",
    track: "芝",
    meters: 2400,
    badge: "外",
    course: "外回り",
    place: "スタンド前、ゴールの手前",
    summary: "外回り（神戸新聞杯）。差しに余地。",
    bullets: [
      "外回り。ゴール板を一度通過して1周あまり。直線は473.6m。",
      "発走地点は内回り2000と同じ。こちらは外回りの3〜4角を使う。",
      "中盤が緩みやすく、直線で末脚も要る。",
      "逃げは最後の坂が壁になりやすい。差しに余地。",
    ],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-2600",
    track: "芝",
    meters: 2600,
    badge: "外",
    course: "外回り",
    place: "外回りの4角手前",
    summary: "外回り。施行は少ない。",
    bullets: [
      "外回りの4角に入る前から。直線は473.6m。",
      "ゴール前に急坂。距離のサンプルは薄い。",
    ],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-3000",
    track: "芝",
    meters: 3000,
    badge: "内",
    course: "内回り",
    place: "1〜2角のあいだ",
    summary: "内回り（阪神大賞典）。ゴール前に急坂。",
    bullets: [
      "1〜2角の途中から内回りを1周あまり。",
      "直線は356.5m。長距離でも最後に坂がある。",
    ],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-3200",
    track: "芝",
    meters: 3200,
    badge: "外→内",
    course: "外→内",
    place: "向正面から外へ、その後内",
    summary: "最初が外回りで、4角から内回り。",
    bullets: [
      "向正面から外回りの3〜4角を通り、内回りの直線で終わる。",
      "直線は内回り側の356.5m。ゴール前に急坂。",
    ],
    lap: INNER_LAP,
    rail: "outer-inner",
  },
  {
    id: "dirt-1200",
    track: "ダート",
    meters: 1200,
    badge: "ダ",
    course: "ダート",
    place: "2角の手前",
    summary: "外枠・前。4角後方はほぼ届かない。",
    bullets: [
      "2角の手前からワンターン。コーナーまで長くはない。",
      "外枠が残りやすい。内枠は砂を被りやすい。",
      "4角10番手以下は中央ダ1200でも差しが決まりにくい。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1400",
    track: "ダート",
    meters: 1400,
    badge: "芝発",
    course: "芝スタート",
    place: "芝を約150m",
    summary: "芝スタート。外枠が長い芝を踏める。",
    bullets: [
      "約150mの芝スタート。外側ほど芝が長い。",
      "外枠有利。1200より差しは届きやすいが、後方一辺倒ではない。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1800",
    track: "ダート",
    meters: 1800,
    badge: "直線",
    course: "ダート",
    place: "直線の途中",
    summary: "4角前が強い。最外より5〜6枠。",
    bullets: [
      "直線の途中から。スタート後に坂。1角まで短い。",
      "4角先頭の信頼が厚い。後方からの差しはほぼ届かない。",
      "ダートでも最外一辺倒にはしない。5〜6枠が相対的に良い。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-2000",
    track: "ダート",
    meters: 2000,
    badge: "芝発",
    course: "芝スタート",
    place: "芝からダートへ",
    summary: "芝スタート。好位。逃げ切りは楽ではない。",
    bullets: [
      "芝を約120m踏んでからダートへ。位置を取りやすい。",
      "4角を前で回れる馬が安定。外枠は悪くない。",
    ],
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
    bullets: [
      "向正面から1周あまり。直線は352.7m。ゴール前に坂。",
      "距離のサンプルは薄い。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
];

export function hanshinTemplate(id: string) {
  return HANSHIN_TEMPLATES.find((item) => item.id === id) ?? HANSHIN_TEMPLATES[0];
}

export type MapLabel = { x: number; y: number; text: string };
export type MapLine = { x1: number; y1: number; x2: number; y2: number };

export type HanshinMap = {
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
  chute(GEOM.dirt, GEOM.dirt1400Join, GEOM.dirt1400Len, 36),
  chute(GEOM.dirt, GEOM.dirt2000Join, GEOM.dirt2000Len, 36),
]);

function pocketOf(id: string): { rail: Sample[]; join: number; len: number; side: number } | null {
  const g = GEOM;
  if (id === "dirt-1400") return { rail: g.dirt, join: g.dirt1400Join, len: g.dirt1400Len, side: 36 };
  if (id === "dirt-2000") return { rail: g.dirt, join: g.dirt2000Join, len: g.dirt2000Len, side: 36 };
  return null;
}

function usedMeterPaths(template: HanshinTemplate): Sample[][] {
  const g = GEOM;
  if (template.rail === "outer-inner") {
    const startM = OUTER_LAP + INNER_LAP - template.meters;
    return [slice(g.outer, startM, g.outerJoinM), g.inner];
  }
  const pocket = pocketOf(template.id);
  if (pocket) {
    const lap = pocket.rail[pocket.rail.length - 1].m;
    const head = [chute(pocket.rail, pocket.join, pocket.len, pocket.side), slice(pocket.rail, pocket.join, lap)];
    if (template.meters + 0.05 >= lap) head.push(pocket.rail);
    return head;
  }
  const rail = template.rail === "outer" ? g.outer : template.rail === "dirt" ? g.dirt : g.inner;
  const lap = rail[rail.length - 1].m;
  if (template.meters + 0.05 >= lap) return [rail];
  return [slice(rail, station(lap, template.meters), lap)];
}

function startSample(template: HanshinTemplate): Sample {
  const g = GEOM;
  const pocket = pocketOf(template.id);
  if (pocket) return chute(pocket.rail, pocket.join, pocket.len, pocket.side)[0];
  if (template.rail === "outer-inner") return sampleAt(g.outer, OUTER_LAP + INNER_LAP - template.meters);
  const rail = template.rail === "outer" ? g.outer : template.rail === "dirt" ? g.dirt : g.inner;
  return sampleAt(rail, station(rail[rail.length - 1].m, template.meters));
}

function finishSample(template: HanshinTemplate): Sample {
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

function cornerLabels(template: HanshinTemplate, view: { inner: ScreenPt[]; outer: ScreenPt[]; dirt: ScreenPt[] }): MapLabel[] {
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
  if (template.rail === "inner") put(view.inner, c3, "3角");
  else put(view.outer, g.outerApexM, "3角");
  if (template.rail === "outer") put(view.outer, g.outerCorner4M, "4角");
  else put(view.inner, c4, "4角");
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

export function presentHanshin(id: string): HanshinMap {
  const template = hanshinTemplate(id);
  const view = screens();
  const used = usedMeterPaths(template).map((pts) => pathD(screenSamples(pts, FIT.shift)));
  const hillRail = template.track === "ダート" ? GEOM.dirt : template.rail === "outer" ? GEOM.outer : GEOM.inner;
  const hillView = template.track === "ダート" ? view.dirt : template.rail === "outer" ? view.outer : view.inner;
  const hillLap = hillRail[hillRail.length - 1].m;
  const hillD = pathD(screenSamples(slice(hillRail, hillLap - 200, hillLap - 50), FIT.shift));
  const startS = screenSamples([startSample(template)], FIT.shift)[0];
  const finishS = screenSamples([finishSample(template)], FIT.shift)[0];
  const hillAt = screenAt(hillView, hillLap - 120);
  const labels = [
    ...cornerLabels(template, view),
    { x: startS.x + startS.ox * 28, y: startS.y + startS.oy * 28, text: "発走" },
    { x: finishS.x + finishS.ox * 28, y: finishS.y + finishS.oy * 28, text: "ゴール" },
    { x: hillAt.x + hillAt.ox * 22, y: hillAt.y + hillAt.oy * 22, text: "急坂" },
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

export function hanshinRunPhrase(template: HanshinTemplate) {
  if (template.rail === "outer-inner") return "外回りから内回り";
  if (template.id === "dirt-1400") return "芝を約150m";
  if (template.id === "dirt-2000") return "芝を約120m";
  return lapPhrase(template.meters, template.lap);
}

export function hanshinStraight(template: HanshinTemplate) {
  if (template.track === "ダート") return "352.7m";
  if (template.rail === "outer") return "473.6m";
  return "356.5m";
}

function projectPoint(p: Sample, m: number) {
  return { m, x: p.x, y: p.y, ix: p.ix, iy: p.iy };
}

/**
 * 外回りの3〜4角。向正面が終わってから、直線の入口まで。
 * 4角の標識は直線の手前。直線の入口そのものには置かない。
 */
function outerTurnMarks() {
  const g = GEOM;
  const straightM = g.outerCorner4M;
  const split = sampleAt(g.outer, g.outerSplitM);
  let arcFrom = g.outerSplitM;
  for (const point of g.outer) {
    if (point.m < g.outerSplitM || point.m > straightM + 0.5) continue;
    if (Math.abs(point.y - split.y) <= 4) arcFrom = point.m;
    else break;
  }
  const span = straightM - arcFrom;
  if (span < 80) throw new Error(`外の3〜4角が短い 入口${arcFrom.toFixed(0)} 直線${straightM.toFixed(0)} 幅${span.toFixed(0)}`);
  return {
    arcFrom,
    corner3: arcFrom + span * 0.28,
    corner4: arcFrom + span * 0.72,
    straightM,
  };
}

/**
 * 芝1200内。向正面の入口から内回りを1200m。
 * 図の急坂は直線（ゴール前200mから50m）。3角の標識は模式図の入口より奥。
 */
export function hanshinTurf1200Run() {
  const g = GEOM;
  const startM = station(INNER_LAP, 1200);
  const run = slice(g.inner, startM, INNER_LAP).map((p) => projectPoint(p, p.m - startM));
  const idle = slice(g.inner, 0, startM).map((p) => projectPoint(p, p.m));
  return {
    run,
    idle,
    corner3: g.innerCornerM.c3 - startM,
    corner4: g.innerCornerM.c4 - startM,
    /** 模式図で向正面が終わる地点。コースメモの243mより長い */
    turnFrom: FINISH_TO_CORNER + (INNER_LAP - 2 * HOME) / 2 + HOME - startM,
    hillFrom: INNER_LAP - 200 - startM,
    hillTo: INNER_LAP - 50 - startM,
    straightFrom: INNER_LAP - INNER_STRAIGHT - startM,
  };
}

/**
 * 芝1600・1800外。本線上の発走で、外の3〜4角を回る。ポケットには置かない。
 * 1600は内回り1200と同じ地点（向正面の入口）。1800はその200m手前の向正面。
 * 直線は473.6m。急坂はゴール前（残り200mから50m）で、直線の中にある。
 * 3角の標識は外の弧の途中。コースメモの「1800は3角まで約665m」より奥で、内回り1200の模式図と同じ扱い。
 */
function hanshinTurfOuter(meters: 1600 | 1800) {
  const g = GEOM;
  const startM = station(OUTER_LAP, meters);
  const turn = outerTurnMarks();
  const straightFrom = turn.straightM - startM;
  const corner3 = turn.corner3 - startM;
  const corner4 = turn.corner4 - startM;
  const backFrom = Math.max(0, g.outerSplitM - startM);
  const turnFrom = turn.arcFrom - startM;
  if (!(corner3 < corner4 && corner4 < straightFrom && straightFrom < meters - 200)) {
    throw new Error(`芝${meters}外の並びが直線に乗らない 3角${corner3.toFixed(0)} 4角${corner4.toFixed(0)} 直線${straightFrom.toFixed(0)}`);
  }
  return {
    run: slice(g.outer, startM, OUTER_LAP).map((point) => projectPoint(point, point.m - startM)),
    idle: slice(g.outer, 0, startM).map((point) => projectPoint(point, point.m)),
    backFrom,
    /** 向正面が終わって、外の3角に入る地点 */
    turnFrom,
    corner3,
    corner4,
    straightFrom,
    hillFrom: meters - 200,
    hillTo: meters - 50,
  };
}

export function hanshinTurf1600Run() {
  return hanshinTurfOuter(1600);
}

export function hanshinTurf1800Run() {
  return hanshinTurfOuter(1800);
}

function assertNear(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 3) {
    throw new Error(`${label}: ${actual.toFixed(1)} ≠ ${expected}`);
  }
}

function checkTemplates() {
  const g = GEOM;
  assertNear(g.inner[g.inner.length - 1].m, INNER_LAP, "内回り");
  assertNear(g.outer[g.outer.length - 1].m, OUTER_LAP, "外回り");
  assertNear(g.dirt[g.dirt.length - 1].m, DIRT_LAP, "ダート");
  const s2000 = station(INNER_LAP, 2000);
  assertNear(INNER_LAP - s2000 + FINISH_TO_CORNER, 325, "芝2000の1角");
  const s2200 = station(INNER_LAP, 2200);
  assertNear(INNER_LAP - s2200 + FINISH_TO_CORNER, 525, "芝2200の1角");
  assertNear(s2000 - s2200, 200, "2200は2000の200m後ろ");
  const c3 = FINISH_TO_CORNER + (INNER_LAP - 2 * HOME) / 2 + HOME;
  assertNear(c3 - station(INNER_LAP, 1200), 370, "芝1200の3角（模式図）");
  assertNear(c3 - station(INNER_LAP, 1400), 570, "芝1400内の3角（模式図）");
  const p1200 = sampleAt(g.inner, station(INNER_LAP, 1200));
  const p1600 = sampleAt(g.outer, station(OUTER_LAP, 1600));
  if (hypot(p1200.x - p1600.x, p1200.y - p1600.y) > 8) {
    throw new Error("芝1200と芝1600の発走がずれている");
  }
  for (const p of g.outer) {
    if (p.m < g.outerSplitM || p.m > g.outerJoinM) continue;
    if (insideInner(p, (INNER_LAP - 2 * HOME) / (2 * Math.PI), HOME)) {
      throw new Error(`外回りが内に入っている ${p.m.toFixed(0)}`);
    }
  }
  assertNear(g.dirt1400Len + (DIRT_LAP - g.dirt1400Join), 1400, "ダート1400");
  const turf1200 = hanshinTurf1200Run();
  const turf1600 = hanshinTurf1600Run();
  const turf1800 = hanshinTurf1800Run();
  assertNear(turf1200.run[turf1200.run.length - 1].m, 1200, "芝1200走行のゴール");
  assertNear(turf1600.run[turf1600.run.length - 1].m, 1600, "芝1600走行のゴール");
  assertNear(turf1800.run[turf1800.run.length - 1].m, 1800, "芝1800走行のゴール");
  assertNear(1600 - turf1600.straightFrom, OUTER_STRAIGHT, "芝1600の直線");
  assertNear(1800 - turf1800.straightFrom, OUTER_STRAIGHT, "芝1800の直線");
  assertNear(turf1800.corner3 - turf1600.corner3, 200, "芝1800の3角は1600の200m後");
  assertNear(turf1800.backFrom, 200, "芝1800は向正面の入口の200m手前");
  assertNear(turf1600.turnFrom, 668, "芝1600の3角入口");
  assertNear(turf1800.turnFrom, 868, "芝1800の3角入口");
  assertNear(turf1600.corner3, 796, "芝1600の3角");
  assertNear(turf1800.corner3, 996, "芝1800の3角");
  if (g.outerApexM < turf1800.turnFrom + station(OUTER_LAP, 1800)) {
    throw new Error(`外回り3角の頂上が向正面にある ${g.outerApexM.toFixed(0)}`);
  }
  if (turf1600.backFrom > 5) throw new Error(`芝1600が向正面の入口にない ${turf1600.backFrom.toFixed(0)}`);
  if (!(turf1600.corner4 < turf1600.straightFrom && turf1600.straightFrom < turf1600.hillFrom && turf1600.hillTo < 1600)) {
    throw new Error("芝1600の急坂が直線にない");
  }
  if (!(turf1800.corner4 < turf1800.straightFrom && turf1800.straightFrom < turf1800.hillFrom && turf1800.hillTo < 1800)) {
    throw new Error("芝1800の急坂が直線にない");
  }
  const p1800at1600 = turf1800.run.reduce((best, point) =>
    Math.abs(point.m - 200) < Math.abs(best.m - 200) ? point : best,
  );
  if (hypot(p1800at1600.x - turf1600.run[0].x, p1800at1600.y - turf1600.run[0].y) > 8) {
    throw new Error("芝1800の200m地点が芝1600の発走とずれている");
  }
  assertNear(turf1200.turnFrom, 370, "芝1200の3角入口");
  assertNear(turf1200.corner3, 502.2, "芝1200走行の3角");
  assertNear(turf1200.corner4, 710.8, "芝1200走行の4角");
  assertNear(1200 - turf1200.straightFrom, INNER_STRAIGHT, "芝1200の直線");
  assertNear(turf1200.hillFrom, 1000, "芝1200の急坂");
  if (!(turf1200.corner4 < turf1200.straightFrom && turf1200.straightFrom < turf1200.hillFrom && turf1200.hillTo < 1200)) {
    throw new Error("芝1200の急坂が直線にない");
  }
  const s1800 = station(OUTER_LAP, 1800);
  if (g.outerApexM < s1800 + 200) throw new Error(`外回り3角が近すぎる ${g.outerApexM.toFixed(0)}`);
  const ids = new Set(HANSHIN_TEMPLATES.map((item) => item.id));
  if (ids.size !== HANSHIN_TEMPLATES.length) throw new Error("テンプレートidが重複");
  for (const item of HANSHIN_TEMPLATES) {
    const map = presentHanshin(item.id);
    const [, , width, height] = map.viewBox.split(/\s+/).map(Number);
    for (const label of map.labels) {
      if (label.x < 16 || label.y < 12 || label.x > width - 16 || label.y > height - 12) {
        throw new Error(`${item.id} の${label.text}が図の外 (${label.x.toFixed(0)},${label.y.toFixed(0)})`);
      }
    }
  }
}

checkTemplates();

/** 内・外が分かれる1400はここを呼ばない。2000以上の芝と全ダート */
export function hanshinFlatGeom(templateId: string) {
  const template = HANSHIN_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return null;
  const g = GEOM;
  const turfHill: Array<[number, number]> = [[200, 50]];
  const dirtHill: Array<[number, number]> = [[160, 40]];
  if (template.rail === "outer-inner") {
    const startM = OUTER_LAP + INNER_LAP - template.meters;
    const outer = asRaw(slice(g.outer, startM, g.outerJoinM));
    const inner = asRaw(g.inner);
    return assembleFlat({
      meters: template.meters,
      head: [outer, inner],
      loop: spanOf(outer) + spanOf(inner) + 8 < template.meters ? asRaw(g.inner) : null,
      resume: 0,
      lap: INNER_LAP,
      finishJoinRace: spanOf(outer),
      finishJoinRail: 0,
      c1: g.innerCornerM.c1,
      c3: g.innerCornerM.c3,
      c4: g.innerCornerM.c4,
      straight: INNER_STRAIGHT,
      hillsBeforeFinish: turfHill,
    });
  }
  if (template.id === "dirt-1400" || template.id === "dirt-2000") {
    const len = template.id === "dirt-1400" ? g.dirt1400Len : g.dirt2000Len;
    const join = template.id === "dirt-1400" ? g.dirt1400Join : g.dirt2000Join;
    const chutePts = withSpan(chute(g.dirt, join, len, 36), len);
    const after = asRaw(slice(g.dirt, join, DIRT_LAP));
    return assembleFlat({
      meters: template.meters,
      head: [chutePts, after],
      loop: len + spanOf(after) + 8 < template.meters ? asRaw(g.dirt) : null,
      resume: 0,
      lap: DIRT_LAP,
      finishJoinRace: len,
      finishJoinRail: join,
      c1: g.dirtCornerM.c1,
      c3: g.dirtCornerM.c3,
      c4: g.dirtCornerM.c4,
      straight: DIRT_STRAIGHT,
      hillsBeforeFinish: dirtHill,
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
      ? { c1: g.outerSplitM, c3: g.outerApexM, c4: g.outerCorner4M }
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
    hillsBeforeFinish: dirt ? dirtHill : turfHill,
  });
}
