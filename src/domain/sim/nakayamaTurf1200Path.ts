import { nakayamaTurf1200Run } from "@/domain/sim/nakayamaCourse";

/**
 * 中山芝1200の点列。発走を0m、ゴールを1200m。
 * 座標は距離テンプレートの外回り（北が+y）。画面へはここで投影する。
 */

export const RACE_METERS = 1200;
/** ゴール前の急坂。テンプレートと同じく残り180mから70m */
export const HILL_FROM = RACE_METERS - 180;
export const HILL_TO = RACE_METERS - 70;

const RUN = nakayamaTurf1200Run();
/** 3角。発走から約438m */
export const TURF1200_CORNER3 = RUN.corner3;
/** 4角 */
export const TURF1200_CORNER4 = RUN.corner4;

type Sample = { m: number; x: number; y: number; ix: number; iy: number };

/** 帯の中で枠なりが重ならない程度。21mで円の直径より広い */
const PX_PER_M = 1.1;
const PAD = 110;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** サーバとブラウザの浮動小数の差で水和が割れないよう、画素は小数1桁に揃える */
function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function projectCourse() {
  const raw = [...RUN.idle, ...RUN.run];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of raw) {
    const x = p.x * PX_PER_M;
    const y = -p.y * PX_PER_M;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const shiftX = PAD - minX;
  const shiftY = PAD - minY;
  const map = (p: (typeof raw)[number]): Sample => {
    const ix = p.ix;
    const iy = -p.iy;
    const v = Math.hypot(ix, iy) || 1;
    return {
      m: p.m,
      x: p.x * PX_PER_M + shiftX,
      y: -p.y * PX_PER_M + shiftY,
      ix: ix / v,
      iy: iy / v,
    };
  };
  const idle = RUN.idle.map(map);
  const run = RUN.run.map(map);
  let west = idle[0];
  for (const p of idle) if (p.x < west.x) west = p;
  const cx = (minX + maxX) / 2 + shiftX;
  const cy = (minY + maxY) / 2 + shiftY;
  return {
    idle,
    run,
    viewBox: `0 0 ${(maxX - minX + PAD * 2).toFixed(1)} ${(maxY - minY + PAD * 2).toFixed(1)}`,
    title: { x: cx, y: cy },
    note: { x: west.x + (cx - west.x) * 0.42, y: west.y + (cy - west.y) * 0.35 },
  };
}

const COURSE = projectCourse();
const SAMPLES = COURSE.run;
const IDLE = COURSE.idle;

export const COURSE_VIEWBOX = COURSE.viewBox;
export const COURSE_TITLE = COURSE.title;
export const COURSE_NOTE = COURSE.note;

function pathFrom(samples: Sample[]): string {
  return samples.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

export function coursePathD(): string {
  return pathFrom(SAMPLES);
}

/** スタートラインの手前。枠なりを芝の上に置く */
export function gatePathD(): string {
  const pts: Sample[] = [];
  for (let m = -90; m <= 0; m += 6) pts.push(pointAt(m));
  return pathFrom(pts);
}

/** 直線の急坂（残り180mから70m） */
export function hillPathD(): string {
  return pathFrom(SAMPLES.filter((p) => p.m >= HILL_FROM && p.m <= HILL_TO));
}

/** 1角と2角。この1200では走らない */
export function unusedPathD(): string {
  return pathFrom(COURSE.idle);
}

function sampleList(samples: Sample[], meter: number): Sample {
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
    m: meter,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    ix: lerp(a.ix, b.ix, t),
    iy: lerp(a.iy, b.iy, t),
  };
}

export function pointAt(meter: number): Sample {
  if (meter < 0) {
    const startM = IDLE[IDLE.length - 1]?.m ?? 0;
    return sampleList(IDLE, startM + meter);
  }
  return sampleList(SAMPLES, Math.min(RACE_METERS, Math.max(0, meter)));
}

export function markerAt(meter: number, outwardPx: number) {
  const p = pointAt(meter);
  return {
    x: round1(p.x - p.ix * outwardPx),
    y: round1(p.y - p.iy * outwardPx),
  };
}
