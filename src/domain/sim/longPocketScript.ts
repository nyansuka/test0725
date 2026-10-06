import { byStyle, leadName, type SimHorse, type SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 直線が長いポケット（東京芝1800・2000）の台本。1800と2000で位置を共有する。
 * 中山芝1200も、向正面から入る東京芝1400・1600も使わない。
 * 外の逃げはコーナーでも前。直線で差しは詰めるが、後方から一気には届かない。
 * 脚質は発走前の直近5走。着順・当日オッズ・馬場は使わない。
 */

const MAX_LANE = 4;

export type LongPocketMarks = {
  place: "1800" | "2000";
  pocketM: number;
  corner3: number;
  corner4: number;
  straightFrom: number;
  meters: number;
};

function horseLabel(horse: SimHorse) {
  return `${horse.number}番${horse.name}`;
}

export function buildLongPocketPhases(horses: SimHorse[], marks: LongPocketMarks): SimPhase[] {
  const leaders = byStyle(horses, "逃");
  const pace = leaders[0];
  const outer = leaders.slice(1);
  const leaderLine = !pace
    ? "逃げはいない想定です。"
    : outer.length === 0
      ? `逃げは${horseLabel(pace)}。ハナを切る。序盤は緩みやすい。`
      : `逃げは${leaders.map(horseLabel).join("、")}。${leadName(pace)}がハナ。外の${outer.map(horseLabel).join("と")}も前にいる。`;
  const cornerLine = !pace
    ? "逃げがいない想定。先行が好位で長い直線へ向く。"
    : outer.length === 0
      ? `${pace.name}は先頭のまま。先行が好位。`
      : `${outer.map(horseLabel).join("と")}は外にいても前のまま。${pace.name}は先頭。`;
  const pocketBody =
    marks.place === "1800"
      ? `1〜2角のポケット。合流まで約150m。${leaderLine}`
      : `1角の奥から約100mで左へ曲がる。${leaderLine}`;

  return [
    {
      id: "start",
      label: "発走",
      m: 0,
      title: "ポケット",
      body: "ポケットのゲート。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。",
    },
    {
      id: "pocket",
      label: "合流",
      m: marks.pocketM,
      title: "すぐコーナー",
      body: pocketBody,
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
      body: "直線は525.9m。差しは詰める。後方から一気には届かない。",
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

export function buildLongPocketScript(horses: SimHorse[]) {
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
      [0, 3 + index * 2, 4 + index * 2, 4 + index * 2, 6 + index * 2, 8 + index * 2],
      [wide, wide, wide, wide, wide, wide],
    );
  });

  byStyle(horses, "先").forEach((horse, index) => {
    const lane = index === 0 ? 0 : index === 1 ? 1 : 2;
    put(
      horse,
      [0, 4 + index * 2, 4 + index * 2, 4 + index * 2, 3 + index * 2, 4 + index * 2],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "差").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 1 + (index % 3));
    put(
      horse,
      [0, 14 + index * 3, 16 + index * 3, 16 + index * 3, 12 + index * 3, 11 + index * 3],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "追").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 2 + (index % 3));
    put(
      horse,
      [0, 30 + index * 5, 32 + index * 5, 32 + index * 5, 24 + index * 4, 20 + index * 4],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  return script;
}
