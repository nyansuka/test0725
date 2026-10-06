import type { HorseScript, SimHorse, SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 馬ごとの3角・4角。台本の直線で詰める幅は、4角以降の差として残す。
 * 位置率が無い馬は台本の並びのまま。着順・上がり・オッズは見ない。
 */

/** 位置率1を、先頭からこのメートル後ろにする */
const SPAN_M = 80;
/** 逃げの前半がこれより速いと、序盤だけ詰める */
const FAST_FRONT_SEC = 34;
/** これより遅いと、序盤だけ開く */
const SLOW_FRONT_SEC = 36.5;
const FAST_EARLY = 0.75;
const SLOW_EARLY = 1.2;
/** 道悪で前が残る距離。直線の差を少し狭める */
const STRAIGHT_KEEP = 0.8;

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

/**
 * 3角・4角をその馬の位置率へ置く。4角より後は、台本との差を足して直線の幅を保つ。
 * 逃げの前半ラップは、3角より前の差だけを変える。
 * squeezeStraight の馬がいるときだけ、4角より後の差を 0.8 倍にする。
 */
export function shapeFieldScript(
  phases: SimPhase[],
  script: Record<number, HorseScript>,
  horses: SimHorse[],
) {
  const next = cloneScript(script);
  const c3 = phaseIndex(phases, "c3");
  const c4 = phaseIndex(phases, "c4");
  const shaped = horses.some(
    (horse) => horse.corner3Rate != null || horse.corner4Rate != null || horse.paceFrontSec != null || horse.squeezeStraight,
  );
  if (!shaped || c4 < 0) return next;

  if (c3 >= 0) {
    for (const horse of horses) {
      const row = next[horse.number];
      if (!row) continue;
      if (horse.corner4Rate != null) {
        const placed = metersFromRate(horse.corner4Rate);
        const delta = placed - row.behind[c4];
        row.behind[c4] = placed;
        for (let i = c4 + 1; i < row.behind.length; i += 1) {
          row.behind[i] = Math.max(0, row.behind[i] + delta);
        }
      }
      if (horse.corner3Rate != null) row.behind[c3] = metersFromRate(horse.corner3Rate);
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
