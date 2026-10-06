import { byStyle, type SimHorse, type SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 外回りの一周超（京都芝2400）の台本。
 * 中山芝1200は使わない。坂は3〜4角に一度あり、最後の直線は平坦。
 * 中盤は緩む。坂から直線にかけて、先頭の余裕は小さくなり、好位と差しが詰める。
 * 脚質は発走前の直近5走。着順・当日オッズ・馬場は使わない。
 */

const MAX_LANE = 4;

export type OuterLapMarks = {
  passM: number;
  backM: number;
  hillM: number;
  straightFrom: number;
  meters: number;
};

function horseLabel(horse: SimHorse) {
  return `${horse.number}番${horse.name}`;
}

export function buildOuterLapPhases(horses: SimHorse[], marks: OuterLapMarks): SimPhase[] {
  const leaders = byStyle(horses, "逃");
  const pace = leaders[0];
  const stalk = byStyle(horses, "先")[0];
  const leaderName = pace ? horseLabel(pace) : "逃げ";
  const stalkName = stalk ? horseLabel(stalk) : "先行";

  return [
    {
      id: "start",
      label: "発走",
      m: 0,
      title: "4角の途中",
      body: "外回りの4角の途中。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。",
    },
    {
      id: "pass",
      label: "通過",
      m: marks.passM,
      title: "ゴールを一度通過",
      body: `ここから外回りをもう一周。${pace ? `${leaderName}がハナ。` : "逃げはいない想定です。"}まだ余裕がある。`,
    },
    {
      id: "back",
      label: "向正面",
      m: marks.backM,
      title: "中盤は緩む",
      body: "中盤は緩む。前との差はここで広がらない。",
    },
    {
      id: "hill",
      label: "坂",
      m: marks.hillM,
      title: "3〜4角の坂",
      body: `${leaderName}の余裕が小さくなる。${stalkName}が好位から詰める。`,
    },
    {
      id: "straight",
      label: "直線",
      m: marks.straightFrom,
      title: "平坦で差しが詰める",
      body: "直線は403.7mで平坦。好位と差しが詰める。後ろの方から一気には届かない。",
    },
    {
      id: "goal",
      label: "ゴール",
      m: marks.meters,
      title: "坂から直線で差が縮む",
      body: "先頭の余裕は坂から直線で小さくなる。脚質は発走前の直近5走、枠は馬番。着順の予想ではない。",
    },
  ];
}

export function buildOuterLapScript(horses: SimHorse[]) {
  const script: Record<number, { behind: number[]; lane: number[] }> = {};
  const put = (horse: SimHorse, behind: number[], lane: number[]) => {
    script[horse.number] = { behind, lane };
  };

  byStyle(horses, "逃").forEach((horse, index) => {
    if (index === 0) {
      put(horse, [0, 0, 0, 1, 3, 4], [0, 0, 0, 0, 1, 1]);
      return;
    }
    const wide = Math.min(MAX_LANE, 1 + index);
    put(
      horse,
      [0, 3 + index, 4 + index, 7 + index * 2, 8 + index * 2, 9 + index * 2],
      [wide, wide, wide, wide, wide, wide],
    );
  });

  byStyle(horses, "先").forEach((horse, index) => {
    const lane = index === 0 ? 0 : index === 1 ? 1 : 2;
    put(
      horse,
      [0, 6 + index * 2, 5 + index * 2, 4 + index * 2, 1 + index * 2, index * 2],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "差").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 1 + (index % 3));
    put(
      horse,
      [0, 16 + index * 3, 18 + index * 3, 14 + index * 3, 8 + index * 2, 5 + index * 2],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "追").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 2 + (index % 3));
    put(
      horse,
      [0, 34 + index * 5, 38 + index * 5, 36 + index * 5, 26 + index * 4, 18 + index * 4],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  return script;
}
