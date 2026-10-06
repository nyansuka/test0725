import { byStyle, leadName, type SimHorse, type SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 坂をコーナーで越える芝（京都・阪神の1200内、函館芝1000・1200）の台本。位置は共有する。
 * 中山芝1200（外の逃げが4角で落ち、直線の急坂で前が残る）は使わない。
 * 外の逃げはコーナーで開くだけ。直線では並びを作り直さない。
 * 脚質は発走前の直近5走。着順・当日オッズ・馬場は使わない。
 */

const MAX_LANE = 4;

export type CornerHillCourse = "kyoto" | "hanshin" | "hakodate";

export type CornerHillMarks = {
  course: CornerHillCourse;
  corner3: number;
  corner4: number;
  straightFrom: number;
  meters: number;
  /** 函館1200は2角奥のポケット。1000は向正面 */
  pocket?: boolean;
};

function horseLabel(horse: SimHorse) {
  return `${horse.number}番${horse.name}`;
}

export function buildCornerHillPhases(horses: SimHorse[], marks: CornerHillMarks): SimPhase[] {
  const leaders = byStyle(horses, "逃");
  const pace = leaders[0];
  const outer = leaders.slice(1);
  const gate =
    marks.course === "kyoto"
      ? "2角の出口"
      : marks.course === "hanshin"
        ? "向正面の入口"
        : marks.pocket
          ? "2角奥のポケット"
          : "向正面の2角寄り";
  const leaderLine = !pace
    ? "逃げはいない想定です。"
    : outer.length === 0
      ? `逃げは${horseLabel(pace)}。ハナを切る。`
      : `逃げは${leaders.map(horseLabel).join("、")}。${leadName(pace)}がハナ。外の${outer.map(horseLabel).join("と")}は並ぶ。4角で大きく落ちる型にはしない。`;
  const cornerLine = !pace
    ? "逃げがいない想定。先行が好位で直線へ向く。"
    : outer.length === 0
      ? `${pace.name}は先頭のまま。内の先行が好位。直線で並びは大きく変えない。`
      : `外の${outer.map(horseLabel).join("と")}はコーナーで外を回した分だけ開く。${pace.name}は先頭のまま。`;
  const straightBody =
    marks.course === "kyoto"
      ? "直線は平坦で328m。コーナーで付いた前と内が残る。差しは少し詰める。届く幅は小さい。"
      : marks.course === "hakodate"
        ? "直線は262m。下りから平坦。並びはコーナーで決める。前が残る。差しは少し詰める。"
        : "直線の急坂は、並びを作り直す地点にしない。コーナーで付いた前と内が残る。差しは少し詰める。";

  return [
    {
      id: "start",
      label: "発走",
      m: 0,
      title: "枠なり",
      body: `${gate}のゲート。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。`,
    },
    {
      id: "back",
      label: "向正面",
      m: 140,
      title: "前が並ぶ",
      body: marks.course === "hakodate" && marks.pocket ? `ポケットを出て向正面へ。${leaderLine}` : leaderLine,
    },
    {
      id: "c3",
      label: "3角",
      m: marks.corner3,
      title: "坂はコーナー",
      body:
        marks.course === "kyoto"
          ? `3角から坂を下りながら回る。${cornerLine}`
          : marks.course === "hakodate"
            ? `3〜4角を上りながら回る。${cornerLine}`
            : `最初のコーナーが近い。${cornerLine}`,
    },
    {
      id: "c4",
      label: "4角",
      m: marks.corner4,
      title: "並びはコーナーで決まる",
      body: cornerLine,
    },
    {
      id: "straight",
      label: "直線",
      m: marks.straightFrom,
      title: "直線では変えない",
      body: straightBody,
    },
    {
      id: "goal",
      label: "ゴール",
      m: marks.meters,
      title: "前と内の想定",
      body: "前と内の型。脚質は発走前の直近5走、枠は馬番。着順の予想ではない。",
    },
  ];
}

export function buildCornerHillScript(horses: SimHorse[]) {
  const script: Record<number, { behind: number[]; lane: number[] }> = {};
  const put = (horse: SimHorse, behind: number[], lane: number[]) => {
    script[horse.number] = { behind, lane };
  };

  byStyle(horses, "逃").forEach((horse, index) => {
    if (index === 0) {
      put(horse, [0, 0, 0, 0, 1, 0], [0, 0, 0, 0, 0, 0]);
      return;
    }
    const wide = Math.min(MAX_LANE, 1 + index);
    put(
      horse,
      [0, 2 + index, 6 + index * 3, 10 + index * 3, 11 + index * 3, 12 + index * 3],
      [wide, wide, wide, wide, wide, wide],
    );
  });

  byStyle(horses, "先").forEach((horse, index) => {
    const lane = index === 0 ? 0 : index === 1 ? 1 : 2;
    put(
      horse,
      [0, 8 + index * 3, 6 + index * 3, 6 + index * 3, 7 + index * 3, 8 + index * 3],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "差").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 1 + (index % 3));
    put(
      horse,
      [0, 26 + index * 5, 30 + index * 5, 28 + index * 4, 24 + index * 4, 20 + index * 4],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "追").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 2 + (index % 3));
    put(
      horse,
      [0, 48 + index * 7, 56 + index * 7, 54 + index * 6, 50 + index * 6, 46 + index * 6],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  return script;
}
