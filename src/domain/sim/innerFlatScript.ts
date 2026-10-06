import { byStyle, leadName, type SimHorse, type SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 新潟芝1200内の台本。直線358.7mは平坦。
 * 東京の長い直線（525.9m、新潟外の658.7m）の台本は使わない。
 * 前は残る。差しは詰めるが、長い直線ほどは届かない。後方一気では届かない。
 * 脚質は発走前の直近5走。着順・当日オッズ・馬場は使わない。
 */

const MAX_LANE = 4;

export type InnerFlatMarks = {
  corner3: number;
  corner4: number;
  straightFrom: number;
  meters: number;
};

function horseLabel(horse: SimHorse) {
  return `${horse.number}番${horse.name}`;
}

export function buildInnerFlatPhases(horses: SimHorse[], marks: InnerFlatMarks): SimPhase[] {
  const leaders = byStyle(horses, "逃");
  const pace = leaders[0];
  const outer = leaders.slice(1);
  const leaderLine = !pace
    ? "逃げはいない想定です。"
    : outer.length === 0
      ? `逃げは${horseLabel(pace)}。ハナを切る。`
      : `逃げは${leaders.map(horseLabel).join("、")}。${leadName(pace)}がハナ。外の${outer.map(horseLabel).join("と")}も前にいる。`;
  const cornerLine = !pace
    ? "逃げがいない想定。先行が好位で直線へ向く。"
    : outer.length === 0
      ? `${pace.name}は先頭のまま。内の先行が好位。`
      : `外の${outer.map(horseLabel).join("と")}は開いても前のまま。${pace.name}は先頭。`;

  return [
    {
      id: "start",
      label: "発走",
      m: 0,
      title: "枠なり",
      body: "内回りの向正面。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。",
    },
    {
      id: "back",
      label: "向正面",
      m: 140,
      title: "平坦",
      body: `2角を出て向正面。坂はない。${leaderLine}`,
    },
    {
      id: "c3",
      label: "3角",
      m: marks.corner3,
      title: "前が残っている",
      body: `3角まで約${Math.round(marks.corner3)}m。${cornerLine}`,
    },
    {
      id: "c4",
      label: "4角",
      m: marks.corner4,
      title: "外の逃げは前",
      body: cornerLine,
    },
    {
      id: "straight",
      label: "直線",
      m: marks.straightFrom,
      title: "平坦な直線",
      body: "直線は358.7mで平坦。差しは詰める。長い直線ほどは届かず、後方一気では届かない。",
    },
    {
      id: "goal",
      label: "ゴール",
      m: marks.meters,
      title: "前が残り、差しは半ば",
      body: "前と好位が残る。差しは直線で少し詰める。脚質は発走前の直近5走、枠は馬番。着順の予想ではない。",
    },
  ];
}

export function buildInnerFlatScript(horses: SimHorse[]) {
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
      [0, 2 + index, 5 + index, 8 + index * 2, 10 + index * 2, 12 + index * 2],
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
      [0, 24 + index * 4, 26 + index * 4, 24 + index * 4, 18 + index * 3, 16 + index * 3],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "追").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 2 + (index % 3));
    put(
      horse,
      [0, 46 + index * 6, 50 + index * 6, 48 + index * 6, 40 + index * 5, 32 + index * 5],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  return script;
}
