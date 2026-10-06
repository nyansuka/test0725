import { byStyle, leadName, type SimHorse, type SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 向正面と直線の両方に上りがある短い芝（福島芝1000・1200）の台本。位置は共有する。
 * 直線は292m。上りで前は残る。外の逃げはコーナーで開くが、4角で大きくは落ちない。
 * 中山芝1200の台本は使わない。直線の上りでは並びを作り直さない。
 * 脚質は発走前の直近5走。着順・当日オッズ・馬場は使わない。
 */

const MAX_LANE = 4;

export type HomeUphillMarks = {
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

export function buildHomeUphillPhases(horses: SimHorse[], marks: HomeUphillMarks): SimPhase[] {
  const leaders = byStyle(horses, "逃");
  const pace = leaders[0];
  const outer = leaders.slice(1);
  const leaderLine = !pace
    ? "逃げはいない想定です。"
    : outer.length === 0
      ? `逃げは${horseLabel(pace)}。上りでもハナを切る。`
      : `逃げは${leaders.map(horseLabel).join("、")}。${leadName(pace)}がハナ。外の${outer.map(horseLabel).join("と")}は開く。`;
  const cornerLine = !pace
    ? "逃げがいない想定。先行が好位で直線の上りへ向く。"
    : outer.length === 0
      ? `${pace.name}は先頭のまま。内の先行が好位。`
      : `外の${outer.map(horseLabel).join("と")}はコーナーで開く。${pace.name}は先頭のまま。大きく落ちる型にはしない。`;

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
      title: "向正面は上り",
      body: marks.pocket ? `ポケットを出て向正面の上りへ。${leaderLine}` : `スタートから向正面を上る。${leaderLine}`,
    },
    {
      id: "c3",
      label: "3角",
      m: marks.corner3,
      title: "上りを越えて回る",
      body: `3角まで約${Math.round(marks.corner3)}m。${cornerLine}`,
    },
    {
      id: "c4",
      label: "4角",
      m: marks.corner4,
      title: "並びはここで決まる",
      body: cornerLine,
    },
    {
      id: "straight",
      label: "直線",
      m: marks.straightFrom,
      title: "直線でもう一度上る",
      body: "直線は292m。残り170mからもう一度上る。並びは作り直さない。差しはほとんど詰める。",
    },
    {
      id: "goal",
      label: "ゴール",
      m: marks.meters,
      title: "前が残る",
      body: "前と内の型。脚質は発走前の直近5走、枠は馬番。着順の予想ではない。",
    },
  ];
}

export function buildHomeUphillScript(horses: SimHorse[]) {
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
      [0, 3 + index, 7 + index * 2, 12 + index * 2, 13 + index * 2, 14 + index * 2],
      [wide, wide, wide, wide, wide, wide],
    );
  });

  byStyle(horses, "先").forEach((horse, index) => {
    const lane = index === 0 ? 0 : index === 1 ? 1 : 2;
    put(
      horse,
      [0, 7 + index * 2, 6 + index * 2, 6 + index * 2, 7 + index * 2, 8 + index * 2],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "差").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 1 + (index % 3));
    put(
      horse,
      [0, 24 + index * 4, 28 + index * 4, 27 + index * 4, 26 + index * 4, 25 + index * 4],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "追").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 2 + (index % 3));
    put(
      horse,
      [0, 46 + index * 6, 52 + index * 6, 51 + index * 6, 50 + index * 6, 48 + index * 6],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  return script;
}
