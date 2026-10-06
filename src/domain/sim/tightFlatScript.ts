import { byStyle, leadName, type SimHorse, type SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * 直線が短く平坦な小倉芝（1000・1200）の台本。位置は共有する。
 * 3〜4角は外へ長い。直線293mに坂はない。1200は丘の上から下るが、速い流れでも前が残る。
 * 中山芝1200の台本は使わない。
 * 脚質は発走前の直近5走。着順・当日オッズ・馬場は使わない。
 */

const MAX_LANE = 4;

export type TightFlatMarks = {
  /** 1200は丘の上のポケット。1000は丘を過ぎた向正面 */
  downhill: boolean;
  corner3: number;
  corner4: number;
  straightFrom: number;
  meters: number;
};

function horseLabel(horse: SimHorse) {
  return `${horse.number}番${horse.name}`;
}

export function buildTightFlatPhases(horses: SimHorse[], marks: TightFlatMarks): SimPhase[] {
  const leaders = byStyle(horses, "逃");
  const pace = leaders[0];
  const outer = leaders.slice(1);
  const leaderLine = !pace
    ? "逃げはいない想定です。"
    : outer.length === 0
      ? `逃げは${horseLabel(pace)}。ハナを切る。`
      : `逃げは${leaders.map(horseLabel).join("、")}。${leadName(pace)}がハナ。外の${outer.map(horseLabel).join("と")}は外を回す。`;
  const cornerLine = !pace
    ? "逃げがいない想定。内の先行が好位で直線へ向く。"
    : outer.length === 0
      ? `${pace.name}は先頭のまま。内の先行が好位。`
      : `外の${outer.map(horseLabel).join("と")}は3〜4角で開いた分だけ後ろになる。${pace.name}は先頭。直線では戻さない。`;

  return [
    {
      id: "start",
      label: "発走",
      m: 0,
      title: "枠なり",
      body: marks.downhill
        ? "2角奥、丘の上のポケット。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。"
        : "向正面のゲート。馬番の小さい順に、内から4頭ずつ。まだ脚質は出ていない。",
    },
    {
      id: "back",
      label: "向正面",
      m: 140,
      title: marks.downhill ? "丘を下る" : "平坦",
      body: marks.downhill
        ? `丘の上から向正面へ下る。テンは速くなりやすい。${leaderLine}`
        : `丘は発走の手前。向正面に坂はない。${leaderLine}`,
    },
    {
      id: "c3",
      label: "3角",
      m: marks.corner3,
      title: "外は長い",
      body: `3角まで約${Math.round(marks.corner3)}m。${cornerLine}`,
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
      title: "直線に坂はない",
      body: "直線は293mで平坦。速い流れでも並びは変えない。差しはほとんど詰める。",
    },
    {
      id: "goal",
      label: "ゴール",
      m: marks.meters,
      title: "前が残る",
      body: "前と内の型。脚質は発走前の直近5走、枠は馬番。着順の予想ではない。",
    },
  ];
}

export function buildTightFlatScript(horses: SimHorse[]) {
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
      [0, 4 + index, 10 + index * 2, 16 + index * 2, 17 + index * 2, 18 + index * 2],
      [wide, wide, wide, wide, wide, wide],
    );
  });

  byStyle(horses, "先").forEach((horse, index) => {
    const lane = index === 0 ? 0 : index === 1 ? 1 : 2;
    put(
      horse,
      [0, 6 + index * 2, 5 + index * 2, 4 + index * 2, 4 + index * 2, 5 + index * 2],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "差").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 1 + (index % 3));
    put(
      horse,
      [0, 26 + index * 4, 30 + index * 4, 29 + index * 4, 28 + index * 4, 27 + index * 4],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  byStyle(horses, "追").forEach((horse, index) => {
    const lane = Math.min(MAX_LANE, 2 + (index % 3));
    put(
      horse,
      [0, 48 + index * 6, 54 + index * 6, 53 + index * 6, 52 + index * 6, 50 + index * 6],
      [lane, lane, lane, lane, lane, lane],
    );
  });

  return script;
}
