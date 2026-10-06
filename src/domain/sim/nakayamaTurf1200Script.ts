import { HILL_FROM, TURF1200_CORNER3, TURF1200_CORNER4 } from "@/domain/sim/nakayamaTurf1200Path";

/**
 * 中山芝1200の台本。2026-09-26 中山10R 勝浦特別（16頭）が見本。
 * 脚質は発走前の直近5走（芝・通過あり・当日より前）だけ。
 * 逃げ: 2番手以内が6割以上かつ先頭が2回以上。
 * 先行: 平均位置率0.28以下、または2番手以内が6割以上。
 * 追込: 平均位置率0.58以上。それ以外は差し。
 * 位置は脚質と枠の型。着順・当日オッズ・馬場の重は使わない。
 * 最内の逃げが残り、外の逃げは4角で落ちる。先行は内ほど前。差し・追込は坂でも届かない。
 */

export type RunningStyle = "逃" | "先" | "差" | "追";

export type SimHorse = {
  number: number;
  bracket: number;
  name: string;
  style: RunningStyle;
  /** 小さいほど前。無い馬は枠番のあと馬番 */
  posRate?: number | null;
  corner3Rate?: number | null;
  corner4Rate?: number | null;
  /** 逃げの前半ラップ。序盤の詰まりだけに使う */
  paceFrontSec?: number | null;
  /** 道悪で前が残る距離だけ true */
  squeezeStraight?: boolean;
};

export const HORSES: SimHorse[] = [
  { number: 1, bracket: 1, name: "デンプシー", style: "先" },
  { number: 2, bracket: 1, name: "イゾラフェリーチェ", style: "先" },
  { number: 3, bracket: 2, name: "ウィングブルー", style: "逃" },
  { number: 4, bracket: 2, name: "ジョヴィアン", style: "追" },
  { number: 5, bracket: 3, name: "ヴィヴァクラウン", style: "追" },
  { number: 6, bracket: 3, name: "トラスコンガーデン", style: "追" },
  { number: 7, bracket: 4, name: "ドリーミングアップ", style: "追" },
  { number: 8, bracket: 4, name: "レオアジャイル", style: "逃" },
  { number: 9, bracket: 5, name: "ビッグフラワー", style: "差" },
  { number: 10, bracket: 5, name: "セレッソデアモール", style: "差" },
  { number: 11, bracket: 6, name: "ビービーエフォート", style: "差" },
  { number: 12, bracket: 6, name: "アイムインディ", style: "差" },
  { number: 13, bracket: 7, name: "レザンノワール", style: "差" },
  { number: 14, bracket: 7, name: "スミッコディスコ", style: "先" },
  { number: 15, bracket: 8, name: "メローネ", style: "差" },
  { number: 16, bracket: 8, name: "ピコアーガイル", style: "逃" },
];

const MAX_LANE = 4;

export type SimPhase = {
  id: string;
  label: string;
  m: number;
  title: string;
  body: string;
};

export type HorseScript = { behind: number[]; lane: number[] };

export function byStyle(horses: SimHorse[], style: RunningStyle) {
  return horses
    .filter((horse) => horse.style === style)
    .sort((a, b) => {
      if (a.posRate != null && b.posRate != null && a.posRate !== b.posRate) return a.posRate - b.posRate;
      return a.bracket - b.bracket || a.number - b.number;
    });
}

/** 位置率がある馬は、枠が内とは限らない */
export function leadName(horse: SimHorse) {
  const label = `${horse.number}番${horse.name}`;
  return horse.posRate == null ? `内の${label}` : label;
}

function horseLabel(horse: SimHorse) {
  return `${horse.number}番${horse.name}`;
}

export function buildPhases(horses: SimHorse[]): SimPhase[] {
  const leaders = byStyle(horses, "逃");
  const pace = leaders[0];
  const outer = leaders.slice(1);
  const innerStalkers = byStyle(horses, "先").filter((horse) => horse.bracket <= 2);
  const leaderLine = !pace
    ? "逃げはいない想定です。"
    : outer.length === 0
      ? `逃げは${horseLabel(pace)}。ハナを切り、前が速くなりやすい。`
      : `逃げは${leaders.map(horseLabel).join("、")}。${leadName(pace)}がハナ、外の${outer.map(horseLabel).join("と")}が競るので前が速くなる。`;
  const innerLine = innerStalkers.length
    ? `内の先行${innerStalkers.map(horseLabel).join("と")}はレールの好位。`
    : "先行は枠の内から前に残りやすい。";
  const cornerLine = !pace
    ? "逃げがいない想定。先行が好位で直線へ向く。"
    : outer.length === 0
      ? `${pace.name}は先頭のまま。内の先行が好位で直線へ向く。`
      : `競った${outer.map(horseLabel).join("と")}が外を回して落ちる。${pace.name}は先頭のまま。内の先行が好位で直線へ向く。`;

  return [
    {
      id: "start",
      label: "発走",
      m: 0,
      title: "枠なり",
      body: "2角奥のゲート。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。",
    },
    {
      id: "down",
      label: "下り",
      m: 140,
      title: "序盤が速い",
      body: `向正面は下り。${leaderLine}`,
    },
    {
      id: "c3",
      label: "3角",
      m: TURF1200_CORNER3,
      title: "位置が決まる",
      body: `最初のコーナーまで約440m。ここまでで並びはほぼ決まる。${innerLine}`,
    },
    {
      id: "c4",
      label: "4角",
      m: TURF1200_CORNER4,
      title: "外の逃げが下がる",
      body: cornerLine,
    },
    {
      id: "hill",
      label: "坂",
      m: HILL_FROM,
      title: "急坂で前が残る",
      body: "直線310mの急坂。前と内が残る。差しは伸びるが、届く幅は小さい。追込はまだ後ろ。",
    },
    {
      id: "goal",
      label: "ゴール",
      m: 1200,
      title: "前と内の想定",
      body: "前と内の型。脚質は発走前の直近5走、枠は馬番。着順の予想ではない。",
    },
  ];
}

/**
 * 各馬の [発走, 下り, 3角, 4角, 坂, ゴール]。
 * behind は先頭からのメートル（論理値）。lane は 0 が最内。
 */
export function buildScript(horses: SimHorse[]): Record<number, HorseScript> {
  const script: Record<number, HorseScript> = {};
  const put = (horse: SimHorse, behind: number[], lane: number[]) => {
    script[horse.number] = { behind, lane };
  };

  byStyle(horses, "逃").forEach((horse, index) => {
    if (index === 0) {
      put(horse, [0, 0, 0, 0, 2, 0], [0, 0, 0, 0, 1, 0]);
      return;
    }
    const wide = Math.min(MAX_LANE, 1 + index);
    put(
      horse,
      [0, 2 + index * 2, 4 + index * 3, 22 + index * 8, 30 + index * 8, 34 + index * 8],
      [wide, wide, wide, Math.min(MAX_LANE, wide + 1), Math.min(MAX_LANE, wide + 1), Math.min(MAX_LANE, wide + 1)],
    );
  });

  byStyle(horses, "先").forEach((horse, index) => {
    const lane = index === 0 ? 0 : index === 1 ? 1 : 2;
    put(
      horse,
      [0, 12 + index * 4, 10 + index * 4, 6 + index * 4, 4 + index * 5, 5 + index * 5],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "差").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 1 + (index % 3));
    put(
      horse,
      [0, 30 + index * 6, 34 + index * 6, 38 + index * 6, 28 + index * 5, 24 + index * 5],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "追").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 2 + (index % 3));
    put(
      horse,
      [0, 58 + index * 8, 68 + index * 8, 76 + index * 8, 72 + index * 7, 66 + index * 7],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  return script;
}
