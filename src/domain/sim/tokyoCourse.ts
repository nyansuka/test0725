/**
 * 東京の平地テンプレート。障害コースは入れない。
 * Aコースの公表値（芝2083.1m・直線525.9m、ダート1899m・直線501.6m）。
 * 発走は、その距離をゴールからコースに沿って戻した位置。
 * 芝2400はゴールの手前316.9m。1角入口まで約350mになるよう、ゴールから1角までを33mにしている。
 * 左右の直線は同じ長さの模式図。向正面の実長（約450m）より長く見える。
 * 1800・2000は芝のポケット、ダート1600は芝スタート。距離が公表値と合う長さにしている。
 */

export type SimTrack = "芝" | "ダート";

export type TokyoTemplate = {
  id: string;
  track: SimTrack;
  meters: number;
  /** ボタンに出す回り */
  badge: string;
  /** 見出しの回り */
  course: string;
  /** 発走位置の短い説明 */
  place: string;
  summary: string;
  bullets: string[];
  /** 周回の数え方に使う一周 */
  lap: number;
  rail: "turf" | "dirt";
};

const TURF_LAP = 2083.1;
const DIRT_LAP = 1899;
const TURF_STRAIGHT = 525.9;
const DIRT_STRAIGHT = 501.6;
/** ゴールから1角入口。2400は350mになる */
const FINISH_TO_CORNER = 33;
const DIRT_FINISH_TO_CORNER = 32;
const HOME = TURF_STRAIGHT + FINISH_TO_CORNER;
const DIRT_HOME = DIRT_STRAIGHT + DIRT_FINISH_TO_CORNER;

const SCALE = 0.42;
const PAD = 72;

type Pt = { x: number; y: number };
type Sample = Pt & { m: number; ix: number; iy: number };
type ScreenPt = { x: number; y: number; m: number; ox: number; oy: number };

type Built = {
  turf: Sample[];
  dirt: Sample[];
  turf1800Join: number;
  turf1800Len: number;
  turf2000Join: number;
  turf2000Len: number;
  dirt1600Join: number;
  dirt1600Len: number;
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

/** 左回り。角度は増やす */
function pushArc(out: Pt[], cx: number, cy: number, r: number, a0: number, sweep: number, step = 8) {
  const len = Math.abs(r * sweep);
  const n = Math.max(8, Math.round(len / step));
  const start = out.length > 0 ? 1 : 0;
  for (let i = start; i <= n; i += 1) {
    const a = a0 + sweep * (i / n);
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

function buildGeometry(): Built {
  const remain = TURF_LAP - 2 * HOME;
  const semi = remain / 2;
  const r = semi / Math.PI;
  const finish: Pt = { x: TURF_STRAIGHT, y: 0 };
  const c1: Pt = { x: HOME, y: 0 };
  const back0: Pt = { x: HOME, y: 2 * r };
  const back1: Pt = { x: 0, y: 2 * r };
  const c4out: Pt = { x: 0, y: 0 };

  const turfPts: Pt[] = [];
  pushLine(turfPts, finish, c1);
  pushArc(turfPts, c1.x, r, r, -Math.PI / 2, Math.PI);
  pushLine(turfPts, back0, back1);
  pushArc(turfPts, 0, r, r, Math.PI / 2, Math.PI);
  pushLine(turfPts, c4out, finish);
  const turf = withMeters(turfPts, TURF_LAP);

  const dirtX0 = 18;
  const dirtY = 28;
  const dirtSemi = (DIRT_LAP - 2 * DIRT_HOME) / 2;
  const rd = dirtSemi / Math.PI;
  const dFinish: Pt = { x: dirtX0 + DIRT_STRAIGHT, y: dirtY };
  const dC1: Pt = { x: dirtX0 + DIRT_HOME, y: dirtY };
  const dBack0: Pt = { x: dC1.x, y: dirtY + 2 * rd };
  const dBack1: Pt = { x: dirtX0, y: dirtY + 2 * rd };
  const dC4: Pt = { x: dirtX0, y: dirtY };
  const dirtPts: Pt[] = [];
  pushLine(dirtPts, dFinish, dC1);
  pushArc(dirtPts, dC1.x, dirtY + rd, rd, -Math.PI / 2, Math.PI);
  pushLine(dirtPts, dBack0, dBack1);
  pushArc(dirtPts, dC4.x, dirtY + rd, rd, Math.PI / 2, Math.PI);
  pushLine(dirtPts, dC4, dFinish);
  const dirt = withMeters(dirtPts, DIRT_LAP);

  // 1800は1〜2角のポケット。合流まで約150m。
  const turf1800Len = 150;
  const turf1800Join = turf1800Len + (TURF_LAP - 1800);
  // 2000は1角奥。カーブまで約100m。
  const turf2000Len = 100;
  const turf2000Join = turf2000Len + (TURF_LAP - 2000);
  // ダート1600は芝を約150m踏む。
  const dirt1600Len = 150;
  const dirt1600Join = dirt1600Len + (DIRT_LAP - 1600);

  const dirtToCorner = DIRT_FINISH_TO_CORNER;
  const dirtBack0 = dirtToCorner + dirtSemi;

  return {
    turf,
    dirt,
    turf1800Join,
    turf1800Len,
    turf2000Join,
    turf2000Len,
    dirt1600Join,
    dirt1600Len,
    turfCornerM: {
      c1: FINISH_TO_CORNER + semi * 0.35,
      c2: FINISH_TO_CORNER + semi * 0.72,
      c3: FINISH_TO_CORNER + semi + HOME + semi * 0.28,
      c4: FINISH_TO_CORNER + semi + HOME + semi * 0.72,
    },
    dirtCornerM: {
      c1: dirtToCorner + dirtSemi * 0.35,
      c2: dirtToCorner + dirtSemi * 0.72,
      c3: dirtBack0 + DIRT_HOME + dirtSemi * 0.28,
      c4: dirtBack0 + DIRT_HOME + dirtSemi * 0.72,
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

const GEOM = buildGeometry();

function station(lap: number, meters: number) {
  const rem = meters % lap;
  if (rem < 0.05) return 0;
  return lap - rem;
}

function lapPhrase(meters: number, lap: number) {
  if (meters + 0.05 < lap) return "ワンターン";
  const n = Math.floor((meters + 0.05) / lap);
  const rem = Math.round(meters - n * lap);
  if (rem <= 0) return `${n}周`;
  return `${n}周と${rem}m`;
}

export const TOKYO_TEMPLATES: TokyoTemplate[] = [
  {
    id: "turf-1400",
    track: "芝",
    meters: 1400,
    badge: "向",
    course: "芝",
    place: "向正面",
    summary: "直線が長くても前が残りやすい。",
    bullets: [
      "向正面から。スタート後に緩い上り、直線525.9m。",
      "逃げ・先行が残る。差し一辺倒にはしない。",
      "1600以上からの距離短縮だけでは拾わない。",
    ],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-1600",
    track: "芝",
    meters: 1600,
    badge: "向",
    course: "芝",
    place: "向正面の2角寄り",
    summary: "マイル。直線が長くても差し一辺倒ではない。",
    bullets: [
      "2角寄りから。最初のコーナーまで長く、ペースは落ち着きやすい。",
      "逃げ・先行が残る。差しは他の東京芝より届きやすいが、後方一気は軸にしない。",
      "阪神マイル経験・中山マイル危険、だけでは拾わない。",
    ],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-1800",
    track: "芝",
    meters: 1800,
    badge: "ポケ",
    course: "ポケット",
    place: "1〜2角のポケット",
    summary: "ポケット発走。前が残りやすい。",
    bullets: [
      "1〜2角のあいだから。合流まで約150m。すぐコーナーへ入り、序盤は緩みやすい。",
      "逃げ・先行が残る。上がり32〜33秒台だけでは拾わない。",
      "直線は長いが後方一気は弱い。",
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
    place: "1角奥のポケット",
    summary: "ポケットからすぐコーナー。前が残る。内枠は18頭立てに限る。",
    bullets: [
      "1角の奥から。約100mで左へ曲がる。前につけた馬が残りやすい。",
      "内枠有利は天皇賞秋のような多頭数。少頭数では枠差は小さい。",
      "全レースを内枠一辺倒にはしない。",
    ],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-2300",
    track: "芝",
    meters: 2300,
    badge: "直線",
    course: "芝",
    place: "スタンド前の直線",
    summary: "スタンド前から。ゴールを一度通過して1周。",
    bullets: [
      "4角を出て直線の途中から。ゴールまで約217m、そのあと1周。",
      "2400より約100m手前。施行は少ない。",
    ],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-2400",
    track: "芝",
    meters: 2400,
    badge: "直線",
    course: "芝",
    place: "スタンド前、ゴールの手前",
    summary: "ダービー・JC。直線は長いが公平ではない。",
    bullets: [
      "スタンド前から。ゴール板を一度通過し、1角入口まで約350m。",
      "逃げ・先行が残る。4角後方は複勝が落ちる。",
      "内枠の3〜4歳・末脚比べ一辺倒では拾わない。",
    ],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-2500",
    track: "芝",
    meters: 2500,
    badge: "直線",
    course: "芝",
    place: "2400の100m後ろ",
    summary: "2400よりスタミナ。サンプルは薄い。",
    bullets: [
      "2400のスタートを約100m後ろへ。1角まで約450m。施行は少ない。",
      "差し一辺倒・長距離経験だけでは拾わない。",
    ],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-2600",
    track: "芝",
    meters: 2600,
    badge: "4角",
    course: "芝",
    place: "4角の出口",
    summary: "4角を出てすぐ。施行は少ない。",
    bullets: [
      "4角の出口から約10m。ゴール前の坂にすぐ入る。",
      "直線525.9m。初出走だけでは拾わない。",
    ],
    lap: TURF_LAP,
    rail: "turf",
  },
  {
    id: "turf-3400",
    track: "芝",
    meters: 3400,
    badge: "向",
    course: "芝",
    place: "向正面の中ほど",
    summary: "ダイヤモンドS。2周弱。",
    bullets: [
      "向正面から発走し、ゴールを一度通過してさらにもう1周。",
      "坂を2回ずつ超える。施行は少ない。",
    ],
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
    summary: "向正面からワンターン。直線501.6m。",
    bullets: [
      "向正面に入ってから発走し、3角と4角を一度だけ回る。",
      "直線は501.6m。芝スタートではない。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1300",
    track: "ダート",
    meters: 1300,
    badge: "向",
    course: "ダート",
    place: "向正面",
    summary: "コーナーまで短く、前が残る。",
    bullets: [
      "向正面から。最初のコーナーまで短く、スタート直後に緩い上り。",
      "逃げ・先行が残りやすい。",
      "内枠一辺倒にはしない。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1400",
    track: "ダート",
    meters: 1400,
    badge: "向",
    course: "ダート",
    place: "向正面の入口",
    summary: "ダート1400では唯一のダート発走。前が残る。",
    bullets: [
      "阪神・京都・中京の1400は芝スタート。東京だけダート発走。",
      "逃げ・先頭の複勝が厚い。関西の差し追い込みだけでは拾わない。",
      "枠差は芝スタートほど大きくない。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1600",
    track: "ダート",
    meters: 1600,
    badge: "芝発",
    course: "芝スタート",
    place: "2角寄りの芝から",
    summary: "芝スタート。外枠が長い芝を踏める。",
    bullets: [
      "フェブラリーSの舞台。芝を約150m踏んでからダートへ。外側ほど芝が長い。",
      "外枠有利。砂を被りにくい。",
      "距離短縮の関西馬だけでは拾わない。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-2100",
    track: "ダート",
    meters: 2100,
    badge: "直線",
    course: "ダート",
    place: "直線の途中",
    summary: "1角まで短く、前が残りやすい。",
    bullets: [
      "直線の途中から。ゴールまで約201m走って1周。1角まで短い。",
      "逃げ・先行が残りやすい。スローになりやすい。",
      "キタサンブラック産駒の数字だけでは拾わない。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-2400",
    track: "ダート",
    meters: 2400,
    badge: "4角",
    course: "ダート",
    place: "4角の出口",
    summary: "4角を出て1周あまり。施行は少ない。",
    bullets: [
      "4角の出口から発走する。直線は501.6m。",
      "距離のサンプルは薄い。初出走だけでは拾わない。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
];

export function tokyoTemplate(id: string) {
  return TOKYO_TEMPLATES.find((item) => item.id === id) ?? TOKYO_TEMPLATES[0];
}

export type MapLabel = { x: number; y: number; text: string };
export type MapLine = { x1: number; y1: number; x2: number; y2: number };

export type TokyoMap = {
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
  chute(GEOM.turf, GEOM.turf1800Join, GEOM.turf1800Len, 40),
  chute(GEOM.turf, GEOM.turf2000Join, GEOM.turf2000Len, 40),
  chute(GEOM.dirt, GEOM.dirt1600Join, GEOM.dirt1600Len, 32),
]);

function pocketOf(id: string): { rail: Sample[]; join: number; len: number; side: number } | null {
  const g = GEOM;
  if (id === "turf-1800") return { rail: g.turf, join: g.turf1800Join, len: g.turf1800Len, side: 40 };
  if (id === "turf-2000") return { rail: g.turf, join: g.turf2000Join, len: g.turf2000Len, side: 40 };
  if (id === "dirt-1600") return { rail: g.dirt, join: g.dirt1600Join, len: g.dirt1600Len, side: 32 };
  return null;
}

function usedMeterPaths(template: TokyoTemplate): Sample[][] {
  const pocket = pocketOf(template.id);
  if (pocket) {
    const lap = pocket.rail[pocket.rail.length - 1].m;
    return [chute(pocket.rail, pocket.join, pocket.len, pocket.side), slice(pocket.rail, pocket.join, lap)];
  }
  const rail = template.rail === "dirt" ? GEOM.dirt : GEOM.turf;
  const lap = rail[rail.length - 1].m;
  if (template.meters + 0.05 >= lap) return [rail];
  return [slice(rail, station(lap, template.meters), lap)];
}

function startSample(template: TokyoTemplate): Sample {
  const pocket = pocketOf(template.id);
  if (pocket) return chute(pocket.rail, pocket.join, pocket.len, pocket.side)[0];
  const rail = template.rail === "dirt" ? GEOM.dirt : GEOM.turf;
  return sampleAt(rail, station(rail[rail.length - 1].m, template.meters));
}

function finishSample(template: TokyoTemplate): Sample {
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

function cornerLabels(template: TokyoTemplate, view: { turf: ScreenPt[]; dirt: ScreenPt[] }): MapLabel[] {
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

export function presentTokyo(id: string): TokyoMap {
  const template = tokyoTemplate(id);
  const view = screens();
  const used = usedMeterPaths(template).map((pts) => pathD(screenSamples(pts, FIT.shift)));
  const finishRail = template.track === "ダート" ? view.dirt : view.turf;
  const finishLap = template.track === "ダート" ? DIRT_LAP : TURF_LAP;
  const hillPts = template.track === "ダート" ? GEOM.dirt : GEOM.turf;
  const hillD = pathD(screenSamples(slice(hillPts, finishLap - 460, finishLap - 300), FIT.shift));

  const startS = screenSamples([startSample(template)], FIT.shift)[0];
  const finishS = screenSamples([finishSample(template)], FIT.shift)[0];
  const hillAt = screenAt(finishRail, finishLap - 430);
  const labels = [
    ...cornerLabels(template, view),
    { x: startS.x + startS.ox * 28, y: startS.y + startS.oy * 28, text: "発走" },
    { x: finishS.x + finishS.ox * 28, y: finishS.y + finishS.oy * 28, text: "ゴール" },
    { x: hillAt.x + hillAt.ox * 22, y: hillAt.y + hillAt.oy * 22, text: "坂" },
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

export function tokyoRunPhrase(template: TokyoTemplate) {
  if (template.id === "turf-1800" || template.id === "turf-2000") return "ポケット発走";
  if (template.id === "dirt-1600") return "芝を約150m";
  return lapPhrase(template.meters, template.lap);
}

function projectPoint(p: Sample, m: number) {
  return { m, x: p.x, y: p.y, ix: p.ix, iy: p.iy };
}

/** 芝1400・1600。向正面から本線をゴールまで。直線は525.9m。坂は直線の入口。 */
function tokyoTurfOneTurn(meters: number) {
  const g = GEOM;
  const startM = station(TURF_LAP, meters);
  const run = slice(g.turf, startM, TURF_LAP).map((p) => projectPoint(p, p.m - startM));
  const idle = slice(g.turf, 0, startM).map((p) => projectPoint(p, p.m));
  return {
    run,
    idle,
    corner3: g.turfCornerM.c3 - startM,
    corner4: g.turfCornerM.c4 - startM,
    straightFrom: TURF_LAP - TURF_STRAIGHT - startM,
    hillFrom: TURF_LAP - 460 - startM,
    hillTo: TURF_LAP - 300 - startM,
  };
}

export function tokyoTurf1400Run() {
  return tokyoTurfOneTurn(1400);
}

export function tokyoTurf1600Run() {
  return tokyoTurfOneTurn(1600);
}

/** ポケットのゲート。本線ではなく、発走の後ろを同じだけ外へずらす */
function pocketApproach(samples: Sample[], joinM: number, length: number, side: number, back = 160) {
  const lap = samples[samples.length - 1].m;
  const n = Math.max(8, Math.round(back / 8));
  const pts: ReturnType<typeof projectPoint>[] = [];
  for (let i = 0; i <= n; i += 1) {
    const behind = back * (1 - i / n);
    let railM = joinM - length - behind;
    while (railM < 0) railM += lap;
    const rail = sampleAt(samples, railM);
    pts.push({
      m: (i / n) * back,
      x: rail.x - rail.ix * side,
      y: rail.y - rail.iy * side,
      ix: rail.ix,
      iy: rail.iy,
    });
  }
  return pts;
}

/**
 * 芝1800・2000。ポケットから本線に入る。ゴールから本線を戻した位置には置かない。
 * 1800は1〜2角、合流まで150m。2000は1角の奥、100mで曲がる。直線はどちらも525.9m。
 */
function tokyoTurfPocket(meters: 1800 | 2000) {
  const g = GEOM;
  const len = meters === 1800 ? g.turf1800Len : g.turf2000Len;
  const join = meters === 1800 ? g.turf1800Join : g.turf2000Join;
  const side = 40;
  const railStart = TURF_LAP - meters;
  const pocket = chute(g.turf, join, len, side);
  const last = pocket.length - 1;
  const run = pocket.map((p, i) => projectPoint(p, len * (i / last)));
  const rail = slice(g.turf, join, TURF_LAP);
  for (let i = 1; i < rail.length; i += 1) {
    const p = rail[i];
    run.push(projectPoint(p, len + (p.m - join)));
  }
  return {
    run,
    idle: slice(g.turf, 0, join).map((p) => projectPoint(p, p.m)),
    approach: pocketApproach(g.turf, join, len, side),
    pocketJoin: len,
    railStart,
    corner3: g.turfCornerM.c3 - railStart,
    corner4: g.turfCornerM.c4 - railStart,
    straightFrom: TURF_LAP - TURF_STRAIGHT - railStart,
    hillFrom: TURF_LAP - 460 - railStart,
    hillTo: TURF_LAP - 300 - railStart,
  };
}

export function tokyoTurf1800Run() {
  return tokyoTurfPocket(1800);
}

export function tokyoTurf2000Run() {
  return tokyoTurfPocket(2000);
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
    m: meter,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    ix: a.ix + (b.ix - a.ix) * t,
    iy: a.iy + (b.iy - a.iy) * t,
  };
}

function assertNear(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 3) {
    throw new Error(`${label}: ${actual.toFixed(1)} ≠ ${expected}`);
  }
}

function checkTemplates() {
  const g = GEOM;
  assertNear(g.turf[g.turf.length - 1].m, TURF_LAP, "芝");
  assertNear(g.dirt[g.dirt.length - 1].m, DIRT_LAP, "ダート");
  const s2400 = station(TURF_LAP, 2400);
  assertNear(TURF_LAP - s2400 + FINISH_TO_CORNER, 350, "芝2400の1角");
  const s2500 = station(TURF_LAP, 2500);
  assertNear(s2400 - s2500, 100, "2500は2400の100m後ろ");
  assertNear(TURF_LAP - s2500 + FINISH_TO_CORNER, 450, "芝2500の1角");
  const s2600 = station(TURF_LAP, 2600);
  assertNear(s2600 - (TURF_LAP - TURF_STRAIGHT), 9, "芝2600は4角出口の直後");
  assertNear(g.turf1800Len + (TURF_LAP - g.turf1800Join), 1800, "芝1800");
  assertNear(g.turf2000Len + (TURF_LAP - g.turf2000Join), 2000, "芝2000");
  assertNear(g.dirt1600Len + (DIRT_LAP - g.dirt1600Join), 1600, "ダート1600");
  const s2100 = station(DIRT_LAP, 2100);
  assertNear(DIRT_LAP - s2100, 201, "ダート2100のゴールまで");
  const sDirt2400 = station(DIRT_LAP, 2400);
  assertNear(sDirt2400 - (DIRT_LAP - DIRT_STRAIGHT), 0.6, "ダート2400は4角出口");
  const turf1400 = tokyoTurf1400Run();
  const turf1600 = tokyoTurf1600Run();
  assertNear(turf1400.run[turf1400.run.length - 1].m, 1400, "芝1400走行のゴール");
  assertNear(turf1600.run[turf1600.run.length - 1].m, 1600, "芝1600走行のゴール");
  assertNear(turf1400.corner3, 526.6, "芝1400の3角");
  assertNear(turf1600.corner3, 726.6, "芝1600の3角");
  assertNear(1400 - turf1400.straightFrom, TURF_STRAIGHT, "芝1400の直線");
  assertNear(1600 - turf1600.straightFrom, TURF_STRAIGHT, "芝1600の直線");
  assertNear(turf1600.corner3 - turf1400.corner3, 200, "1600は1400の200m手前");
  if (!(turf1400.corner4 < turf1400.straightFrom && turf1400.straightFrom < turf1400.hillFrom && turf1400.hillTo < 1400)) {
    throw new Error("芝1400の坂が直線にない");
  }
  if (!(turf1600.corner4 < turf1600.straightFrom && turf1600.straightFrom < turf1600.hillFrom && turf1600.hillTo < 1600)) {
    throw new Error("芝1600の坂が直線にない");
  }
  for (const meters of [1800, 2000] as const) {
    const pocket = meters === 1800 ? tokyoTurf1800Run() : tokyoTurf2000Run();
    const len = meters === 1800 ? g.turf1800Len : g.turf2000Len;
    const join = meters === 1800 ? g.turf1800Join : g.turf2000Join;
    assertNear(pocket.run[pocket.run.length - 1].m, meters, `芝${meters}走行のゴール`);
    assertNear(pocket.pocketJoin, len, `芝${meters}のポケット`);
    assertNear(pocket.railStart, TURF_LAP - meters, `芝${meters}の横の本線`);
    assertNear(meters - pocket.straightFrom, TURF_STRAIGHT, `芝${meters}の直線`);
    if (!(pocket.pocketJoin < pocket.corner3 && pocket.corner3 < pocket.corner4 && pocket.corner4 < pocket.straightFrom)) {
      throw new Error(`芝${meters}の並び: ポケット${pocket.pocketJoin} 3角${pocket.corner3.toFixed(1)}`);
    }
    if (!(pocket.straightFrom < pocket.hillFrom && pocket.hillTo < meters)) {
      throw new Error(`芝${meters}の坂が直線にない`);
    }
    const beside = sampleAt(g.turf, pocket.railStart);
    const off = hypot(pocket.run[0].x - beside.x, pocket.run[0].y - beside.y);
    if (Math.abs(off - 40) > 1) throw new Error(`芝${meters}の発走が本線上 ${off.toFixed(1)}`);
    const joined = runPoint(pocket.run, pocket.pocketJoin);
    const railJoin = sampleAt(g.turf, join);
    if (hypot(joined.x - railJoin.x, joined.y - railJoin.y) > 1) {
      throw new Error(`芝${meters}のポケットが本線に届いていない`);
    }
    const gate = pocket.approach[pocket.approach.length - 1];
    if (hypot(gate.x - pocket.run[0].x, gate.y - pocket.run[0].y) > 1) {
      throw new Error(`芝${meters}のゲートがポケットの後ろにない`);
    }
    if (!pocket.run.every((point, index) => index === 0 || point.m > pocket.run[index - 1].m)) {
      throw new Error(`芝${meters}の点列が戻っている`);
    }
  }
  const pocket1800 = tokyoTurf1800Run();
  const pocket2000 = tokyoTurf2000Run();
  assertNear(pocket2000.corner3 - pocket1800.corner3, 200, "2000の3角は1800の200m後");
  if (pocket2000.pocketJoin === pocket1800.pocketJoin) throw new Error("1800と2000のポケットが同じ");
  const ids = new Set(TOKYO_TEMPLATES.map((item) => item.id));
  if (ids.size !== TOKYO_TEMPLATES.length) throw new Error("テンプレートidが重複");
  for (const item of TOKYO_TEMPLATES) {
    const map = presentTokyo(item.id);
    const [, , width, height] = map.viewBox.split(/\s+/).map(Number);
    for (const label of map.labels) {
      if (label.x < 16 || label.y < 12 || label.x > width - 16 || label.y > height - 12) {
        throw new Error(`${item.id} の${label.text}が図の外`);
      }
    }
  }
}

checkTemplates();
