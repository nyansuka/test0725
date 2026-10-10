import type { StretchKind } from "@/domain/sim/fieldShape";
import { byStyle, type SimHorse, type SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 未接続だった平地の共有台本。位置は脚質で置く。
 * 差し・追込が直線で詰める幅は、呼び出し側の StretchKind だけが決める。
 * 14本の既存台本はここでは動かさない。
 * 逃げは先頭のまま。着順・オッズ・上がりは使わない。
 */

const MAX_LANE = 4;

const TONE: Record<StretchKind, string> = {
  short: "直線は短い。差しは少し詰める。後方から一気には届かない。",
  finishHill: "ゴール前の坂で前が残る。差しが詰める幅は小さい。",
  middle: "直線で差しは詰める。後方から一気には届かない。",
  long: "直線は長い。差しは詰める。先行は少し下がる。後方から一気には届かない。",
};

export type FlatCapMarks = {
  corner1: number;
  corner3: number;
  corner4: number;
  straightFrom: number;
  meters: number;
  stretch: StretchKind;
  place: string;
  /** 新潟芝1000。角は無く、4角の id は平坦に入った地点 */
  straightOnly?: boolean;
};

function horseLabel(horse: SimHorse) {
  return `${horse.number}番${horse.name}`;
}

function increasing(meters: number, corner3: number, corner4: number, straightFrom: number, corner1: number) {
  const c3 = Math.min(Math.max(corner3, 80), meters - 120);
  const c4 = Math.min(Math.max(corner4, c3 + 24), meters - 40);
  let straight = Math.min(Math.max(straightFrom, c4), meters - 12);
  if (straight <= c4) straight = Math.min(meters - 12, c4 + 16);
  const early = corner1 > 24 && corner1 < c3 - 12 ? corner1 : Math.min(140, c3 * 0.45);
  return { early, c3, c4, straight };
}

export function buildFlatCapPhases(horses: SimHorse[], marks: FlatCapMarks): SimPhase[] {
  const spot = increasing(marks.meters, marks.corner3, marks.corner4, marks.straightFrom, marks.corner1);
  const leaders = byStyle(horses, "逃");
  const pace = leaders[0];
  const leaderLine = pace ? `${horseLabel(pace)}がハナ。` : "逃げはいない想定です。";
  const tone = TONE[marks.stretch];

  return [
    {
      id: "start",
      label: "発走",
      m: 0,
      title: marks.place,
      body: "馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。",
    },
    {
      id: "back",
      label: "序盤",
      m: spot.early,
      title: "逃げが前",
      body: leaderLine,
    },
    {
      id: "c3",
      label: marks.straightOnly ? "上り" : "3角",
      m: spot.c3,
      title: marks.straightOnly ? "最初の上り" : "並びは付いている",
      body: marks.straightOnly ? "最初の200mが上り。まだ並びは大きく動かない。" : `${leaderLine}先行は好位。差しと追込はまだ後ろ。`,
    },
    {
      id: "c4",
      label: marks.straightOnly ? "平坦" : "4角",
      m: spot.c4,
      title: marks.straightOnly ? "平坦に入る" : "最後の通過",
      body: `${leaderLine}ここから先の差し・追込は、コースの上限までしか詰めない。`,
    },
    {
      id: "straight",
      label: "直線",
      m: spot.straight,
      title: "直線",
      body: tone,
    },
    {
      id: "goal",
      label: "ゴール",
      m: marks.meters,
      title: "詰めは上限まで",
      body: `${tone}脚質は発走前の直近5走、枠は馬番。着順の予想ではない。`,
    },
  ];
}

export function buildFlatCapScript(horses: SimHorse[]) {
  const script: Record<number, { behind: number[]; lane: number[] }> = {};
  const put = (horse: SimHorse, behind: number[], lane: number[]) => {
    script[horse.number] = { behind, lane };
  };

  byStyle(horses, "逃").forEach((horse, index) => {
    if (index === 0) {
      put(horse, [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]);
      return;
    }
    const wide = Math.min(MAX_LANE, 1 + index);
    put(horse, [0, 2 + index, 3 + index, 4 + index, 4 + index, 4 + index], [wide, wide, wide, wide, wide, wide]);
  });

  byStyle(horses, "先").forEach((horse, index) => {
    const lane = index === 0 ? 0 : index === 1 ? 1 : 2;
    put(
      horse,
      [0, 8 + index * 2, 6 + index * 2, 5 + index * 2, 5 + index * 2, 5 + index * 2],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "差").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 1 + (index % 3));
    put(
      horse,
      [0, 18 + index * 3, 20 + index * 3, 22 + index * 3, 22 + index * 3, 22 + index * 3],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "追").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 2 + (index % 3));
    put(
      horse,
      [0, 36 + index * 4, 40 + index * 4, 44 + index * 4, 44 + index * 4, 44 + index * 4],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  return script;
}
