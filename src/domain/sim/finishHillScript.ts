import { byStyle, leadName, type SimHorse, type SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 直線は長いが、ゴール前の急坂で前が残る芝の台本。位置は共有する。
 * 阪神の外回り芝1600・1800。直線は473.6m。発走は本線上。
 * 東京の長い直線（差しが詰める）は使わない。中山芝1200（外の逃げが4角で落ちる）も使わない。
 * 外の逃げは外を回した分だけ開く。直線でも並びは作り直さない。
 * 脚質は発走前の直近5走。着順・当日オッズ・馬場は使わない。
 */

const MAX_LANE = 4;

export type FinishHillMarks = {
  /** 1600は向正面の入口。1800はその200m手前 */
  place: "1600" | "1800";
  backM: number;
  corner3: number;
  corner4: number;
  straightFrom: number;
  meters: number;
};

function horseLabel(horse: SimHorse) {
  return `${horse.number}番${horse.name}`;
}

export function buildFinishHillPhases(horses: SimHorse[], marks: FinishHillMarks): SimPhase[] {
  const leaders = byStyle(horses, "逃");
  const pace = leaders[0];
  const outer = leaders.slice(1);
  const leaderLine = !pace
    ? "逃げはいない想定です。"
    : outer.length === 0
      ? `逃げは${horseLabel(pace)}。ハナを切る。ペースは落ち着きやすい。`
      : `逃げは${leaders.map(horseLabel).join("、")}。${leadName(pace)}がハナ。外の${outer.map(horseLabel).join("と")}は並ぶ。4角で落とす型にはしない。`;
  const cornerLine = !pace
    ? "逃げがいない想定。先行が好位で直線へ向く。"
    : outer.length === 0
      ? `${pace.name}は先頭のまま。先行が好位。直線で並びは大きく変えない。`
      : `外の${outer.map(horseLabel).join("と")}は外を回した分だけ開く。${pace.name}は先頭のまま。`;

  return [
    {
      id: "start",
      label: "発走",
      m: 0,
      title: "枠なり",
      body:
        marks.place === "1600"
          ? "外回りの向正面の入口。内回り1200と同じ地点。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。"
          : "外回りの向正面。1600の200m手前。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。",
    },
    {
      id: "back",
      label: "向正面",
      m: marks.backM,
      title: marks.place === "1800" ? "向正面へ入る" : "ペースは落ち着く",
      body:
        marks.place === "1800"
          ? `向正面の入口まで約${Math.round(marks.backM)}m。${leaderLine}`
          : `向正面に入ってすぐ。最初のコーナーまで長い。${leaderLine}`,
    },
    {
      id: "c3",
      label: "3角",
      m: marks.corner3,
      title: "外の3角",
      body: `3角まで約${Math.round(marks.corner3)}m。外回りの3〜4角。${cornerLine}`,
    },
    {
      id: "c4",
      label: "4角",
      m: marks.corner4,
      title: "外は開くだけ",
      body: cornerLine,
    },
    {
      id: "straight",
      label: "直線",
      m: marks.straightFrom,
      title: "急坂でも変えない",
      body: "直線は473.6m。ゴール前の急坂で並びは作り直さない。前が残る。差しはわずかに詰める。",
    },
    {
      id: "goal",
      label: "ゴール",
      m: marks.meters,
      title: "前が残る",
      body: "前が残る型。脚質は発走前の直近5走、枠は馬番。着順の予想ではない。",
    },
  ];
}

export function buildFinishHillScript(horses: SimHorse[]) {
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
      [0, 3 + index, 7 + index * 2, 10 + index * 2, 11 + index * 2, 12 + index * 2],
      [wide, wide, wide, wide, wide],
    );
  });

  byStyle(horses, "先").forEach((horse, index) => {
    const lane = index === 0 ? 0 : index === 1 ? 1 : 2;
    put(
      horse,
      [0, 8 + index * 2, 6 + index * 2, 5 + index * 2, 5 + index * 2, 6 + index * 2],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "差").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 1 + (index % 3));
    put(
      horse,
      [0, 22 + index * 4, 27 + index * 4, 26 + index * 4, 26 + index * 4, 27 + index * 4],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "追").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 2 + (index % 3));
    put(
      horse,
      [0, 44 + index * 6, 52 + index * 6, 51 + index * 6, 51 + index * 6, 52 + index * 6],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  return script;
}
