import { byStyle, leadName, type SimHorse, type SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 直線が短いポケット（中山芝1600）の台本。
 * 中山芝1200（外の逃げが4角で落ち、直線の急坂で前が残る）は使わない。
 * 外の逃げはポケットで開き、その位置のまま回る。直線の坂では並びを変えない。
 * 「横の本線がゴールまで約240m」は、ポケットを出てからコーナーまで240m、ではない。
 * 脚質は発走前の直近5走。着順・当日オッズ・馬場は使わない。
 */

const MAX_LANE = 4;

export type ShortPocketMarks = {
  railM: number;
  corner3: number;
  corner4: number;
  hillM: number;
  meters: number;
};

function horseLabel(horse: SimHorse) {
  return `${horse.number}番${horse.name}`;
}

export function buildShortPocketPhases(horses: SimHorse[], marks: ShortPocketMarks): SimPhase[] {
  const leaders = byStyle(horses, "逃");
  const pace = leaders[0];
  const outer = leaders.slice(1);
  const inner = byStyle(horses, "先").filter((horse) => horse.bracket <= 2);
  const leaderLine = !pace
    ? "逃げはいない想定です。"
    : outer.length === 0
      ? `逃げは${horseLabel(pace)}。ハナを切る。`
      : `逃げは${leaders.map(horseLabel).join("、")}。${leadName(pace)}がハナ。外の${outer.map(horseLabel).join("と")}はポケットで外にいる。`;
  const innerLine = inner.length
    ? `内の先行${inner.map(horseLabel).join("と")}はレールの好位。`
    : "内の先行が好位。";
  const cornerLine = !pace
    ? `逃げがいない想定。${innerLine}`
    : outer.length === 0
      ? `${pace.name}は先頭のまま。${innerLine}`
      : `外の${outer.map(horseLabel).join("と")}は開いた位置のまま回る。${pace.name}は先頭。${innerLine}`;

  return [
    {
      id: "start",
      label: "発走",
      m: 0,
      title: "ポケット",
      body: "1角横のポケット。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。",
    },
    {
      id: "rail",
      label: "本線",
      m: marks.railM,
      title: "2角の途中で入る",
      body: `ポケットは120m。2角の途中で本線に入る。${leaderLine}`,
    },
    {
      id: "c3",
      label: "3角",
      m: marks.corner3,
      title: "開いた位置のまま",
      body: `3角まで約${Math.round(marks.corner3)}m。${cornerLine}`,
    },
    {
      id: "c4",
      label: "4角",
      m: marks.corner4,
      title: "外は開いたまま",
      body: cornerLine,
    },
    {
      id: "hill",
      label: "坂",
      m: marks.hillM,
      title: "坂では変えない",
      body: "直線は310m。急坂で並びは変えない。差しが届く幅は小さい。",
    },
    {
      id: "goal",
      label: "ゴール",
      m: marks.meters,
      title: "内と好位",
      body: "内と好位の型。脚質は発走前の直近5走、枠は馬番。着順の予想ではない。",
    },
  ];
}

export function buildShortPocketScript(horses: SimHorse[]) {
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
      [0, 4 + index * 2, 8 + index * 2, 8 + index * 2, 9 + index * 2, 10 + index * 2],
      [wide, wide, wide, wide, wide, wide],
    );
  });

  byStyle(horses, "先").forEach((horse, index) => {
    const lane = index === 0 ? 0 : index === 1 ? 1 : 2;
    put(
      horse,
      [0, 5 + index * 2, 4 + index * 2, 4 + index * 2, 5 + index * 2, 6 + index * 2],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "差").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 1 + (index % 3));
    put(
      horse,
      [0, 18 + index * 4, 22 + index * 4, 24 + index * 4, 22 + index * 4, 20 + index * 4],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "追").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 2 + (index % 3));
    put(
      horse,
      [0, 40 + index * 6, 48 + index * 6, 50 + index * 6, 48 + index * 6, 46 + index * 6],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  return script;
}
