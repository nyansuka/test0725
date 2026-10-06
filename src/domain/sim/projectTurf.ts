/**
 * ワンターンの点列を画面へ投影する。中山芝1200の点列はここを通さない。
 */

export type TurfPoint = { m: number; x: number; y: number; ix: number; iy: number };

const PX_PER_M = 1.1;
const PAD = 110;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function projectTurf(idleIn: TurfPoint[], runIn: TurfPoint[], approachIn: TurfPoint[] = []) {
  const raw = approachIn.length ? [...idleIn, ...runIn, ...approachIn] : [...idleIn, ...runIn];
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
  const map = (p: TurfPoint) => {
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
  const idle = idleIn.map(map);
  const run = runIn.map(map);
  const approach = (approachIn.length ? approachIn : idleIn).map(map);
  let west = idle[0] ?? run[0];
  for (const p of idle) if (p.x < west.x) west = p;
  const cx = (minX + maxX) / 2 + shiftX;
  const cy = (minY + maxY) / 2 + shiftY;

  function pathFrom(samples: typeof run) {
    return samples.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  }

  function sampleList(samples: typeof run, meter: number) {
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

  function pointAt(meter: number) {
    if (meter < 0) {
      const line = approach.length ? approach : run;
      const startM = line[line.length - 1]?.m ?? 0;
      return sampleList(line, startM + meter);
    }
    const end = run[run.length - 1]?.m ?? 0;
    return sampleList(run, Math.min(end, Math.max(0, meter)));
  }

  return {
    viewBox: `0 0 ${(maxX - minX + PAD * 2).toFixed(1)} ${(maxY - minY + PAD * 2).toFixed(1)}`,
    title: { x: cx, y: cy },
    note: { x: west.x + (cx - west.x) * 0.42, y: west.y + (cy - west.y) * 0.35 },
    coursePathD: pathFrom(run),
    unusedPathD: pathFrom(idle),
    hillPathD(from: number, to: number) {
      return pathFrom(run.filter((p) => p.m >= from && p.m <= to));
    },
    gatePathD() {
      const pts = [];
      for (let m = -90; m <= 0; m += 6) pts.push(pointAt(m));
      return pathFrom(pts);
    },
    pointAt,
    markerAt(meter: number, outwardPx: number) {
      const p = pointAt(meter);
      return {
        x: round1(p.x - p.ix * outwardPx),
        y: round1(p.y - p.iy * outwardPx),
      };
    },
  };
}
