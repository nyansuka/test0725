import type { HorseScript, SimHorse, SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 馬ごとの3角・4角。4角より後の差し・追込は、コースの上限まで詰める。
 * 上限の6割は誰でも詰め、残りは最後の通過から着順まで詰めたメートルで埋める。
 * 逃げには位置率を書かない。先頭は台本の位置のまま、外の逃げが下がる幅も台本のまま。
 * 先行が下がるのは直線が長いコースだけ。
 * オッズと上がりは見ない。
 */

/** 位置率1を、先頭からこのメートル後ろにする */
export const SPAN_M = 80;
/** 逃げの前半がこれより速いと、序盤だけ詰める */
const FAST_FRONT_SEC = 34;
/** これより遅いと、序盤だけ開く */
const SLOW_FRONT_SEC = 36.5;
const FAST_EARLY = 0.75;
const SLOW_EARLY = 1.2;
/** 道悪で前が残る距離。直線の差を少し狭める */
const STRAIGHT_KEEP = 0.8;
/** 差し・追込は、コース上限のここまでを必ず詰める */
const STRETCH_FLOOR = 0.6;

/** 直線で詰めてよい幅。stalkFade は先行が下がるメートル */
export type StretchKind = "short" | "finishHill" | "middle" | "long";

export const STRETCH_CAP: Record<StretchKind, { 差: number; 追: number; stalkFade: number }> = {
  short: { 差: 6, 追: 8, stalkFade: 0 },
  finishHill: { 差: 3, 追: 4, stalkFade: 0 },
  middle: { 差: 12, 追: 16, stalkFade: 0 },
  long: { 差: 22, 追: 32, stalkFade: 4 },
};

function cloneScript(script: Record<number, HorseScript>) {
  const next: Record<number, HorseScript> = {};
  for (const [number, row] of Object.entries(script)) {
    next[Number(number)] = { behind: [...row.behind], lane: [...row.lane] };
  }
  return next;
}

function metersFromRate(rate: number) {
  const clamped = Math.min(1, Math.max(0, rate));
  return Math.round(clamped * SPAN_M);
}

function phaseIndex(phases: SimPhase[], id: string) {
  return phases.findIndex((phase) => phase.id === id);
}

function stretchGain(cap: number, past: number | null | undefined) {
  const floor = cap * STRETCH_FLOOR;
  return Math.round(Math.min(cap, Math.max(floor, past ?? floor)));
}

/** 4角の位置からゴールまで、先頭差を距離に比例して動かす */
function moveAfterCorner(phases: SimPhase[], row: HorseScript, c4: number, goalBehind: number) {
  const at4 = row.behind[c4] ?? 0;
  const fromM = phases[c4].m;
  const last = Math.min(row.behind.length, phases.length) - 1;
  const span = phases[last].m - fromM;
  for (let i = c4 + 1; i <= last; i += 1) {
    const t = span <= 0 ? 1 : (phases[i].m - fromM) / span;
    row.behind[i] = Math.max(0, Math.round(at4 + (goalBehind - at4) * t));
  }
}

function applyStretch(phases: SimPhase[], script: Record<number, HorseScript>, horses: SimHorse[], c4: number, stretch: StretchKind) {
  const cap = STRETCH_CAP[stretch];
  for (const horse of horses) {
    const row = script[horse.number];
    if (!row) continue;
    if (horse.style === "差" || horse.style === "追") {
      const gain = stretchGain(cap[horse.style], horse.stretchGainM);
      const at4 = row.behind[c4] ?? 0;
      moveAfterCorner(phases, row, c4, Math.max(0, at4 - gain));
      continue;
    }
    if (horse.style === "先" && cap.stalkFade > 0) {
      const at4 = row.behind[c4] ?? 0;
      moveAfterCorner(phases, row, c4, at4 + cap.stalkFade);
    }
  }
}

/**
 * 3角・4角を、逃げ以外の馬の位置率へ置く。逃げの先頭は台本のまま動かさない。
 * stretch があるとき、4角より後の差し・追込はコース上限で詰め直す。
 * 逃げの前半ラップは、3角より前の差だけを変える。逃げの 0 は係数でも動かない。
 * squeezeStraight の馬がいるときだけ、4角より後の差を 0.8 倍にする。
 */
export function shapeFieldScript(
  phases: SimPhase[],
  script: Record<number, HorseScript>,
  horses: SimHorse[],
  stretch?: StretchKind,
) {
  const next = cloneScript(script);
  const c3 = phaseIndex(phases, "c3");
  const c4 = phaseIndex(phases, "c4");
  const shaped = horses.some(
    (horse) => horse.corner3Rate != null || horse.corner4Rate != null || horse.paceFrontSec != null || horse.squeezeStraight,
  );
  if (c4 < 0) return next;
  if (!shaped && !stretch) return next;

  if (shaped) {
    for (const horse of horses) {
      const row = next[horse.number];
      if (!row || horse.style === "逃" || horse.corner4Rate == null) continue;
      const placed = metersFromRate(horse.corner4Rate);
      const delta = placed - row.behind[c4];
      row.behind[c4] = placed;
      for (let i = c4 + 1; i < row.behind.length; i += 1) {
        row.behind[i] = Math.max(0, row.behind[i] + delta);
      }
    }
    if (c3 >= 0) {
      for (const horse of horses) {
        const row = next[horse.number];
        if (!row || horse.style === "逃" || horse.corner3Rate == null) continue;
        row.behind[c3] = metersFromRate(horse.corner3Rate);
      }
    }

    const fronts = horses.filter(
      (horse) => horse.style === "逃" && horse.paceFrontSec != null && horse.paceFrontSec > 0,
    );
    if (fronts.length && c3 > 0) {
      const avg = fronts.reduce((sum, horse) => sum + (horse.paceFrontSec as number), 0) / fronts.length;
      const factor = avg < FAST_FRONT_SEC ? FAST_EARLY : avg > SLOW_FRONT_SEC ? SLOW_EARLY : 1;
      if (factor !== 1) {
        for (const row of Object.values(next)) {
          for (let i = 0; i < c3 && i < row.behind.length; i += 1) {
            row.behind[i] = Math.round(row.behind[i] * factor);
          }
        }
      }
    }
  }

  if (stretch) applyStretch(phases, next, horses, c4, stretch);

  if (horses.some((horse) => horse.squeezeStraight)) {
    for (const row of Object.values(next)) {
      const at4 = row.behind[c4] ?? 0;
      for (let i = c4 + 1; i < row.behind.length; i += 1) {
        row.behind[i] = Math.round(at4 + (row.behind[i] - at4) * STRAIGHT_KEEP);
      }
    }
  }

  return next;
}

/** 通過が無い馬を、通過がある最後尾からこのメートル後ろに重ねる。馬身としては出さない */
const UNKNOWN_PACK_M = 16;

/**
 * 台本と位置率のあと。14本の台本には書かない。
 * 逃げが1頭もいないとき、各局面で通過がある馬の一番前を 0 にする。前後とレーンは変えない。
 * 通過が無い馬は最小値に入れず、通過がある馬の最後尾より後ろにまとめる。
 */
export function settleFieldScript(script: Record<number, HorseScript>, horses: SimHorse[]) {
  const known = horses.filter((horse) => !horse.passUnknown && script[horse.number]);
  const unknown = horses.filter((horse) => horse.passUnknown && script[horse.number]);
  let phases = 0;
  for (const row of Object.values(script)) phases = Math.max(phases, row.behind.length);

  if (!horses.some((horse) => horse.style === "逃") && known.length) {
    for (let i = 0; i < phases; i += 1) {
      let min = Infinity;
      for (const horse of known) {
        const value = script[horse.number].behind[i];
        if (value != null && value < min) min = value;
      }
      if (!(min > 0)) continue;
      for (const horse of known) {
        const row = script[horse.number];
        if (i < row.behind.length) row.behind[i] -= min;
      }
    }
  }

  if (unknown.length && known.length) {
    for (let i = 0; i < phases; i += 1) {
      let tail = -Infinity;
      for (const horse of known) {
        const value = script[horse.number].behind[i];
        if (value != null && value > tail) tail = value;
      }
      if (!Number.isFinite(tail)) continue;
      for (const horse of unknown) {
        const row = script[horse.number];
        if (i < row.behind.length) row.behind[i] = tail + UNKNOWN_PACK_M;
      }
    }
  }

  return script;
}
