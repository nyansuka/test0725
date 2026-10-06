import { shapeFieldScript } from "@/domain/sim/fieldShape";
import { pointAt, RACE_METERS } from "@/domain/sim/nakayamaTurf1200Path";
import { buildPhases, buildScript, byStyle, type SimHorse, type SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 中山芝1200の再生。台本の先頭差とレーンを、点列の上に載せる。
 * 円が重なるのはそのままで、番号が隠れてもよい。
 */

/** 円の半径 */
export const MARKER_R = 9;
/** 芝の帯の太さ。枠なりを4頭×4段で帯の中に収める */
export const TRACK_STROKE = 92;
const LENGTH_M = 2.5;
const LANE_STEP = 12;
const MAX_LANE = 4;

/** JRAの枠色 */
export const BRACKET_COLOR: Record<number, { fill: string; text: string }> = {
  1: { fill: "#f4f4f5", text: "#141210" },
  2: { fill: "#1c1c1c", text: "#ffffff" },
  3: { fill: "#d21f2a", text: "#ffffff" },
  4: { fill: "#1d4ed8", text: "#ffffff" },
  5: { fill: "#eab308", text: "#141210" },
  6: { fill: "#15803d", text: "#ffffff" },
  7: { fill: "#ea580c", text: "#ffffff" },
  8: { fill: "#f9a8d4", text: "#141210" },
};

export type Placement = {
  horse: SimHorse;
  /** コース上の表示位置（m）。接触するときは後方へずらしてある */
  along: number;
  lane: number;
  /** 先頭からの論理メートル */
  behindM: number;
  rank: number;
  x: number;
  y: number;
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** サーバとブラウザの浮動小数の差で水和が割れないよう、画素は小数1桁に揃える */
function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function sampleScript(
  script: Record<number, { behind: number[]; lane: number[] }>,
  keyM: number[],
  number: number,
  raceM: number,
) {
  const row = script[number] ?? { behind: [0, 0, 0, 0, 0, 0], lane: [2, 2, 2, 2, 2, 2] };
  const m = Math.min(RACE_METERS, Math.max(0, raceM));
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

/** 走行中のレーンを芝の帯の中へ。0 がレール側 */
function laneInward(lane: number) {
  const clamped = Math.max(0, Math.min(MAX_LANE, lane));
  return (MAX_LANE / 2 - clamped) * LANE_STEP;
}

/**
 * 発走は1列に12頭だと帯から出るので、内から外へ4列×3段。
 * 先頭列がスタートライン、後ろの2段はゲート側（負の距離）。
 */
function gateSlot(number: number) {
  const index = number - 1;
  const row = Math.floor(index / 4);
  const col = index % 4;
  // 向正面は約1.09px/m。21mで円の直径より広い。16頭は4段。
  return { along: -row * 21, inward: 33 - col * 22 };
}

function placed(along: number, inward: number) {
  const p = pointAt(along);
  return {
    x: round1(p.x + p.ix * inward),
    y: round1(p.y + p.iy * inward),
  };
}

export function createTurf1200(horses: SimHorse[]) {
  const phases = buildPhases(horses);
  const keyM = phases.map((phase) => phase.m);
  const script = shapeFieldScript(phases, buildScript(horses), horses);
  const focus = byStyle(horses, "逃")[0] ?? horses[0];

  function fieldAt(raceM: number): Placement[] {
    const leader = Math.min(RACE_METERS, Math.max(0, raceM));
    const release = Math.min(1, leader / 140);
    const t = release * release * (3 - 2 * release);
    const rows = horses.map((horse) => {
      const s = sampleScript(script, keyM, horse.number, leader);
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
        inward,
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
    let current = phases[0];
    for (const phase of phases) {
      if (raceM >= phase.m) current = phase;
    }
    return current;
  }

  return { phases, fieldAt, phaseAt, focusNumber: focus?.number ?? 1 };
}

export function lengthsLabel(behindM: number) {
  if (behindM < 0.6) return "先頭";
  const lengths = behindM / LENGTH_M;
  return `${lengths.toFixed(1)}馬身`;
}

/** レーン0をレール側に、外へ行くほどプラス */
export function horseXY(along: number, lane: number) {
  return placed(along, laneInward(lane));
}
