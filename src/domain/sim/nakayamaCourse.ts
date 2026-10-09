import { asRaw, assembleFlat, spanOf, withSpan } from "@/domain/sim/flatPath";

/**
 * 中山の平地テンプレート。障害コースは入れない。
 * Aコースの公表値（芝内1667.1m、芝外1839.7m、ダート1493m、直線は芝310m・ダート308m）。
 * 発走は、その距離をゴールからコースに沿って戻した位置。
 * 芝1800の「1角まで約205m」と芝2200の「約432m」が両立するよう、ゴールから1角までを72mにしている。
 * 外回りは直線を内回りと共有し、コーナー半径だけ大きい。向正面の上に山は作らない。
 */

export type SimTrack = "芝" | "ダート";

export type NakayamaTemplate = {
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
  rail: "inner" | "outer" | "dirt" | "outer-inner";
};

const INNER_LAP = 1667.1;
const OUTER_LAP = 1839.7;
const DIRT_LAP = 1493;
const TURF_STRAIGHT = 310;
const DIRT_STRAIGHT = 308;
/** ゴールから1角入口。1800は205m、2200は432mになる */
const FINISH_TO_CORNER = 72;
const HOME = TURF_STRAIGHT + FINISH_TO_CORNER;

const SCALE = 0.9;
const PAD = 46;

type Pt = { x: number; y: number };
type Sample = Pt & { m: number; ix: number; iy: number };
type ScreenPt = { x: number; y: number; m: number; ox: number; oy: number };

type Built = {
  inner: Sample[];
  outer: Sample[];
  dirt: Sample[];
  /** 外回りが内回りの4角出口で重なる地点 */
  outerJoinM: number;
  /** 外回りが分かれ始める地点（1角） */
  outerSplitM: number;
  /** 芝1200の3角。発走から438m */
  outerCorner3M: number;
  dirtJoin1200: number;
  chute1600Join: number;
  chute1600Len: number;
  chute1200Len: number;
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

function buildGeometry(): Built {
  const remain = INNER_LAP - 2 * HOME;
  const semi = remain / 2;
  const r = semi / Math.PI;
  const finish: Pt = { x: -TURF_STRAIGHT, y: 0 };
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

  // 直線は内回りと同じ。一周の差はコーナー半径だけ。4角出口 (0,0) で重なる。
  const rOuter = (OUTER_LAP - 2 * HOME) / (2 * Math.PI);
  const oBack0: Pt = { x: -HOME, y: 2 * rOuter };
  const oBack1: Pt = { x: 0, y: 2 * rOuter };
  const outerPts: Pt[] = [];
  pushLine(outerPts, finish, c1);
  pushArc(outerPts, c1.x, rOuter, rOuter, -Math.PI / 2, Math.PI);
  pushLine(outerPts, oBack0, oBack1);
  pushArc(outerPts, 0, rOuter, rOuter, Math.PI / 2, Math.PI);
  pushLine(outerPts, c4out, finish);
  const outer = withMeters(outerPts, OUTER_LAP);
  const outerSplitM = nearestM(outer, c1);
  const outerJoinM = nearestM(outer, c4out);
  const outerCorner3M = OUTER_LAP - 1200 + 438;

  const dirtLeft = -HOME + 20;
  const dirtRight = -20;
  const dirtStraightSpan = dirtRight - dirtLeft;
  const dirtSemi = (DIRT_LAP - 2 * dirtStraightSpan) / 2;
  const rd = dirtSemi / Math.PI;
  const dirtY = 22;
  const dFinish: Pt = { x: dirtRight - DIRT_STRAIGHT, y: dirtY };
  const dC1: Pt = { x: dirtLeft, y: dirtY };
  const dBack0: Pt = { x: dirtLeft, y: dirtY + 2 * rd };
  const dBack1: Pt = { x: dirtRight, y: dirtY + 2 * rd };
  const dC4: Pt = { x: dirtRight, y: dirtY };
  const dirtPts: Pt[] = [];
  pushLine(dirtPts, dFinish, dC1);
  pushArc(dirtPts, dC1.x, dirtY + rd, rd, -Math.PI / 2, Math.PI);
  pushLine(dirtPts, dBack0, dBack1);
  pushArc(dirtPts, dC4.x, dirtY + rd, rd, Math.PI / 2, Math.PI);
  pushLine(dirtPts, dC4, dFinish);
  const dirt = withMeters(dirtPts, DIRT_LAP);
  const dirtToCorner = dirtStraightSpan - DIRT_STRAIGHT;
  const dirtRight0 = dirtToCorner + dirtSemi + dirtStraightSpan;

  // 1600は1角横。レール上だと2角の途中（360m）なので、その120m手前をポケットにする。
  const chute1600Len = 120;
  const chute1600Join = chute1600Len + (OUTER_LAP - 1600);
  // ダート1200は向正面の芝を180m踏んでからダート。
  const chute1200Len = 180;

  return {
    inner,
    outer,
    dirt,
    outerJoinM,
    outerSplitM,
    outerCorner3M,
    dirtJoin1200: chute1200Len + (DIRT_LAP - 1200),
    chute1600Join,
    chute1600Len,
    chute1200Len,
    innerCornerM: {
      c1: FINISH_TO_CORNER + semi * 0.28,
      c2: FINISH_TO_CORNER + semi * 0.72,
      c3: FINISH_TO_CORNER + semi + HOME + semi * 0.22,
      c4: FINISH_TO_CORNER + semi + HOME + semi * 0.72,
    },
    dirtCornerM: {
      c1: dirtToCorner + dirtSemi * 0.28,
      c2: dirtToCorner + dirtSemi * 0.72,
      c3: dirtRight0 + dirtSemi * 0.22,
      c4: dirtRight0 + dirtSemi * 0.72,
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

export const NAKAYAMA_TEMPLATES: NakayamaTemplate[] = [
  {
    id: "turf-1200",
    track: "芝",
    meters: 1200,
    badge: "外",
    course: "外回り",
    place: "2角の先、向正面",
    summary: "外回り。向正面の下り。前と内枠。",
    bullets: [
      "2角奥、坂の頂上付近から発走。下りを使って3角へ。最初のコーナーまで約440m。",
      "序盤が速くなりやすい。逃げ・先行と内枠が残りやすい。",
      "直線310mに急坂。平坦のスピードだけでは押し切れない。",
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
    place: "1角横のポケット",
    summary: "外回りマイル。1角ポケット。内枠と好位。",
    bullets: [
      "1角横のポケット発走。最初のコーナーまで約240mと短い。",
      "外枠は内に入れるまでロスが出やすい。内で位置を取れる馬。",
      "東京・阪神マイルより直線が短い。後方一辺倒の差しは軸にしない。",
    ],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-1800",
    track: "芝",
    meters: 1800,
    badge: "内",
    course: "内回り",
    place: "スタンド前の直線",
    summary: "内回り。スタート直後が急坂。内枠の逃げ・先行。",
    bullets: [
      "スタンド前半ばから発走。直後に急坂、最初のコーナーまで約205m。",
      "序盤が緩みやすい。内枠の逃げ・先行がロスなく先行できる。",
      "直線310m。外から被せると消耗しやすい。",
    ],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-2000",
    track: "芝",
    meters: 2000,
    badge: "内",
    course: "内回り",
    place: "4角の出口手前",
    summary: "内回り（皐月賞）。1角まで長く、好位。枠差は小さい。",
    bullets: [
      "1800のスタートより約200m後ろ。最初のコーナーまで約405m。",
      "外枠も先行争いに加わりやすい。差し一辺倒にはしない。",
      "直線は短く急坂あり。4角である程度前にいる馬。",
    ],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-2200",
    track: "芝",
    meters: 2200,
    badge: "外",
    course: "外回り",
    place: "4角の出口付近",
    summary: "外回り。スタートは2000に近いが内回りではない。",
    bullets: [
      "4角出口付近から発走。最初のコーナーまで約432m。2000は内回り、こちらは外回り。",
      "カーブが緩くスピードに乗りやすい。枠の偏りは小さい。",
      "直線は短いので後方一気は弱い。極端なスローでは前も残る。",
    ],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-2500",
    track: "芝",
    meters: 2500,
    badge: "外→内",
    course: "内回り",
    place: "外回りの3角手前",
    summary: "内回り（有馬記念）。ポケット発走。タフで総合力。",
    bullets: [
      "外回りの3角手前から発走。最初のコーナーまで約70m。4角の出口で内回りと重なる。",
      "アップダウンが多く、向正面の下りでペースが上がりやすい。",
      "直線が短いので位置取りも要る。初出走・2600未経験だけでは拾わない。",
    ],
    lap: INNER_LAP,
    rail: "outer-inner",
  },
  {
    id: "turf-2600",
    track: "芝",
    meters: 2600,
    badge: "外",
    course: "外回り",
    place: "外回りの3角側",
    summary: "外回り。直線310m、ゴール前に急坂。",
    bullets: [
      "外回りを1周あまり。3角側から入る。",
      "直線は内回りと同じ310m。枠の有利不利はここに載せていない。",
    ],
    lap: OUTER_LAP,
    rail: "outer",
  },
  {
    id: "turf-3200",
    track: "芝",
    meters: 3200,
    badge: "外→内",
    course: "外→内",
    place: "2角から外回り、その後は内",
    summary: "最初が外回りで、4角の出口から内回り。",
    bullets: [
      "2角あたりから外回りに入り、4角の出口で内回りと重なる。",
      "直線は310m。ゴール前に急坂。",
    ],
    lap: INNER_LAP,
    rail: "outer-inner",
  },
  {
    id: "turf-3600",
    track: "芝",
    meters: 3600,
    badge: "内",
    course: "内回り",
    place: "4角を出てすぐ",
    summary: "内回り。直線310m、ゴール前に急坂。",
    bullets: [
      "4角を出たあたりの直線から発走し、内回りを2周あまり。",
      "ステイヤーズステークスの距離。直線は310m。",
    ],
    lap: INNER_LAP,
    rail: "inner",
  },
  {
    id: "turf-4000",
    track: "芝",
    meters: 4000,
    badge: "外",
    course: "外回り",
    place: "4角の出口付近",
    summary: "外回り。直線310m、ゴール前に急坂。",
    bullets: [
      "4角の出口付近から発走し、外回りを2周あまり。",
      "直線は310m。施行は少ない。",
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
    place: "向正面からワンターン",
    summary: "向正面から3〜4角。直線308m。",
    bullets: [
      "向正面に入ってから発走し、3角と4角を一度だけ回る。",
      "直線は308m。ゴール前に急坂。フルゲートは14頭。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1200",
    track: "ダート",
    meters: 1200,
    badge: "芝発",
    course: "ダート",
    place: "向正面の芝から",
    summary: "芝スタート。外枠・前。",
    bullets: [
      "向正面の芝から発走しダートへ。外側ほど芝が長い。",
      "下りでテンが速くなりやすい。外枠の逃げ・先行が残りやすい。",
      "直線308mに急坂。内枠は砂を被りやすい。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1700",
    track: "ダート",
    meters: 1700,
    badge: "ダ",
    course: "ダート",
    place: "直線の途中",
    summary: "直線の途中から1周。直線308m。",
    bullets: [
      "4角を出て、直線の途中から発走する。",
      "直線は308m。ゴール前に急坂。フルゲートは12頭。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-1800",
    track: "ダート",
    meters: 1800,
    badge: "ダ",
    course: "ダート",
    place: "4角の出口",
    summary: "スタート後に坂。4角前が強い。所属では分けない。",
    bullets: [
      "スタート後が上り。ゴール前にも急坂。砂が深いと時計がかかる。",
      "4角で前にいる馬が安定。後方からの差しは届きにくい。",
      "枠の偏りは距離ほど強くない。関西馬という理由だけでは拾わない。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-2400",
    track: "ダート",
    meters: 2400,
    badge: "ダ",
    course: "ダート",
    place: "向正面",
    summary: "施行が少ない長距離ダート。サンプルは薄い。",
    bullets: [
      "高低差と急坂がありスタミナが要る。年間の施行は少ない。",
      "初出走やクラス落ちだけでは拾わない。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
  {
    id: "dirt-2500",
    track: "ダート",
    meters: 2500,
    badge: "ダ",
    course: "ダート",
    place: "2角を出て向正面",
    summary: "長距離ダート。直線308m。施行は少ない。",
    bullets: [
      "2角を出た向正面から発走し、1周あまり。",
      "直線は308m。ゴール前に急坂。距離のサンプルは薄い。",
    ],
    lap: DIRT_LAP,
    rail: "dirt",
  },
];

export function nakayamaTemplate(id: string) {
  return NAKAYAMA_TEMPLATES.find((item) => item.id === id) ?? NAKAYAMA_TEMPLATES[0];
}

export type MapLabel = { x: number; y: number; text: string };
export type MapLine = { x1: number; y1: number; x2: number; y2: number };

export type NakayamaMap = {
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

const FIT = shiftFor([GEOM.inner, GEOM.outer, GEOM.dirt, chute(GEOM.outer, GEOM.chute1600Join, GEOM.chute1600Len, 36)]);

function usedMeterPaths(template: NakayamaTemplate): Sample[][] {
  const g = GEOM;
  if (template.rail === "outer-inner") {
    const startM = OUTER_LAP + INNER_LAP - template.meters;
    return [slice(g.outer, startM, g.outerJoinM), g.inner];
  }
  if (template.id === "turf-1600") {
    return [
      chute(g.outer, g.chute1600Join, g.chute1600Len, 34),
      slice(g.outer, g.chute1600Join, OUTER_LAP),
    ];
  }
  if (template.id === "dirt-1200") {
    return [
      chute(g.dirt, g.dirtJoin1200, g.chute1200Len, 28),
      slice(g.dirt, g.dirtJoin1200, DIRT_LAP),
    ];
  }
  const rail = template.rail === "outer" ? g.outer : template.rail === "dirt" ? g.dirt : g.inner;
  const lap = rail[rail.length - 1].m;
  if (template.meters + 0.05 >= lap) return [rail];
  return [slice(rail, station(lap, template.meters), lap)];
}

function startSample(template: NakayamaTemplate): Sample {
  const g = GEOM;
  if (template.id === "turf-1600") return chute(g.outer, g.chute1600Join, g.chute1600Len, 34)[0];
  if (template.id === "dirt-1200") return chute(g.dirt, g.dirtJoin1200, g.chute1200Len, 28)[0];
  if (template.rail === "outer-inner") {
    return sampleAt(g.outer, OUTER_LAP + INNER_LAP - template.meters);
  }
  const rail = template.rail === "outer" ? g.outer : template.rail === "dirt" ? g.dirt : g.inner;
  return sampleAt(rail, station(rail[rail.length - 1].m, template.meters));
}

function finishSample(template: NakayamaTemplate): Sample {
  if (template.track === "ダート") return sampleAt(GEOM.dirt, DIRT_LAP);
  return sampleAt(GEOM.inner, INNER_LAP);
}

function cornerLabels(template: NakayamaTemplate, view: { inner: ScreenPt[]; outer: ScreenPt[]; dirt: ScreenPt[] }): MapLabel[] {
  const g = GEOM;
  const labels: MapLabel[] = [];
  const put = (samples: ScreenPt[], meter: number, text: string) => {
    const p = screenAt(samples, meter);
    labels.push({ x: p.x + p.ox * 26, y: p.y + p.oy * 26, text });
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
  else put(view.outer, g.outerCorner3M, "3角");
  put(view.inner, c4, "4角");
  return labels;
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

export function presentNakayama(id: string): NakayamaMap {
  const template = nakayamaTemplate(id);
  const view = screens();
  const used = usedMeterPaths(template).map((pts) => pathD(screenSamples(pts, FIT.shift)));
  const finishRail = template.track === "ダート" ? view.dirt : template.rail === "outer" ? view.outer : view.inner;
  const finishLap = template.track === "ダート" ? DIRT_LAP : template.rail === "outer" ? OUTER_LAP : INNER_LAP;
  const hillPts = template.track === "ダート" ? GEOM.dirt : template.rail === "outer" ? GEOM.outer : GEOM.inner;
  const hillD = pathD(screenSamples(slice(hillPts, finishLap - 180, finishLap - 70), FIT.shift));

  const startS = screenSamples([startSample(template)], FIT.shift)[0];
  const finishS = screenSamples([finishSample(template)], FIT.shift)[0];
  const labels = [
    ...cornerLabels(template, view),
    { x: startS.x + startS.ox * 34, y: startS.y + startS.oy * 34, text: "発走" },
    { x: finishS.x + finishS.ox * 34, y: finishS.y + finishS.oy * 34, text: "ゴール" },
  ];
  if (template.id === "turf-1200" || template.id === "dirt-1200") {
    const rail = template.id === "turf-1200" ? view.outer : view.dirt;
    const at = template.id === "turf-1200" ? station(OUTER_LAP, 1200) + 140 : GEOM.dirtJoin1200 + 40;
    const p = screenAt(rail, Math.min(at, (template.id === "turf-1200" ? OUTER_LAP : DIRT_LAP) - 20));
    labels.push({ x: p.x + p.ox * 28, y: p.y + p.oy * 28, text: "下り" });
  }
  labels.push({
    x: screenAt(finishRail, finishLap - 125).x + screenAt(finishRail, finishLap - 125).ox * 28,
    y: screenAt(finishRail, finishLap - 125).y + screenAt(finishRail, finishLap - 125).oy * 28,
    text: "急坂",
  });

  return {
    viewBox: view.viewBox,
    innerD: pathD(view.inner),
    outerD: pathD(sliceScreen(view.outer, GEOM.outerSplitM, GEOM.outerJoinM)),
    dirtD: pathD(view.dirt),
    used,
    hillD,
    labels,
    start: bar(startS, 16),
    finish: bar(finishS, 18),
    title: `${template.track}${template.meters} ${template.course}`,
  };
}

function sliceScreen(samples: ScreenPt[], m0: number, m1: number) {
  const out: ScreenPt[] = [];
  for (const p of samples) {
    if (p.m >= m0 - 0.5 && p.m <= m1 + 0.5) out.push(p);
  }
  return out;
}

export function nakayamaRunPhrase(template: NakayamaTemplate) {
  if (template.rail === "outer-inner") return "外回りから内回り";
  return lapPhrase(template.meters, template.lap);
}

export type CoursePoint = { m: number; x: number; y: number; ix: number; iy: number };

/**
 * 芝1200の走行見本用。発走を0m、ゴールを1200m。
 * 座標はテンプレートと同じ（北が+y、内向き法線）。3角は外回りが戻る地点。
 */
function projectPoint(p: Sample, m: number): CoursePoint {
  return { m, x: p.x, y: p.y, ix: p.ix, iy: p.iy };
}

export function nakayamaTurf1200Run(): {
  run: CoursePoint[];
  idle: CoursePoint[];
  corner3: number;
  corner4: number;
} {
  const g = GEOM;
  const startM = station(OUTER_LAP, 1200);
  const run = slice(g.outer, startM, OUTER_LAP).map((p) => projectPoint(p, p.m - startM));
  const idle = slice(g.outer, 0, startM).map((p) => projectPoint(p, p.m));
  const corner3 = g.outerCorner3M - startM;
  const corner4 = nearestM(g.outer, sampleAt(g.inner, g.innerCornerM.c4)) - startM;
  return { run, idle, corner3, corner4 };
}

/** ポケットのゲート。本線ではなく、発走の後ろを同じだけ外へずらす */
function pocketApproach(samples: Sample[], joinM: number, length: number, side: number, back = 160): CoursePoint[] {
  const lap = samples[samples.length - 1].m;
  const n = Math.max(8, Math.round(back / 8));
  const pts: CoursePoint[] = [];
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
 * 芝1600。1角横のポケットを120m進んで、2角の途中で外回りに入る。
 * 発走の横の本線は、ゴールから外回りに沿って約240m。ポケットを出てからコーナーまで240m、ではない。
 * 3角とゴール前の急坂は、1200と同じ外回りの地点。
 */
export function nakayamaTurf1600Run(): {
  run: CoursePoint[];
  idle: CoursePoint[];
  /** ポケットが本線に入る地点 */
  pocketJoin: number;
  /** ゲート。発走の後ろで、本線には載せない */
  approach: CoursePoint[];
  /** ゴールから外回りに沿った発走。約240m */
  railStart: number;
  corner3: number;
  corner4: number;
  /** 4角の出口。ここからゴールまで直線310m */
  straightFrom: number;
  hillFrom: number;
  hillTo: number;
} {
  const g = GEOM;
  const railStart = OUTER_LAP - 1600;
  const pocket = chute(g.outer, g.chute1600Join, g.chute1600Len, 34);
  const last = pocket.length - 1;
  const run: CoursePoint[] = pocket.map((p, i) => projectPoint(p, g.chute1600Len * (i / last)));
  const rail = slice(g.outer, g.chute1600Join, OUTER_LAP);
  for (let i = 1; i < rail.length; i += 1) {
    const p = rail[i];
    run.push(projectPoint(p, g.chute1600Len + (p.m - g.chute1600Join)));
  }
  const idle = slice(g.outer, 0, g.chute1600Join).map((p) => projectPoint(p, p.m));
  const approach = pocketApproach(g.outer, g.chute1600Join, g.chute1600Len, 34);
  return {
    run,
    idle,
    approach,
    pocketJoin: g.chute1600Len,
    railStart,
    corner3: g.outerCorner3M - railStart,
    corner4: nearestM(g.outer, sampleAt(g.inner, g.innerCornerM.c4)) - railStart,
    straightFrom: 1600 - TURF_STRAIGHT,
    hillFrom: 1600 - 180,
    hillTo: 1600 - 70,
  };
}

/**
 * 芝1800。内回りのスタンド前から発走し、同じ急坂を発走直後とゴール前に踏む。
 * 1角までは図の205m。直線は310m。
 */
export function nakayamaTurf1800Run(): {
  run: CoursePoint[];
  idle: CoursePoint[];
  /** 1角の入口 */
  corner1: number;
  corner3: number;
  corner4: number;
  /** 発走が坂の途中なので、ここまでが序盤の急坂 */
  openingHillTo: number;
  straightFrom: number;
  hillFrom: number;
  hillTo: number;
} {
  const g = GEOM;
  const startM = station(INNER_LAP, 1800);
  const raced = INNER_LAP - startM;
  const head = slice(g.inner, startM, INNER_LAP).map((p) => projectPoint(p, p.m - startM));
  const body = slice(g.inner, 0, INNER_LAP).map((p) => projectPoint(p, raced + p.m));
  const run = head.concat(body.filter((p) => p.m > head[head.length - 1].m + 0.05));
  const idle = slice(g.inner, 0, startM).map((p) => projectPoint(p, p.m));
  return {
    run,
    idle,
    corner1: raced + FINISH_TO_CORNER,
    corner3: raced + g.innerCornerM.c3,
    corner4: raced + g.innerCornerM.c4,
    openingHillTo: INNER_LAP - 70 - startM,
    straightFrom: raced + (INNER_LAP - TURF_STRAIGHT),
    hillFrom: 1800 - 180,
    hillTo: 1800 - 70,
  };
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
  const s1800 = station(INNER_LAP, 1800);
  assertNear(INNER_LAP - s1800 + FINISH_TO_CORNER, 205, "芝1800の1角");
  const s2000 = station(INNER_LAP, 2000);
  assertNear(INNER_LAP - s2000 + FINISH_TO_CORNER, 405, "芝2000の1角");
  assertNear(s1800 - s2000, 200, "2000は1800の200m後ろ");
  const s2200 = station(OUTER_LAP, 2200);
  assertNear(OUTER_LAP - s2200 + FINISH_TO_CORNER, 432, "芝2200の1角");
  const s2500 = OUTER_LAP + INNER_LAP - 2500;
  assertNear(g.outerCorner3M - s2500, 71, "芝2500の3角");
  assertNear(g.outerCorner3M - station(OUTER_LAP, 1200), 438, "芝1200の3角");
  const bend = sampleAt(g.outer, g.outerCorner3M);
  if (bend.x < 0 || bend.y < 200) throw new Error("芝1200の3角がコーナーにない");
  const turf1200 = nakayamaTurf1200Run();
  assertNear(turf1200.corner3, 438, "芝1200走行の3角");
  assertNear(turf1200.run[turf1200.run.length - 1].m, 1200, "芝1200走行のゴール");
  if (turf1200.corner4 < turf1200.corner3 + 80 || turf1200.corner4 > 980) {
    throw new Error(`芝1200走行の4角: ${turf1200.corner4.toFixed(1)}`);
  }
  assertNear(g.chute1600Len + (OUTER_LAP - g.chute1600Join), 1600, "芝1600");
  assertNear(g.chute1200Len + (DIRT_LAP - g.dirtJoin1200), 1200, "ダート1200");

  const turf1600 = nakayamaTurf1600Run();
  assertNear(turf1600.run[turf1600.run.length - 1].m, 1600, "芝1600走行のゴール");
  assertNear(turf1600.pocketJoin, 120, "芝1600のポケット");
  assertNear(turf1600.railStart, 240, "芝1600の発走");
  assertNear(turf1600.corner3, 838, "芝1600走行の3角");
  assertNear(turf1600.hillFrom, 1420, "芝1600の坂");
  assertNear(turf1600.hillTo, 1530, "芝1600の坂の終わり");
  assertNear(1600 - turf1600.straightFrom, 310, "芝1600の直線");
  if (!(turf1600.corner3 < turf1600.corner4 && turf1600.corner4 < turf1600.straightFrom)) {
    throw new Error(`芝1600の並び: 3角${turf1600.corner3.toFixed(1)} 4角${turf1600.corner4.toFixed(1)}`);
  }
  const pocketEnd = turf1600.run.find((p) => Math.abs(p.m - turf1600.pocketJoin) < 0.05);
  const railJoin = sampleAt(g.outer, g.chute1600Join);
  if (!pocketEnd || hypot(pocketEnd.x - railJoin.x, pocketEnd.y - railJoin.y) > 1) {
    throw new Error("芝1600のポケットが本線に届いていない");
  }
  const beside = sampleAt(g.outer, turf1600.railStart);
  const pocketStart = turf1600.run[0];
  const pocketOff = hypot(pocketStart.x - beside.x, pocketStart.y - beside.y);
  if (Math.abs(pocketOff - 34) > 1) throw new Error(`芝1600のポケットの外れ: ${pocketOff.toFixed(1)}`);
  const gate = turf1600.approach[turf1600.approach.length - 1];
  if (!gate || hypot(gate.x - pocketStart.x, gate.y - pocketStart.y) > 1) {
    throw new Error("芝1600のゲートがポケットの後ろにない");
  }
  const bend1600 = runPoint(turf1600.run, turf1600.corner3);
  const mark1600 = sampleAt(g.outer, g.outerCorner3M);
  if (hypot(bend1600.x - mark1600.x, bend1600.y - mark1600.y) > 8) {
    throw new Error("芝1600走行の3角が図の3角と違う");
  }

  const turf1800 = nakayamaTurf1800Run();
  const start1800 = station(INNER_LAP, 1800);
  assertNear(turf1800.run[turf1800.run.length - 1].m, 1800, "芝1800走行のゴール");
  assertNear(turf1800.corner1, 205, "芝1800走行の1角");
  assertNear(turf1800.openingHillTo, 63, "芝1800の序盤の坂");
  assertNear(turf1800.hillFrom, 1620, "芝1800の坂");
  assertNear(turf1800.hillTo, 1730, "芝1800の坂の終わり");
  assertNear(1800 - turf1800.straightFrom, 310, "芝1800の直線");
  if (!(start1800 > INNER_LAP - 180 && start1800 < INNER_LAP - 70)) {
    throw new Error("芝1800の発走が急坂にない");
  }
  if (!(turf1800.openingHillTo < turf1800.corner1 && turf1800.corner1 < turf1800.corner3)) {
    throw new Error("芝1800は坂のあと1角、そのあと3角");
  }
  const c1 = sampleAt(g.inner, FINISH_TO_CORNER);
  const atCorner = runPoint(turf1800.run, turf1800.corner1);
  if (hypot(atCorner.x - c1.x, atCorner.y - c1.y) > 8) throw new Error("芝1800走行の1角が入口にない");
  const hillEnd = sampleAt(g.inner, INNER_LAP - 70);
  const atHill = runPoint(turf1800.run, turf1800.openingHillTo);
  if (hypot(atHill.x - hillEnd.x, atHill.y - hillEnd.y) > 8) throw new Error("芝1800の序盤の坂が図の急坂と違う");
  const exit = sampleAt(g.inner, INNER_LAP - TURF_STRAIGHT);
  const atExit = runPoint(turf1800.run, turf1800.straightFrom);
  if (hypot(atExit.x - exit.x, atExit.y - exit.y) > 8) throw new Error("芝1800の直線入口が4角の出口にない");
}

function runPoint(run: CoursePoint[], meter: number): CoursePoint {
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

checkTemplates();

/** ワンターン以外の中山。図のレールを発走0mにつなぐ */
export function nakayamaFlatGeom(templateId: string) {
  const template = NAKAYAMA_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return null;
  const g = GEOM;
  const hills: Array<[number, number]> = [[180, 70]];
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
      straight: TURF_STRAIGHT,
      hillsBeforeFinish: hills,
    });
  }
  if (template.id === "dirt-1200") {
    const chutePts = withSpan(chute(g.dirt, g.dirtJoin1200, g.chute1200Len, 28), g.chute1200Len);
    const after = asRaw(slice(g.dirt, g.dirtJoin1200, DIRT_LAP));
    return assembleFlat({
      meters: template.meters,
      head: [chutePts, after],
      loop: g.chute1200Len + spanOf(after) + 8 < template.meters ? asRaw(g.dirt) : null,
      resume: 0,
      lap: DIRT_LAP,
      finishJoinRace: g.chute1200Len,
      finishJoinRail: g.dirtJoin1200,
      c1: g.dirtCornerM.c1,
      c3: g.dirtCornerM.c3,
      c4: g.dirtCornerM.c4,
      straight: DIRT_STRAIGHT,
      hillsBeforeFinish: hills,
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
      ? { c1: g.outerSplitM, c3: g.outerCorner3M, c4: nearestM(g.outer, sampleAt(g.inner, g.innerCornerM.c4)) }
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
    straight: dirt ? DIRT_STRAIGHT : TURF_STRAIGHT,
    hillsBeforeFinish: hills,
  });
}
