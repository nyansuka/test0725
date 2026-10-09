import { settleFieldScript, shapeFieldScript, type StretchKind } from "@/domain/sim/fieldShape";
import type { SimHorse, SimPhase } from "@/domain/sim/nakayamaTurf1200Script";
import { byStyle } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 芝ワンターンの再生。中山芝1200の再生はここを通さない。
 * 円が重なるのはそのままで、番号が隠れてもよい。
 */

const LENGTH_M = 2.5;
const LANE_STEP = 12;
const MAX_LANE = 4;
/** この距離で枠なりを抜け、台本の位置になる */
export const RELEASE_M = 140;

type Sample = { x: number; y: number; ix: number; iy: number };

export type TurfPlacement = {
  horse: SimHorse;
  along: number;
  lane: number;
  behindM: number;
  rank: number;
  x: number;
  y: number;
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function sampleScript(
  script: Record<number, { behind: number[]; lane: number[] }>,
  keyM: number[],
  number: number,
  raceM: number,
  raceMeters: number,
) {
  const row = script[number] ?? { behind: [0, 0, 0, 0, 0, 0], lane: [2, 2, 2, 2, 2, 2] };
  const m = Math.min(raceMeters, Math.max(0, raceM));
  let i = 0;
  while (i < keyM.length - 2 && m > keyM[i + 1]) i += 1;
  const m0 = keyM[i];
  const m1 = keyM[i + 1];
  const t = m1 === m0 ? 0 : (m - m0) / (m1 - m0);
  return {
    behind: lerp(row.behind[i], row.behind[i + 1], t),
    lane: lerp(row.lane[i], row.lane[i + 1], t),
  };
}

function laneInward(lane: number) {
  const clamped = Math.max(0, Math.min(MAX_LANE, lane));
  return (MAX_LANE / 2 - clamped) * LANE_STEP;
}

function gateSlot(number: number) {
  const index = number - 1;
  const row = Math.floor(index / 4);
  const col = index % 4;
  return { along: -row * 21, inward: 33 - col * 22 };
}

export function createTurfCourse(
  horses: SimHorse[],
  course: {
    raceMeters: number;
    pointAt: (meter: number) => Sample;
    phases: SimPhase[];
    script: Record<number, { behind: number[]; lane: number[] }>;
    stretch: StretchKind;
  },
) {
  const keyM = course.phases.map((phase) => phase.m);
  const script = settleFieldScript(shapeFieldScript(course.phases, course.script, horses, course.stretch), horses);
  const focus = byStyle(horses, "逃")[0] ?? horses[0];

  function placed(along: number, inward: number) {
    const p = course.pointAt(along);
    return {
      x: round1(p.x + p.ix * inward),
      y: round1(p.y + p.iy * inward),
    };
  }

  function fieldAt(raceM: number): TurfPlacement[] {
    const leader = Math.min(course.raceMeters, Math.max(0, raceM));
    const release = Math.min(1, leader / RELEASE_M);
    const t = release * release * (3 - 2 * release);
    const rows = horses.map((horse) => {
      const s = sampleScript(script, keyM, horse.number, leader, course.raceMeters);
      const gate = gateSlot(horse.number);
      const runAlong = leader - s.behind;
      const runIn = laneInward(s.lane);
      const along = t >= 1 ? runAlong : lerp(gate.along, runAlong, t);
      const inward = t >= 1 ? runIn : lerp(gate.inward, runIn, t);
      const pos = placed(along, inward);
      return {
        horse,
        along,
        lane: s.lane,
        behindM: t >= 1 ? s.behind : 0,
        rank: 0,
        x: pos.x,
        y: pos.y,
      };
    });
    rows.sort((a, b) => a.behindM - b.behindM || a.horse.number - b.horse.number);
    rows.forEach((row, index) => {
      row.rank = index + 1;
    });
    return rows;
  }

  function phaseAt(raceM: number): SimPhase {
    let current = course.phases[0];
    for (const phase of course.phases) {
      if (raceM >= phase.m) current = phase;
    }
    return current;
  }

  return { phases: course.phases, fieldAt, phaseAt, focusNumber: focus?.number ?? 1 };
}
