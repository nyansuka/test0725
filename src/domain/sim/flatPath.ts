/**
 * 図の点列を、発走0m・ゴールが距離mの走行へつなぐ。
 * 詰め幅はここでは決めない。角の位置だけをレースのメートルにする。
 */

export type RawPt = { m: number; x: number; y: number; ix: number; iy: number };

export type FlatPath = {
  run: RawPt[];
  idle: RawPt[];
  approach: RawPt[];
  corner1: number;
  corner3: number;
  corner4: number;
  straightFrom: number;
  hills: Array<[number, number]>;
};

export type AssembleFlat = {
  meters: number;
  /** 発走からの順。各点の m はレール上 */
  head: RawPt[][];
  idle?: RawPt[];
  /** head のあと、このレールを resume から周回して距離を埋める */
  loop: RawPt[] | null;
  resume: number;
  lap: number;
  /** ゴール側のレールに乗ったレースメートルと、そのときのレールメートル */
  finishJoinRace: number;
  finishJoinRail: number;
  c1: number;
  c3: number;
  c4: number;
  straight: number;
  /** ゴールから手前へ。例: 急坂は [180, 70] */
  hillsBeforeFinish: Array<[number, number]>;
  fixed?: { corner1: number; corner3: number; corner4: number; straightFrom: number };
};

export function spanOf(points: RawPt[]) {
  if (points.length < 2) return 0;
  return points[points.length - 1].m - points[0].m;
}

export function asRaw(samples: Array<{ m: number; x: number; y: number; ix: number; iy: number }>): RawPt[] {
  return samples.map((point) => ({ m: point.m, x: point.x, y: point.y, ix: point.ix, iy: point.iy }));
}

/** ポケットの点は m が添字なので、長さをメートルにしてからつなぐ */
export function withSpan(samples: Array<{ x: number; y: number; ix: number; iy: number }>, length: number): RawPt[] {
  const last = Math.max(1, samples.length - 1);
  return samples.map((point, index) => ({
    m: (length * index) / last,
    x: point.x,
    y: point.y,
    ix: point.ix,
    iy: point.iy,
  }));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function sliceRaw(rail: RawPt[], m0: number, m1: number): RawPt[] {
  if (rail.length < 2 || m1 <= m0 + 0.2) return [];
  const lap = rail[rail.length - 1].m;
  const from = Math.max(0, Math.min(lap, m0));
  const to = Math.max(from, Math.min(lap, m1));
  const at = (meter: number): RawPt => {
    let lo = 0;
    let hi = rail.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (rail[mid].m < meter) lo = mid;
      else hi = mid;
    }
    const a = rail[lo];
    const b = rail[hi];
    const t = b.m === a.m ? 0 : (meter - a.m) / (b.m - a.m);
    return {
      m: meter,
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      ix: lerp(a.ix, b.ix, t),
      iy: lerp(a.iy, b.iy, t),
    };
  };
  const out: RawPt[] = [at(from)];
  for (const point of rail) {
    if (point.m > from + 0.2 && point.m < to - 0.2) out.push(point);
  }
  out.push(at(to));
  return out;
}

function pushPiece(out: RawPt[], piece: RawPt[], raced: { m: number }) {
  if (piece.length < 2) return;
  const origin = piece[0].m;
  const span = piece[piece.length - 1].m - origin;
  if (span <= 0.2) return;
  for (const point of piece) {
    const m = raced.m + (point.m - origin);
    const last = out[out.length - 1];
    if (last && m - last.m < 0.35) continue;
    out.push({ m, x: point.x, y: point.y, ix: point.ix, iy: point.iy });
  }
  raced.m += span;
}

function approachOf(run: RawPt[], back = 160): RawPt[] {
  if (run.length < 2) return [];
  const origin = run[0];
  const next = run[Math.min(6, run.length - 1)];
  const dx = next.x - origin.x;
  const dy = next.y - origin.y;
  const len = Math.hypot(dx, dy) || 1;
  const n = 16;
  const pts: RawPt[] = [];
  for (let i = 0; i <= n; i += 1) {
    const behind = back * (1 - i / n);
    pts.push({
      m: (i / n) * back,
      x: origin.x - (dx / len) * behind,
      y: origin.y - (dy / len) * behind,
      ix: origin.ix,
      iy: origin.iy,
    });
  }
  return pts;
}

function lastPass(railM: number, before: number, joinRace: number, joinRail: number, lap: number) {
  if (lap <= 1) return Math.max(0, Math.min(before, joinRace));
  let at = joinRace + (railM - joinRail);
  while (at < -0.5) at += lap;
  while (at > before + 0.5) at -= lap;
  while (at + lap <= before + 0.5) at += lap;
  return at;
}

export function assembleFlat(input: AssembleFlat): FlatPath {
  const raced = { m: 0 };
  const run: RawPt[] = [];
  for (const piece of input.head) pushPiece(run, piece, raced);
  if (input.loop && raced.m < input.meters - 1) {
    let cursor = input.resume;
    let guard = 0;
    while (raced.m < input.meters - 0.8 && guard < 8) {
      guard += 1;
      if (input.lap - cursor < 1) cursor = 0;
      const room = input.meters - raced.m;
      const end = Math.min(input.lap, cursor + room);
      const before = raced.m;
      pushPiece(run, sliceRaw(input.loop, cursor, end), raced);
      if (raced.m <= before + 0.2) break;
      cursor = end >= input.lap - 0.5 ? 0 : end;
    }
  }
  if (run.length) run[run.length - 1].m = input.meters;

  const fixed = input.fixed;
  const corner4 = fixed
    ? fixed.corner4
    : lastPass(input.c4, input.meters - 8, input.finishJoinRace, input.finishJoinRail, input.lap);
  const corner3 = fixed
    ? fixed.corner3
    : lastPass(input.c3, Math.max(1, corner4 - 8), input.finishJoinRace, input.finishJoinRail, input.lap);
  const corner1 = fixed
    ? fixed.corner1
    : lastPass(input.c1, Math.max(1, corner3 - 8), input.finishJoinRace, input.finishJoinRail, input.lap);
  const straightFrom = fixed
    ? fixed.straightFrom
    : Math.min(input.meters - 8, Math.max(corner4, input.meters - input.straight));
  const hills = input.hillsBeforeFinish
    .map(([from, to]) => [input.meters - from, input.meters - to] as [number, number])
    .filter(([from, to]) => to > from && from >= corner4 - 30 && to <= input.meters);

  return {
    run,
    idle: input.idle ?? [],
    approach: approachOf(run),
    corner1,
    corner3,
    corner4,
    straightFrom,
    hills,
  };
}
