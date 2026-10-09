import { chukyoTurf1200Run, chukyoTurf1300Run, chukyoTurf1400Run, chukyoTurf1600Run } from "@/domain/sim/chukyoCourse";
import { buildCornerHillPhases, buildCornerHillScript } from "@/domain/sim/cornerHillScript";
import { buildFinishHillPhases, buildFinishHillScript } from "@/domain/sim/finishHillScript";
import { fukushimaTurf1000Run, fukushimaTurf1200Run } from "@/domain/sim/fukushimaCourse";
import { hakodateTurf1000Run, hakodateTurf1200Run } from "@/domain/sim/hakodateCourse";
import { hanshinTurf1200Run, hanshinTurf1600Run, hanshinTurf1800Run } from "@/domain/sim/hanshinCourse";
import { buildHomeUphillPhases, buildHomeUphillScript } from "@/domain/sim/homeUphillScript";
import { buildInnerFlatPhases, buildInnerFlatScript } from "@/domain/sim/innerFlatScript";
import { kokuraTurf1000Run, kokuraTurf1200Run } from "@/domain/sim/kokuraCourse";
import { kyotoTurf1200Run, kyotoTurf1800Run, kyotoTurf2400Run } from "@/domain/sim/kyotoCourse";
import { buildLongChutePhases, buildLongChuteScript } from "@/domain/sim/longChuteScript";
import { buildLongPocketPhases, buildLongPocketScript } from "@/domain/sim/longPocketScript";
import { buildLongStraightPhases, buildLongStraightScript } from "@/domain/sim/longStraightScript";
import { nakayamaTurf1600Run, nakayamaTurf1800Run } from "@/domain/sim/nakayamaCourse";
import { niigataTurf1200Run, niigataTurf1600Run, niigataTurf1800Run } from "@/domain/sim/niigataCourse";
import { buildOpeningHillPhases, buildOpeningHillScript } from "@/domain/sim/openingHillLapScript";
import { buildOuterLapPhases, buildOuterLapScript } from "@/domain/sim/outerLapScript";
import { projectTurf, type TurfPoint } from "@/domain/sim/projectTurf";
import { buildRoundFlatPhases, buildRoundFlatScript } from "@/domain/sim/roundFlatScript";
import { sapporoTurf1000Run, sapporoTurf1200Run } from "@/domain/sim/sapporoCourse";
import { buildShortPocketPhases, buildShortPocketScript } from "@/domain/sim/shortPocketScript";
import { buildStraightHillPhases, buildStraightHillScript } from "@/domain/sim/straightHillScript";
import { buildTightFlatPhases, buildTightFlatScript } from "@/domain/sim/tightFlatScript";
import type { SimHorse, SimPhase } from "@/domain/sim/nakayamaTurf1200Script";
import type { StretchKind } from "@/domain/sim/fieldShape";
import { createTurfCourse } from "@/domain/sim/turfCoursePlay";
import type { TurfOneTurnId } from "@/domain/sim/turfOneTurn";
import { tokyoTurf1400Run, tokyoTurf1600Run, tokyoTurf1800Run, tokyoTurf2000Run } from "@/domain/sim/tokyoCourse";

/**
 * 中山芝1200以外の芝。点列は各場、台本は型で共有する。
 * 中山芝1200の台本はここから呼ばない。
 * 残り6場のワンターンも同じ。2角のポケットは本線を戻した位置に置かない。
 * 阪神の外回り1600・1800は本線上。前が残る台本で、東京の長い直線は使わない。
 * 長い引き込みは京都芝1800と中京芝1600。140m地点はまだ引き込み。本線の戻り位置には置かない。
 */

export type TurfCourseId = Exclude<TurfOneTurnId, "nakayama-turf-1200">;

type Built = {
  id: TurfCourseId;
  raceMeters: number;
  viewBox: string;
  title: { x: number; y: number };
  note: { x: number; y: number };
  titleText: string;
  subtitle: string;
  noteText: string;
  aria: string;
  facts: string[];
  track: string;
  gate: string;
  hill: string;
  idle: string;
  labels: { m: number; text: string; out: number }[];
  pointAt: (meter: number) => TurfPoint;
  markerAt: (meter: number, outwardPx: number) => { x: number; y: number };
  play: (horses: SimHorse[]) => ReturnType<typeof createTurfCourse>;
};

function approachTail(idle: TurfPoint[], back = 160): TurfPoint[] {
  if (idle.length < 2) return idle;
  const end = idle[idle.length - 1].m;
  const kept = idle.filter((point) => point.m >= end - back);
  return kept.length >= 2 ? kept : idle.slice(-2);
}

function viewOf(
  idle: TurfPoint[],
  run: TurfPoint[],
  hills: Array<[number, number]>,
  approach?: TurfPoint[],
): Pick<Built, "viewBox" | "title" | "note" | "track" | "gate" | "hill" | "idle" | "pointAt" | "markerAt"> {
  const projected = projectTurf(idle, run, approach);
  return {
    viewBox: projected.viewBox,
    title: projected.title,
    note: projected.note,
    track: projected.coursePathD,
    gate: projected.gatePathD(),
    hill: hills.map(([from, to]) => projected.hillPathD(from, to)).join(" "),
    idle: projected.unusedPathD,
    pointAt: projected.pointAt,
    markerAt: projected.markerAt,
  };
}

function buildKyoto(): Built {
  const run = kyotoTurf1200Run();
  const picture = viewOf(run.idle, run.run, [[run.hillFrom, run.hillTo]]);
  return {
    id: "kyoto-turf-1200",
    raceMeters: 1200,
    ...picture,
    titleText: "京都芝1200",
    subtitle: "内回り・右回り",
    noteText: "1〜2角はこの距離では通らない",
    aria: "京都芝1200の想定走行。右回りの内回りを、2角の出口から平坦な直線まで進む",
    facts: [
      "右回り・内回り",
      "2角の出口",
      `3角まで約${Math.round(run.corner3)}m・坂`,
      "直線328m・平坦",
    ],
    labels: [
      { m: 16, text: "発走", out: 58 },
      { m: run.hillFrom, text: "坂", out: 58 },
      { m: run.corner3, text: "3角", out: 58 },
      { m: run.corner4, text: "4角", out: 58 },
      { m: run.straightFrom, text: "直線", out: 58 },
      { m: 1200, text: "ゴール", out: 58 },
    ],
    play(horses) {
      const marks = {
        course: "kyoto" as const,
        corner3: run.corner3,
        corner4: run.corner4,
        straightFrom: run.straightFrom,
        meters: 1200,
      };
      return createTurfCourse(horses, {
        raceMeters: 1200,
        pointAt: picture.pointAt,
        phases: buildCornerHillPhases(horses, marks),
        script: buildCornerHillScript(horses),
        stretch: "middle",
      });
    },
  };
}

function buildHanshin(): Built {
  const run = hanshinTurf1200Run();
  const picture = viewOf(run.idle, run.run, [[run.hillFrom, run.hillTo]]);
  return {
    id: "hanshin-turf-1200",
    raceMeters: 1200,
    ...picture,
    titleText: "阪神芝1200",
    subtitle: "内回り・右回り",
    noteText: "1〜2角はこの距離では通らない",
    aria: "阪神芝1200の想定走行。右回りの内回りを、向正面の入口から直線の急坂まで進む",
    facts: [
      "右回り・内回り",
      "向正面の入口",
      `3角まで約${Math.round(run.corner3)}m`,
      "直線357m。並びはコーナーで決める",
    ],
    labels: [
      { m: 16, text: "発走", out: 58 },
      { m: run.corner3, text: "3角", out: 58 },
      { m: run.corner4, text: "4角", out: 58 },
      { m: run.straightFrom, text: "直線", out: 58 },
      { m: (run.hillFrom + run.hillTo) / 2, text: "急坂", out: 58 },
      { m: 1200, text: "ゴール", out: 58 },
    ],
    play(horses) {
      const marks = {
        course: "hanshin" as const,
        corner3: run.corner3,
        corner4: run.corner4,
        straightFrom: run.straightFrom,
        meters: 1200,
      };
      return createTurfCourse(horses, {
        raceMeters: 1200,
        pointAt: picture.pointAt,
        phases: buildCornerHillPhases(horses, marks),
        script: buildCornerHillScript(horses),
        stretch: "middle",
      });
    },
  };
}

function buildTokyo(meters: 1400 | 1600): Built {
  const run = meters === 1400 ? tokyoTurf1400Run() : tokyoTurf1600Run();
  const picture = viewOf(run.idle, run.run, [[run.hillFrom, run.hillTo]]);
  const id = meters === 1400 ? "tokyo-turf-1400" : "tokyo-turf-1600";
  return {
    id,
    raceMeters: meters,
    ...picture,
    titleText: `東京芝${meters}`,
    subtitle: "左回り",
    noteText: "1〜2角はこの距離では通らない",
    aria: `東京芝${meters}の想定走行。左回りを、向正面から長い直線まで進む`,
    facts: [
      "左回り",
      meters === 1400 ? "向正面・発走後に緩い上り" : "向正面の2角寄り",
      `3角まで約${Math.round(run.corner3)}m`,
      "直線526m",
    ],
    labels: [
      { m: 16, text: "発走", out: 58 },
      { m: run.corner3, text: "3角", out: 58 },
      { m: run.corner4, text: "4角", out: 58 },
      { m: run.straightFrom, text: "直線", out: 58 },
      { m: (run.hillFrom + run.hillTo) / 2, text: "上り", out: 58 },
      { m: meters, text: "ゴール", out: 58 },
    ],
    play(horses) {
      return createTurfCourse(horses, {
        raceMeters: meters,
        pointAt: picture.pointAt,
        phases: buildLongStraightPhases(horses, {
          opening: meters === 1400 ? "rise" : "long",
          corner3: run.corner3,
          corner4: run.corner4,
          straightFrom: run.straightFrom,
          meters,
        }),
        script: buildLongStraightScript(horses),
        stretch: "long",
      });
    },
  };
}

function buildNakayama1600(): Built {
  const run = nakayamaTurf1600Run();
  const picture = viewOf(run.idle, run.run, [[run.hillFrom, run.hillTo]], run.approach);
  const railM = Math.max(run.pocketJoin, 140);
  return {
    id: "nakayama-turf-1600",
    raceMeters: 1600,
    ...picture,
    titleText: "中山芝1600",
    subtitle: "外回り・右回り",
    noteText: `発走の横はゴールまで約${Math.round(run.railStart)}m`,
    aria: "中山芝1600の想定走行。右回りの外回りを、1角横のポケットから直線の急坂まで進む",
    facts: ["右回り・外回り", "1角横のポケット120m", "2角の途中で本線へ", "直線310m・急坂"],
    labels: [
      { m: 16, text: "発走", out: 58 },
      { m: run.pocketJoin, text: "本線", out: 58 },
      { m: run.corner3, text: "3角", out: 58 },
      { m: run.corner4, text: "4角", out: 58 },
      { m: (run.hillFrom + run.hillTo) / 2, text: "急坂", out: 58 },
      { m: 1600, text: "ゴール", out: 58 },
    ],
    play(horses) {
      return createTurfCourse(horses, {
        raceMeters: 1600,
        pointAt: picture.pointAt,
        phases: buildShortPocketPhases(horses, {
          railM,
          corner3: run.corner3,
          corner4: run.corner4,
          hillM: run.hillFrom,
          meters: 1600,
        }),
        script: buildShortPocketScript(horses),
        stretch: "short",
      });
    },
  };
}

function buildNakayama1800(): Built {
  const run = nakayamaTurf1800Run();
  const picture = viewOf([], run.run, [[run.hillFrom, run.hillTo]], approachTail(run.idle));
  return {
    id: "nakayama-turf-1800",
    raceMeters: 1800,
    ...picture,
    titleText: "中山芝1800",
    subtitle: "内回り・右回り",
    noteText: "ゴールを一度通過して1周",
    aria: "中山芝1800の想定走行。右回りの内回りを、急坂の途中から発走し、ゴール前の急坂まで進む",
    facts: ["右回り・内回り", "スタンド前の急坂から", "1角まで約205m", "直線310m・急坂"],
    labels: [
      { m: 16, text: "発走", out: 72 },
      { m: run.corner1, text: "1角", out: 58 },
      { m: run.corner3, text: "3角", out: 58 },
      { m: run.corner4, text: "4角", out: 58 },
      { m: run.hillFrom, text: "急坂", out: 58 },
      { m: 1800, text: "ゴール", out: 58 },
    ],
    play(horses) {
      return createTurfCourse(horses, {
        raceMeters: 1800,
        pointAt: picture.pointAt,
        phases: buildOpeningHillPhases(horses, {
          corner1: run.corner1,
          corner3: run.corner3,
          corner4: run.corner4,
          hillM: run.hillFrom,
          meters: 1800,
        }),
        script: buildOpeningHillScript(horses),
        stretch: "middle",
      });
    },
  };
}

function buildTokyoPocket(meters: 1800 | 2000): Built {
  const run = meters === 1800 ? tokyoTurf1800Run() : tokyoTurf2000Run();
  const picture = viewOf(run.idle, run.run, [[run.hillFrom, run.hillTo]], run.approach);
  const id = meters === 1800 ? "tokyo-turf-1800" : "tokyo-turf-2000";
  return {
    id,
    raceMeters: meters,
    ...picture,
    titleText: `東京芝${meters}`,
    subtitle: "ポケット・左回り",
    noteText: meters === 1800 ? "1〜2角のポケット" : "1角奥のポケット",
    aria: `東京芝${meters}の想定走行。左回りのポケットから、長い直線まで進む`,
    facts: [
      "左回り",
      meters === 1800 ? "1〜2角・合流まで約150m" : "1角の奥・約100mで曲がる",
      `3角まで約${Math.round(run.corner3)}m`,
      "直線526m",
    ],
    labels: [
      { m: 16, text: "発走", out: 58 },
      { m: run.pocketJoin, text: "合流", out: 58 },
      { m: run.corner3, text: "3角", out: 58 },
      { m: run.corner4, text: "4角", out: 58 },
      { m: run.straightFrom, text: "直線", out: 58 },
      { m: meters, text: "ゴール", out: 58 },
    ],
    play(horses) {
      return createTurfCourse(horses, {
        raceMeters: meters,
        pointAt: picture.pointAt,
        phases: buildLongPocketPhases(horses, {
          place: meters === 1800 ? "1800" : "2000",
          pocketM: Math.max(run.pocketJoin, 140),
          corner3: run.corner3,
          corner4: run.corner4,
          straightFrom: run.straightFrom,
          meters,
        }),
        script: buildLongPocketScript(horses),
        stretch: "long",
      });
    },
  };
}

function buildKyoto2400(): Built {
  const run = kyotoTurf2400Run();
  const picture = viewOf([], run.run, [[run.hillFrom, run.hillTo]], approachTail(run.idle));
  return {
    id: "kyoto-turf-2400",
    raceMeters: 2400,
    ...picture,
    titleText: "京都芝2400",
    subtitle: "外回り・右回り",
    noteText: "ゴールを一度通過して1周",
    aria: "京都芝2400の想定走行。右回りの外回りを、4角の途中から発走し、平坦な直線まで進む",
    facts: ["右回り・外回り", "4角の途中から", "坂は3〜4角", "直線404m・平坦"],
    labels: [
      { m: 16, text: "発走", out: 58 },
      { m: run.corner1, text: "1角", out: 58 },
      { m: (run.hillFrom + run.hillTo) / 2, text: "坂", out: 58 },
      { m: run.straightFrom, text: "直線", out: 58 },
      { m: 2400, text: "ゴール", out: 58 },
    ],
    play(horses) {
      return createTurfCourse(horses, {
        raceMeters: 2400,
        pointAt: picture.pointAt,
        phases: buildOuterLapPhases(horses, {
          passM: run.passFinish,
          backM: run.back,
          hillM: run.hillFrom,
          straightFrom: run.straightFrom,
          meters: 2400,
        }),
        script: buildOuterLapScript(horses),
        stretch: "long",
      });
    },
  };
}

function pack(
  meta: Pick<Built, "id" | "raceMeters" | "titleText" | "subtitle" | "noteText" | "aria" | "facts" | "labels">,
  pictured: { run: TurfPoint[]; idle: TurfPoint[]; approach?: TurfPoint[]; hills: Array<[number, number]> },
  stretch: StretchKind,
  motion: (horses: SimHorse[]) => { phases: SimPhase[]; script: ReturnType<typeof buildCornerHillScript> },
): Built {
  const picture = viewOf(pictured.idle, pictured.run, pictured.hills, pictured.approach);
  return {
    ...meta,
    ...picture,
    play(horses) {
      const moved = motion(horses);
      return createTurfCourse(horses, {
        raceMeters: meta.raceMeters,
        pointAt: picture.pointAt,
        phases: moved.phases,
        script: moved.script,
        stretch,
      });
    },
  };
}

function cornerLabels(meters: number, corner3: number, corner4: number, straightFrom: number, extra: Built["labels"] = []): Built["labels"] {
  return [
    { m: 16, text: "発走", out: 58 },
    ...extra,
    { m: corner3, text: "3角", out: 58 },
    { m: corner4, text: "4角", out: 58 },
    { m: straightFrom, text: "直線", out: 58 },
    { m: meters, text: "ゴール", out: 58 },
  ];
}

function buildSapporo(meters: 1000 | 1200): Built {
  const run = meters === 1000 ? sapporoTurf1000Run() : sapporoTurf1200Run();
  const pocket = meters === 1200;
  return pack(
    {
      id: meters === 1000 ? "sapporo-turf-1000" : "sapporo-turf-1200",
      raceMeters: meters,
      titleText: `札幌芝${meters}`,
      subtitle: pocket ? "ポケット・右回り" : "右回り",
      noteText: pocket ? "2角奥のポケット" : "1〜2角はこの距離では通らない",
      aria: pocket
        ? "札幌芝1200の想定走行。右回りを、2角奥のポケットから短い直線まで進む"
        : "札幌芝1000の想定走行。右回りの向正面から、短い直線まで進む",
      facts: [
        "右回り",
        pocket ? "2角奥のポケット" : "向正面の2角寄り",
        `3角まで約${Math.round(run.turnFrom)}m`,
        "直線266m・平坦",
      ],
      labels: cornerLabels(meters, run.corner3, run.corner4, run.straightFrom, pocket ? [{ m: run.pocketJoin, text: "本線", out: 58 }] : []),
    },
    run,
    "short",
    (horses) => ({
      phases: buildRoundFlatPhases(horses, {
        pocket,
        corner3: run.corner3,
        corner4: run.corner4,
        straightFrom: run.straightFrom,
        meters,
      }),
      script: buildRoundFlatScript(horses),
    }),
  );
}

function buildHakodate(meters: 1000 | 1200): Built {
  const run = meters === 1000 ? hakodateTurf1000Run() : hakodateTurf1200Run();
  const pocket = meters === 1200;
  return pack(
    {
      id: meters === 1000 ? "hakodate-turf-1000" : "hakodate-turf-1200",
      raceMeters: meters,
      titleText: `函館芝${meters}`,
      subtitle: pocket ? "ポケット・右回り" : "右回り",
      noteText: pocket ? "2角奥のポケット" : "1〜2角はこの距離では通らない",
      aria: pocket
        ? "函館芝1200の想定走行。右回りを、2角奥のポケットから坂のあるコーナーまで進む"
        : "函館芝1000の想定走行。右回りの向正面から、坂のあるコーナーまで進む",
      facts: ["右回り", pocket ? "2角奥のポケット" : "向正面の2角寄り", "坂は3〜4角", "直線262m・下りから平坦"],
      labels: cornerLabels(meters, run.corner3, run.corner4, run.straightFrom, [
        ...(pocket ? [{ m: run.pocketJoin, text: "本線", out: 58 }] : []),
        { m: (run.hillFrom + run.hillTo) / 2, text: "坂", out: 58 },
      ]),
    },
    run,
    "short",
    (horses) => ({
      phases: buildCornerHillPhases(horses, {
        course: "hakodate",
        pocket,
        corner3: run.corner3,
        corner4: run.corner4,
        straightFrom: run.straightFrom,
        meters,
      }),
      script: buildCornerHillScript(horses),
    }),
  );
}

function buildFukushima(meters: 1000 | 1200): Built {
  const run = meters === 1000 ? fukushimaTurf1000Run() : fukushimaTurf1200Run();
  const pocket = meters === 1200;
  return pack(
    {
      id: meters === 1000 ? "fukushima-turf-1000" : "fukushima-turf-1200",
      raceMeters: meters,
      titleText: `福島芝${meters}`,
      subtitle: pocket ? "ポケット・右回り" : "右回り",
      noteText: pocket ? "2角奥のポケット" : "1〜2角はこの距離では通らない",
      aria: pocket
        ? "福島芝1200の想定走行。右回りを、2角奥のポケットから直線の上りまで進む"
        : "福島芝1000の想定走行。右回りの向正面の上りから、直線の上りまで進む",
      facts: ["右回り", pocket ? "2角奥のポケット" : "向正面から上り", `3角まで約${Math.round(run.turnFrom)}m`, "直線292m・残り170mから上り"],
      labels: cornerLabels(meters, run.corner3, run.corner4, run.straightFrom, [
        ...(pocket ? [{ m: run.pocketJoin, text: "本線", out: 58 }] : []),
        { m: (run.homeFrom + run.homeTo) / 2, text: "上り", out: 58 },
      ]),
    },
    run,
    "short",
    (horses) => ({
      phases: buildHomeUphillPhases(horses, {
        pocket,
        corner3: run.corner3,
        corner4: run.corner4,
        straightFrom: run.straightFrom,
        meters,
      }),
      script: buildHomeUphillScript(horses),
    }),
  );
}

function buildKokura(meters: 1000 | 1200): Built {
  const run = meters === 1000 ? kokuraTurf1000Run() : kokuraTurf1200Run();
  const downhill = meters === 1200;
  return pack(
    {
      id: meters === 1000 ? "kokura-turf-1000" : "kokura-turf-1200",
      raceMeters: meters,
      titleText: `小倉芝${meters}`,
      subtitle: downhill ? "ポケット・右回り" : "右回り",
      noteText: downhill ? "丘の上のポケット" : "1〜2角はこの距離では通らない",
      aria: downhill
        ? "小倉芝1200の想定走行。右回りを、丘の上のポケットから平坦な直線まで進む"
        : "小倉芝1000の想定走行。右回りの向正面から、平坦な直線まで進む",
      facts: ["右回り", downhill ? "丘の上から下る" : "向正面の2角寄り", `3角まで約${Math.round(run.turnFrom)}m`, "直線293m・坂はない"],
      labels: cornerLabels(
        meters,
        run.corner3,
        run.corner4,
        run.straightFrom,
        downhill ? [{ m: run.pocketJoin, text: "本線", out: 58 }, { m: (run.hillFrom + run.hillTo) / 2, text: "丘", out: 58 }] : [],
      ),
    },
    run,
    "short",
    (horses) => ({
      phases: buildTightFlatPhases(horses, {
        downhill,
        corner3: run.corner3,
        corner4: run.corner4,
        straightFrom: run.straightFrom,
        meters,
      }),
      script: buildTightFlatScript(horses),
    }),
  );
}

function buildNiigataInner(): Built {
  const run = niigataTurf1200Run();
  return pack(
    {
      id: "niigata-turf-1200",
      raceMeters: 1200,
      titleText: "新潟芝1200",
      subtitle: "内回り・左回り",
      noteText: "1〜2角はこの距離では通らない",
      aria: "新潟芝1200の想定走行。左回りの内回りを、向正面から平坦な直線まで進む",
      facts: ["左回り・内回り", "2角の出口", `3角まで約${Math.round(run.corner3)}m`, "直線359m・平坦"],
      labels: cornerLabels(1200, run.corner3, run.corner4, run.straightFrom),
    },
    run,
    "middle",
    (horses) => ({
      phases: buildInnerFlatPhases(horses, {
        corner3: run.corner3,
        corner4: run.corner4,
        straightFrom: run.straightFrom,
        meters: 1200,
      }),
      script: buildInnerFlatScript(horses),
    }),
  );
}

function buildNiigataOuter(meters: 1600 | 1800): Built {
  const run = meters === 1600 ? niigataTurf1600Run() : niigataTurf1800Run();
  return pack(
    {
      id: meters === 1600 ? "niigata-turf-1600" : "niigata-turf-1800",
      raceMeters: meters,
      titleText: `新潟芝${meters}`,
      subtitle: "外回り・左回り",
      noteText: "1〜2角はこの距離では通らない",
      aria: `新潟芝${meters}の想定走行。左回りの外回りを、向正面から長い直線まで進む`,
      facts: ["左回り・外回り", meters === 1800 ? "2角の出口" : "向正面の2角寄り", `3角まで約${Math.round(run.corner3)}m`, "直線659m・平坦"],
      labels: cornerLabels(meters, run.corner3, run.corner4, run.straightFrom, [{ m: (run.hills[0][0] + run.hills[0][1]) / 2, text: "上り", out: 58 }]),
    },
    run,
    "long",
    (horses) => ({
      phases: buildLongStraightPhases(horses, {
        place: "niigata",
        opening: "long",
        corner3: run.corner3,
        corner4: run.corner4,
        straightFrom: run.straightFrom,
        meters,
      }),
      script: buildLongStraightScript(horses),
    }),
  );
}

function buildChukyo(meters: 1200 | 1300 | 1400): Built {
  const run = meters === 1200 ? chukyoTurf1200Run() : meters === 1300 ? chukyoTurf1300Run() : chukyoTurf1400Run();
  const id = meters === 1200 ? "chukyo-turf-1200" : meters === 1300 ? "chukyo-turf-1300" : "chukyo-turf-1400";
  return pack(
    {
      id,
      raceMeters: meters,
      titleText: `中京芝${meters}`,
      subtitle: "左回り",
      noteText: "1〜2角はこの距離では通らない",
      aria: `中京芝${meters}の想定走行。左回りの向正面から、直線入口の急坂まで進む`,
      facts: ["左回り", run.opening === "rise" ? "向正面の前半は上り" : "2角の出口", `3角まで約${Math.round(run.turnFrom)}m`, "直線413m・入口に急坂"],
      labels: cornerLabels(meters, run.corner3, run.corner4, run.straightFrom, [{ m: (run.homeFrom + run.homeTo) / 2, text: "急坂", out: 58 }]),
    },
    run,
    "long",
    (horses) => ({
      phases: buildStraightHillPhases(horses, {
        opening: run.opening,
        corner3: run.corner3,
        corner4: run.corner4,
        straightFrom: run.straightFrom,
        meters,
      }),
      script: buildStraightHillScript(horses),
    }),
  );
}

function buildLongChute(place: "kyoto" | "chukyo"): Built {
  if (place === "kyoto") {
    const run = kyotoTurf1800Run();
    return pack(
      {
        id: "kyoto-turf-1800",
        raceMeters: 1800,
        titleText: "京都芝1800",
        subtitle: "外回り・右回り",
        noteText: "140m地点はまだ引き込み",
        aria: "京都芝1800の想定走行。右回りの外回りを、引き込みの端から平坦な直線まで進む",
        facts: ["右回り・外回り", "引き込みのいちばん奥", "140m地点はまだ引き込み", "直線404m・平坦"],
        labels: cornerLabels(1800, run.corner3, run.corner4, run.straightFrom, [
          { m: run.join, text: "本線", out: 58 },
          { m: (run.hillFrom + run.hillTo) / 2, text: "坂", out: 58 },
        ]),
      },
      { run: run.run, idle: run.idle, approach: run.approach, hills: [[run.hillFrom, run.hillTo]] },
      "middle",
      (horses) => ({
        phases: buildLongChutePhases(horses, {
          place,
          joinM: run.join,
          corner3: run.corner3,
          corner4: run.corner4,
          straightFrom: run.straightFrom,
          meters: 1800,
        }),
        script: buildLongChuteScript(horses),
      }),
    );
  }
  const run = chukyoTurf1600Run();
  return pack(
    {
      id: "chukyo-turf-1600",
      raceMeters: 1600,
      titleText: "中京芝1600",
      subtitle: "引き込み・左回り",
      noteText: "140m地点はまだ引き込み",
      aria: "中京芝1600の想定走行。左回りの引き込みから、直線入口の急坂まで進む",
      facts: ["左回り", "1〜2角の引き込み", "140m地点はまだ引き込み", "直線413m・入口に急坂"],
      labels: cornerLabels(1600, run.corner3, run.corner4, run.straightFrom, [
        { m: run.join, text: "本線", out: 58 },
        { m: (run.homeFrom + run.homeTo) / 2, text: "急坂", out: 58 },
      ]),
    },
    { run: run.run, idle: run.idle, approach: run.approach, hills: run.hills },
    "middle",
    (horses) => ({
      phases: buildLongChutePhases(horses, {
        place,
        joinM: run.join,
        corner3: run.corner3,
        corner4: run.corner4,
        straightFrom: run.straightFrom,
        meters: 1600,
      }),
      script: buildLongChuteScript(horses),
    }),
  );
}

function buildHanshinOuter(meters: 1600 | 1800): Built {
  const run = meters === 1600 ? hanshinTurf1600Run() : hanshinTurf1800Run();
  const backM = run.backFrom > 80 ? run.backFrom : 140;
  return pack(
    {
      id: meters === 1600 ? "hanshin-turf-1600" : "hanshin-turf-1800",
      raceMeters: meters,
      titleText: `阪神芝${meters}`,
      subtitle: "外回り・右回り",
      noteText: meters === 1600 ? "1〜2角はこの距離では通らない" : "1角はこの距離では通らない",
      aria:
        meters === 1600
          ? "阪神芝1600の想定走行。右回りの外回りを、向正面の入口から直線の急坂まで進む"
          : "阪神芝1800の想定走行。右回りの外回りを、向正面から直線の急坂まで進む",
      facts: [
        "右回り・外回り",
        meters === 1600 ? "向正面の入口" : "向正面。1600の200m手前",
        `3角まで約${Math.round(run.corner3)}m`,
        "直線474m。ゴール前に急坂",
      ],
      labels: cornerLabels(meters, run.corner3, run.corner4, run.straightFrom, [
        { m: (run.hillFrom + run.hillTo) / 2, text: "急坂", out: 58 },
      ]),
    },
    { run: run.run, idle: run.idle, hills: [[run.hillFrom, run.hillTo]] },
    "finishHill",
    (horses) => ({
      phases: buildFinishHillPhases(horses, {
        place: meters === 1600 ? "1600" : "1800",
        backM,
        corner3: run.corner3,
        corner4: run.corner4,
        straightFrom: run.straightFrom,
        meters,
      }),
      script: buildFinishHillScript(horses),
    }),
  );
}

const COURSES: Record<TurfCourseId, Built> = {
  "nakayama-turf-1600": buildNakayama1600(),
  "nakayama-turf-1800": buildNakayama1800(),
  "kyoto-turf-1200": buildKyoto(),
  "kyoto-turf-1800": buildLongChute("kyoto"),
  "kyoto-turf-2400": buildKyoto2400(),
  "hanshin-turf-1200": buildHanshin(),
  "hanshin-turf-1600": buildHanshinOuter(1600),
  "hanshin-turf-1800": buildHanshinOuter(1800),
  "tokyo-turf-1400": buildTokyo(1400),
  "tokyo-turf-1600": buildTokyo(1600),
  "tokyo-turf-1800": buildTokyoPocket(1800),
  "tokyo-turf-2000": buildTokyoPocket(2000),
  "sapporo-turf-1000": buildSapporo(1000),
  "sapporo-turf-1200": buildSapporo(1200),
  "hakodate-turf-1000": buildHakodate(1000),
  "hakodate-turf-1200": buildHakodate(1200),
  "fukushima-turf-1000": buildFukushima(1000),
  "fukushima-turf-1200": buildFukushima(1200),
  "niigata-turf-1200": buildNiigataInner(),
  "niigata-turf-1600": buildNiigataOuter(1600),
  "niigata-turf-1800": buildNiigataOuter(1800),
  "chukyo-turf-1200": buildChukyo(1200),
  "chukyo-turf-1300": buildChukyo(1300),
  "chukyo-turf-1400": buildChukyo(1400),
  "chukyo-turf-1600": buildLongChute("chukyo"),
  "kokura-turf-1000": buildKokura(1000),
  "kokura-turf-1200": buildKokura(1200),
};

export function turfCourseView(id: TurfCourseId) {
  return COURSES[id];
}

export function isPlayedTurfCourse(id: string): id is TurfCourseId {
  return Object.prototype.hasOwnProperty.call(COURSES, id);
}
