import { byStyle, leadName, type SimHorse, type SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * ほぼ平坦で直線が短い芝（札幌芝1000・1200）の台本。位置は共有する。
 * 円に近く、外を回すロスは小さい。先行の捲りはあり、直線266mでは後方一気は届かない。
 * 中山芝1200の台本は使わない。
 * 脚質は発走前の直近5走。着順・当日オッズ・馬場は使わない。
 */

const MAX_LANE = 4;

export type RoundFlatMarks = {
  /** 1200は2角奥のポケット。1000は向正面 */
  pocket: boolean;
  corner3: number;
  corner4: number;
  straightFrom: number;
  meters: number;
};

function horseLabel(horse: SimHorse) {
  return `${horse.number}番${horse.name}`;
}

export function buildRoundFlatPhases(horses: SimHorse[], marks: RoundFlatMarks): SimPhase[] {
  const leaders = byStyle(horses, "逃");
  const pace = leaders[0];
  const outer = leaders.slice(1);
  const leaderLine = !pace
    ? "逃げはいない想定です。"
    : outer.length === 0
      ? `逃げは${horseLabel(pace)}。ハナを切る。`
      : `逃げは${leaders.map(horseLabel).join("、")}。${leadName(pace)}がハナ。外の${outer.map(horseLabel).join("と")}も前に残る。`;
  const cornerLine = !pace
    ? "逃げがいない想定。先行がコーナーで好位へ上がる。"
    : outer.length === 0
      ? `${pace.name}は先頭のまま。先行がコーナーから好位へ上がる。`
      : `${pace.name}は先頭。外の${outer.map(horseLabel).join("と")}は開いても前。先行が捲る余地はある。`;

  return [
    {
      id: "start",
      label: "発走",
      m: 0,
      title: "枠なり",
      body: marks.pocket
        ? "2角奥のポケット。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。"
        : "向正面のゲート。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。",
    },
    {
      id: "back",
      label: "向正面",
      m: 140,
      title: "平坦",
      body: marks.pocket ? `ポケットを出て向正面へ。坂はない。${leaderLine}` : `向正面は平坦。${leaderLine}`,
    },
    {
      id: "c3",
      label: "3角",
      m: marks.corner3,
      title: "捲りの余地",
      body: `3角まで約${Math.round(marks.corner3)}m。${cornerLine}`,
    },
    {
      id: "c4",
      label: "4角",
      m: marks.corner4,
      title: "外は落ち切らない",
      body: cornerLine,
    },
    {
      id: "straight",
      label: "直線",
      m: marks.straightFrom,
      title: "直線は短い",
      body: "直線は266mで平坦。ここで並びは大きく変えない。後方一気では届かない。",
    },
    {
      id: "goal",
      label: "ゴール",
      m: marks.meters,
      title: "前と好位",
      body: "前と好位の型。脚質は発走前の直近5走、枠は馬番。着順の予想ではない。",
    },
  ];
}

export function buildRoundFlatScript(horses: SimHorse[]) {
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
    put(
      horse,
      [0, 2 + index, 4 + index, 5 + index, 6 + index, 7 + index],
      [wide, wide, wide, wide, wide, wide],
    );
  });

  byStyle(horses, "先").forEach((horse, index) => {
    const lane = index === 0 ? 0 : index === 1 ? 1 : 2;
    put(
      horse,
      [0, 8 + index * 2, 5 + index * 2, 3 + index * 2, 3 + index * 2, 4 + index * 2],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "差").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 1 + (index % 3));
    put(
      horse,
      [0, 20 + index * 4, 22 + index * 4, 21 + index * 4, 20 + index * 4, 19 + index * 4],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "追").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 2 + (index % 3));
    put(
      horse,
      [0, 42 + index * 6, 46 + index * 6, 45 + index * 6, 44 + index * 6, 42 + index * 6],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  return script;
}
