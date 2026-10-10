import { byStyle, leadName, type SimHorse, type SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 長い引き込み（京都芝1800、中京芝1600）の台本。位置は共有する。
 * 140m地点はまだ引き込みの中。本線に入るのはその後。
 * 中山芝1200（外の逃げが4角で落ちる）は使わない。
 * 向正面の中京芝1200・1300・1400も、東京の長い直線も使わない。
 * 並びは引き込みの中で付き、コーナーと坂では作り直さない。
 * 脚質は発走前の直近5走。着順・当日オッズ・馬場は使わない。
 */

const MAX_LANE = 4;

export type LongChuteMarks = {
  place: "kyoto" | "chukyo";
  /** 京都芝1600だけ。1800は外回りの既定文 */
  rail?: "内" | "外";
  /** 本線に入る地点。140より大きい */
  joinM: number;
  corner3: number;
  corner4: number;
  straightFrom: number;
  meters: number;
};

function horseLabel(horse: SimHorse) {
  return `${horse.number}番${horse.name}`;
}

export function buildLongChutePhases(horses: SimHorse[], marks: LongChuteMarks): SimPhase[] {
  if (marks.joinM <= 140) throw new Error("長い引き込みの本線は140mより先");
  const leaders = byStyle(horses, "逃");
  const pace = leaders[0];
  const outer = leaders.slice(1);
  const leaderLine = !pace
    ? "逃げはいない想定です。"
    : outer.length === 0
      ? `逃げは${horseLabel(pace)}。ハナを切る。ペースは落ち着きやすい。`
      : `逃げは${leaders.map(horseLabel).join("、")}。${leadName(pace)}がハナ。外の${outer.map(horseLabel).join("と")}は並ぶ。4角で落とす型にはしない。`;
  const cornerLine = !pace
    ? "逃げがいない想定。先行が好位。引き込みで付いた並びのまま。"
    : outer.length === 0
      ? `${pace.name}は先頭のまま。先行が好位。並びは引き込みで付いている。`
      : `外の${outer.map(horseLabel).join("と")}は開いた分だけ外。${pace.name}は先頭のまま。`;
  const gate =
    marks.place === "kyoto"
      ? marks.rail === "内"
        ? "2角の奥の引き込み。内回り。"
        : marks.rail === "外"
          ? "2角の奥の引き込み。外回り。"
          : "引き込みのいちばん奥。外回り1600の200m奥。"
      : "1〜2角の外側の引き込み。";
  const joinBody =
    marks.place === "kyoto"
      ? `2角の出口で本線。140m地点はまだ引き込みの中。最初のコーナーまで長い。${leaderLine}`
      : `2角の出口で本線。140m地点はまだ引き込みの中。向正面の前半は上り、序盤は緩みやすい。${leaderLine}`;
  const cornerBody =
    marks.place === "kyoto"
      ? `3角まで約${Math.round(marks.corner3)}m。坂は3〜4角。${cornerLine}`
      : `3角まで約${Math.round(marks.corner3)}m。${cornerLine}`;
  const straightBody =
    marks.place === "kyoto"
      ? marks.rail === "内"
        ? "直線は平坦で328m。引き込みで付いた前が残る。差しは少し詰める。"
        : "直線は平坦で404m。引き込みで付いた前が残る。差しは少し詰める。"
      : "直線は412.5m。入口の急坂でも並びは大きく変えない。差しは少し詰める。";

  return [
    {
      id: "start",
      label: "発走",
      m: 0,
      title: "引き込み",
      body: `${gate}馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。`,
    },
    {
      id: "chute",
      label: "引き込み",
      m: 140,
      title: "まだ引き込み",
      body: `140m地点はまだ引き込みの中。本線までは約${Math.round(marks.joinM)}m。${leaderLine}`,
    },
    {
      id: "join",
      label: "本線",
      m: marks.joinM,
      title: "本線に入る",
      body: joinBody,
    },
    {
      id: "c3",
      label: "3角",
      m: marks.corner3,
      title: marks.place === "kyoto" ? "坂はコーナー" : "並びは付いたまま",
      body: cornerBody,
    },
    {
      id: "c4",
      label: "4角",
      m: marks.corner4,
      title: "外は落とさない",
      body: cornerLine,
    },
    {
      id: "straight",
      label: "直線",
      m: marks.straightFrom,
      title: marks.place === "kyoto" ? "平坦な直線" : "入口の急坂",
      body: straightBody,
    },
    {
      id: "goal",
      label: "ゴール",
      m: marks.meters,
      title: "前が残り、差しは少し",
      body: "引き込みで付いた前と好位が残る。差しは少し詰める。脚質は発走前の直近5走、枠は馬番。着順の予想ではない。",
    },
  ];
}

export function buildLongChuteScript(horses: SimHorse[]) {
  const script: Record<number, { behind: number[]; lane: number[] }> = {};
  const put = (horse: SimHorse, behind: number[], lane: number[]) => {
    script[horse.number] = { behind, lane };
  };

  byStyle(horses, "逃").forEach((horse, index) => {
    if (index === 0) {
      put(horse, [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]);
      return;
    }
    const wide = Math.min(MAX_LANE, 1 + index);
    put(
      horse,
      [0, 3 + index, 3 + index, 3 + index, 4 + index, 4 + index, 5 + index],
      [wide, wide, wide, wide, wide, wide, wide],
    );
  });

  byStyle(horses, "先").forEach((horse, index) => {
    const lane = index === 0 ? 0 : index === 1 ? 1 : 2;
    put(
      horse,
      [0, 5 + index * 2, 4 + index * 2, 4 + index * 2, 4 + index * 2, 4 + index * 2, 5 + index * 2],
      [lane, lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "差").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 1 + (index % 3));
    put(
      horse,
      [0, 19 + index * 3, 19 + index * 3, 19 + index * 3, 19 + index * 3, 16 + index * 3, 14 + index * 3],
      [lane, lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "追").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 2 + (index % 3));
    put(
      horse,
      [0, 41 + index * 5, 41 + index * 5, 41 + index * 5, 41 + index * 5, 35 + index * 4, 31 + index * 4],
      [lane, lane, lane, lane, lane, lane, lane],
    );
  });

  return script;
}
