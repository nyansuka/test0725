import { byStyle, leadName, type SimHorse, type SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 直線が長い芝の台本。位置は共有する。
 * 東京芝1400・1600。新潟は外回りの芝1600・1800（直線658.7m）。
 * 新潟の内回り（直線358.7m）は使わない。芝1400は内と外が距離だけでは分かれないので載せない。
 * 中山芝1200（外の逃げが4角で落ち、直線の急坂で前が残る）は使わない。
 * 外の逃げは4角でも前にいる。直線で差しは詰めるが、後方一気では届かない。
 * 脚質は発走前の直近5走。着順・当日オッズ・馬場は使わない。
 */

const MAX_LANE = 4;

export type LongStraightMarks = {
  /** 1400は発走後の緩い上りに触れる。新潟外は long */
  opening: "rise" | "long";
  /** 省略すると東京。新潟外は直線が平坦 */
  place?: "tokyo" | "niigata";
  corner3: number;
  corner4: number;
  straightFrom: number;
  meters: number;
};

function horseLabel(horse: SimHorse) {
  return `${horse.number}番${horse.name}`;
}

export function buildLongStraightPhases(horses: SimHorse[], marks: LongStraightMarks): SimPhase[] {
  const leaders = byStyle(horses, "逃");
  const pace = leaders[0];
  const outer = leaders.slice(1);
  const leaderLine = !pace
    ? "逃げはいない想定です。"
    : outer.length === 0
      ? `逃げは${horseLabel(pace)}。ハナを切る。ペースは落ち着きやすい。`
      : `逃げは${leaders.map(horseLabel).join("、")}。${leadName(pace)}がハナ。外の${outer.map(horseLabel).join("と")}も前にいる。4角で外の逃げを落とす型にはしない。`;
  const cornerLine = !pace
    ? "逃げがいない想定。先行が好位で長い直線へ向く。"
    : outer.length === 0
      ? `${pace.name}は先頭のまま。内の先行が好位で直線へ向く。`
      : `${outer.map(horseLabel).join("と")}は外にいても前のまま。${pace.name}は先頭。直線で並びを急には変えない。`;

  const niigata = marks.place === "niigata";
  return [
    {
      id: "start",
      label: "発走",
      m: 0,
      title: "枠なり",
      body: niigata
        ? "外回りの向正面。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。"
        : "向正面のゲート。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。",
    },
    {
      id: "back",
      label: "向正面",
      m: 140,
      title: "ペースは落ち着く",
      body: niigata
        ? `分岐の先が上り、3〜4角は下り。${leaderLine}`
        : marks.opening === "rise"
          ? `発走後に緩い上り。${leaderLine}`
          : `最初のコーナーまで長い。${leaderLine}`,
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
      title: "外の逃げは前のまま",
      body: cornerLine,
    },
    {
      id: "straight",
      label: "直線",
      m: marks.straightFrom,
      title: "差しは詰める",
      body: niigata
        ? "直線は658.7mで平坦。差しは詰める。後方一気では届かない。"
        : "直線は525.9m。差しは詰める。後方一気では届かない。緩い上りで前が残る型にはしない。",
    },
    {
      id: "goal",
      label: "ゴール",
      m: marks.meters,
      title: "前が残り、差しは届きかける",
      body: "前と好位が残る。差しは直線で詰める。脚質は発走前の直近5走、枠は馬番。着順の予想ではない。",
    },
  ];
}

export function buildLongStraightScript(horses: SimHorse[]) {
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
      [0, 1 + index, 2 + index, 3 + index * 2, 5 + index * 2, 7 + index * 2],
      [wide, wide, wide, wide, wide, wide],
    );
  });

  byStyle(horses, "先").forEach((horse, index) => {
    const lane = index === 0 ? 0 : index === 1 ? 1 : 2;
    put(
      horse,
      [0, 6 + index * 3, 5 + index * 3, 5 + index * 3, 4 + index * 3, 5 + index * 3],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "差").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 1 + (index % 3));
    put(
      horse,
      [0, 22 + index * 4, 24 + index * 4, 22 + index * 4, 14 + index * 3, 10 + index * 3],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "追").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 2 + (index % 3));
    put(
      horse,
      [0, 44 + index * 6, 48 + index * 6, 46 + index * 6, 32 + index * 5, 24 + index * 5],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  return script;
}
