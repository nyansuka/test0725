import { byStyle, type SimHorse, type SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 発走が坂の途中にある内回り（中山芝1800）の台本。一周を少し超える。
 * 中山芝1200（向正面の下りで前が速くなり、外の逃げが4角で落ちる）は使わない。
 * 序盤の坂でペースは緩む。内の逃げ・先行が残り、外から被せた馬は外を回り続ける。
 * 脚質は発走前の直近5走。着順・当日オッズ・馬場は使わない。
 */

const MAX_LANE = 4;

export type OpeningHillMarks = {
  corner1: number;
  corner3: number;
  corner4: number;
  hillM: number;
  meters: number;
};

function horseLabel(horse: SimHorse) {
  return `${horse.number}番${horse.name}`;
}

export function buildOpeningHillPhases(horses: SimHorse[], marks: OpeningHillMarks): SimPhase[] {
  const leaders = byStyle(horses, "逃");
  const pace = leaders[0];
  const outer = leaders.slice(1);
  const inner = byStyle(horses, "先").filter((horse) => horse.bracket <= 2);
  const innerLine = inner.length
    ? `内の先行${inner.map(horseLabel).join("と")}はレールの好位。`
    : "内の先行が好位。";
  const cornerLine = !pace
    ? `逃げがいない想定。${innerLine}`
    : outer.length === 0
      ? `${pace.name}は先頭のまま。${innerLine}`
      : `外の${outer.map(horseLabel).join("と")}は外を回したまま。${pace.name}は先頭。${innerLine}`;

  return [
    {
      id: "start",
      label: "発走",
      m: 0,
      title: "坂の途中",
      body: "スタンド前、急坂の途中。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。",
    },
    {
      id: "c1",
      label: "1角",
      m: marks.corner1,
      title: "序盤は緩む",
      body: `坂は約63mまで。1角まで約${Math.round(marks.corner1)}m。序盤は緩む。${cornerLine}`,
    },
    {
      id: "c3",
      label: "3角",
      m: marks.corner3,
      title: "内が好位のまま",
      body: cornerLine,
    },
    {
      id: "c4",
      label: "4角",
      m: marks.corner4,
      title: "序盤の並びのまま",
      body: cornerLine,
    },
    {
      id: "hill",
      label: "坂",
      m: marks.hillM,
      title: "ゴール前の急坂",
      body: "直線は310m。発走で踏んだ急坂をもう一度。ここで後方から届く幅は小さい。",
    },
    {
      id: "goal",
      label: "ゴール",
      m: marks.meters,
      title: "内の逃げ・先行",
      body: "内の逃げ・先行の型。脚質は発走前の直近5走、枠は馬番。着順の予想ではない。",
    },
  ];
}

export function buildOpeningHillScript(horses: SimHorse[]) {
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
    const wideLane = Math.min(MAX_LANE, wide + 1);
    put(
      horse,
      [0, 6 + index * 3, 10 + index * 3, 12 + index * 3, 16 + index * 3, 18 + index * 3],
      [wide, wideLane, wideLane, wideLane, wideLane, wideLane],
    );
  });

  byStyle(horses, "先").forEach((horse, index) => {
    const lane = index === 0 ? 0 : index === 1 ? 1 : 2;
    put(
      horse,
      [0, 3 + index * 2, 3 + index * 2, 3 + index * 2, 4 + index * 2, 5 + index * 2],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "差").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 1 + (index % 3));
    put(
      horse,
      [0, 20 + index * 4, 26 + index * 4, 30 + index * 4, 28 + index * 4, 27 + index * 4],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "追").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 2 + (index % 3));
    put(
      horse,
      [0, 42 + index * 6, 52 + index * 6, 58 + index * 6, 56 + index * 6, 54 + index * 6],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  return script;
}
