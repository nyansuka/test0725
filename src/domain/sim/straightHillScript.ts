import { byStyle, leadName, type SimHorse, type SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 直線の入口に急坂がある芝（中京芝1200・1300・1400）の台本。位置は共有する。
 * 直線は412.5m。差しは水準まで詰める。後方一気では届かない。内だけが残る型にはしない。
 * 中山芝1200の台本は使わない。東京の長い直線の台本も使わない。
 * 脚質は発走前の直近5走。着順・当日オッズ・馬場は使わない。
 */

const MAX_LANE = 4;

export type StraightHillMarks = {
  /** 1200・1300は向正面の上り。1400は2角の出口 */
  opening: "rise" | "long";
  corner3: number;
  corner4: number;
  straightFrom: number;
  meters: number;
};

function horseLabel(horse: SimHorse) {
  return `${horse.number}番${horse.name}`;
}

export function buildStraightHillPhases(horses: SimHorse[], marks: StraightHillMarks): SimPhase[] {
  const leaders = byStyle(horses, "逃");
  const pace = leaders[0];
  const outer = leaders.slice(1);
  const leaderLine = !pace
    ? "逃げはいない想定です。"
    : outer.length === 0
      ? `逃げは${horseLabel(pace)}。ハナを切る。`
      : `逃げは${leaders.map(horseLabel).join("、")}。${leadName(pace)}がハナ。外の${outer.map(horseLabel).join("と")}も前にいる。`;
  const cornerLine = !pace
    ? "逃げがいない想定。先行が好位で坂へ向く。"
    : outer.length === 0
      ? `${pace.name}は先頭のまま。先行が好位。`
      : `外の${outer.map(horseLabel).join("と")}は4角で開く。落ち切る型にはしない。${pace.name}は先頭。`;

  return [
    {
      id: "start",
      label: "発走",
      m: 0,
      title: "枠なり",
      body: "向正面のゲート。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。",
    },
    {
      id: "back",
      label: "向正面",
      m: 140,
      title: marks.opening === "rise" ? "発走後に上る" : "テンは速い",
      body:
        marks.opening === "rise"
          ? `向正面の前半は上り。${leaderLine}`
          : `2角を出て向正面。最初のコーナーまで長く、テンは速くなりやすい。${leaderLine}`,
    },
    {
      id: "c3",
      label: "3角",
      m: marks.corner3,
      title: "坂の手前",
      body: `3角まで約${Math.round(marks.corner3)}m。${cornerLine}`,
    },
    {
      id: "c4",
      label: "4角",
      m: marks.corner4,
      title: "外は開く",
      body: cornerLine,
    },
    {
      id: "straight",
      label: "直線",
      m: marks.straightFrom,
      title: "入口の急坂",
      body: "直線は412.5m。入口の急坂から差しは詰める。後方一気では届かない。",
    },
    {
      id: "goal",
      label: "ゴール",
      m: marks.meters,
      title: "差しは水準",
      body: "前も残り、差しは坂から直線で詰める。脚質は発走前の直近5走、枠は馬番。着順の予想ではない。",
    },
  ];
}

export function buildStraightHillScript(horses: SimHorse[]) {
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
      [0, 2 + index, 4 + index, 7 + index * 2, 8 + index * 2, 10 + index * 2],
      [wide, wide, wide, wide, wide, wide],
    );
  });

  byStyle(horses, "先").forEach((horse, index) => {
    const lane = index === 0 ? 0 : index === 1 ? 1 : 2;
    put(
      horse,
      [0, 7 + index * 2, 6 + index * 2, 6 + index * 2, 5 + index * 2, 6 + index * 2],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "差").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 1 + (index % 3));
    put(
      horse,
      [0, 22 + index * 4, 26 + index * 4, 24 + index * 4, 12 + index * 3, 6 + index * 3],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "追").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 2 + (index % 3));
    put(
      horse,
      [0, 44 + index * 6, 50 + index * 6, 48 + index * 6, 30 + index * 5, 20 + index * 5],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  return script;
}
