import type { Horse, OddsEntry, Race } from "@/domain/types";
import { getJstDateString, shiftJstDate } from "@/domain/date";
import latestSnapshot from "@/data/snapshots/latest.json";

type SnapshotHorse = {
  number: number;
  bracket?: number;
  name: string;
  jockey: string;
  oddsWin: number;
  oddsPlace?: { min: number; max: number };
  runningStyle?: Horse["runningStyle"];
  factors: Horse["factors"];
  comment: string;
};

type SnapshotRace = {
  id: string;
  sourceRaceId?: string;
  authority: "JRA";
  raceDate: string;
  venue: string;
  raceNumber: number;
  title: string;
  distance: string;
  track: "芝" | "ダート";
  startTime: string;
  weather: string;
  condition: string;
  featured?: boolean;
  fieldSize?: number;
  horses: SnapshotHorse[];
  oddsBoard: OddsEntry[];
  result?: Race["result"];
};

type SnapshotFile = {
  fetchedAt: string;
  source: string;
  raceDate: string;
  raceCount: number;
  venues: string[];
  races: SnapshotRace[];
};

const VENUE_ORDER = [
  "札幌",
  "函館",
  "福島",
  "新潟",
  "東京",
  "中山",
  "中京",
  "京都",
  "阪神",
  "小倉",
];

function horse(
  partial: Omit<Horse, "factors"> & { factors?: Horse["factors"] },
): Horse {
  const {
    factors = {
      courseFit: 60,
      paceFit: 60,
      conditionFit: 60,
      formSignal: 60,
      valueGap: 60,
      gateJockey: 55,
    },
    ...rest
  } = partial;
  return { ...rest, factors };
}

const JOCKEYS = [
  "川田将雅",
  "ルメール",
  "横山武史",
  "松山弘平",
  "戸崎圭太",
  "武豊",
  "坂井瑠星",
  "岩田康誠",
];

const NAMES = [
  "アンバーライト",
  "コバルトスカイ",
  "シルバーエコー",
  "ゴールドリーフ",
  "クリムゾンロード",
  "サファイアノート",
  "エメラルドパス",
  "アイボリーゲイル",
];

const START_TIMES = [
  "09:55",
  "10:25",
  "10:55",
  "11:25",
  "12:15",
  "12:45",
  "13:15",
  "13:45",
  "14:15",
  "14:45",
  "15:25",
  "16:05",
];

const RACE_TITLES: Record<string, string[]> = {
  東京: [
    "3歳未勝利",
    "3歳未勝利",
    "3歳以上1勝クラス",
    "3歳以上1勝クラス",
    "2歳新馬",
    "3歳以上2勝クラス",
    "3歳以上2勝クラス",
    "立川特別",
    "多摩川ステークス",
    "夏至ステークス",
    "府中ステークス",
    "晩夏ステークス",
  ],
  阪神: [
    "3歳未勝利",
    "3歳未勝利",
    "3歳以上1勝クラス",
    "3歳以上1勝クラス",
    "2歳新馬",
    "3歳以上2勝クラス",
    "3歳以上2勝クラス",
    "甲南特別",
    "御影ステークス",
    "六甲特別",
    "兵庫ステークス",
    "尼崎ステークス",
  ],
};

type VenueConfig = {
  venue: string;
  weather: string;
  condition: string;
  trackPattern: Array<"芝" | "ダート">;
  distances: string[];
};

/** 日付切替デモ用の合成開催（スナップショット以外の日） */
const DEMO_VENUES: VenueConfig[] = [
  {
    venue: "東京",
    weather: "晴",
    condition: "良",
    trackPattern: ["ダート", "ダート", "芝", "芝", "芝", "ダート", "芝", "芝", "芝", "芝", "芝", "芝"],
    distances: [
      "ダート1400m",
      "ダート1600m",
      "芝1800m",
      "芝1400m",
      "芝1600m",
      "ダート2100m",
      "芝2400m",
      "芝1600m",
      "芝1800m",
      "芝1400m",
      "芝1600m",
      "芝2000m",
    ],
  },
  {
    venue: "阪神",
    weather: "曇",
    condition: "稍重",
    trackPattern: ["ダート", "ダート", "芝", "芝", "芝", "ダート", "芝", "芝", "芝", "芝", "ダート", "芝"],
    distances: [
      "ダート1200m",
      "ダート1800m",
      "芝1600m",
      "芝1200m",
      "芝1400m",
      "ダート1400m",
      "芝2200m",
      "芝1400m",
      "芝1600m",
      "芝2000m",
      "ダート1800m",
      "芝1600m",
    ],
  },
];

const FEATURED_RACE_NUMBERS: Record<string, number> = {
  東京: 11,
  阪神: 10,
};

function makeHorses(seed: number, count: number): Horse[] {
  const list: Horse[] = [];
  for (let i = 0; i < count; i++) {
    const number = i + 1;
    const bracket = Math.ceil(number / 2);
    const base = 48 + ((seed * 7 + i * 11) % 40);
    const oddsWin = Number((2.4 + ((seed + i * 3) % 40) * 1.1).toFixed(1));
    const placeMin = Math.max(1.1, Number((oddsWin * 0.28).toFixed(1)));
    const placeMax = Math.max(placeMin + 0.2, Number((oddsWin * 0.55).toFixed(1)));
    list.push(
      horse({
        number,
        bracket: Math.min(bracket, 8),
        name: `${NAMES[(seed + i) % NAMES.length]}${number}`,
        jockey: JOCKEYS[(seed + i) % JOCKEYS.length],
        oddsWin,
        oddsPlace: { min: placeMin, max: placeMax },
        runningStyle: (["逃", "先", "差", "追"] as const)[i % 4],
        factors: {
          courseFit: Math.min(92, base + (i % 5) * 3),
          paceFit: Math.min(90, base - 2 + (i % 4) * 4),
          conditionFit: Math.min(90, base + (seed % 6)),
          formSignal: Math.min(90, base + 4 - (i % 3)),
          valueGap: Math.min(95, 40 + Math.floor(oddsWin) + (i % 5) * 5),
          gateJockey: 50 + (bracket <= 3 ? 12 : 4),
        },
        comment:
          oddsWin >= 15
            ? "人気薄だが複勝圏の余地あり。展開次第で浮上。"
            : "先行有利なら上位固定。人気相応の安定感。",
      }),
    );
  }
  return list;
}

function makeOddsBoard(horses: Horse[], rich: boolean): OddsEntry[] {
  const sorted = [...horses].sort((a, b) => a.oddsWin - b.oddsWin);
  const favorite = sorted[0];
  const long1 = sorted[sorted.length - 1];
  const long2 = sorted[Math.max(0, sorted.length - 2)];
  const mid = sorted[Math.floor(sorted.length / 2)];

  const board: OddsEntry[] = [
    { betType: "win", selection: String(favorite.number), odds: favorite.oddsWin },
    { betType: "win", selection: String(long1.number), odds: Math.max(20, long1.oddsWin) },
    {
      betType: "place",
      selection: String(long1.number),
      odds: Math.max(21, Number((long1.oddsWin * 0.55).toFixed(1))),
    },
    {
      betType: "quinella",
      selection: `${favorite.number}-${long1.number}`,
      odds: rich ? 48.2 : 22.5,
    },
    {
      betType: "wide",
      selection: `${mid.number}-${long1.number}`,
      odds: rich ? 26.8 : 18.4,
    },
    {
      betType: "exacta",
      selection: `${long1.number}-${favorite.number}`,
      odds: rich ? 92.0 : 41.0,
    },
    {
      betType: "bracket_quinella",
      selection: `${favorite.bracket ?? 1}-${long1.bracket ?? 8}`,
      odds: rich ? 35.5 : 19.2,
    },
    {
      betType: "trio",
      selection: `${favorite.number}-${mid.number}-${long1.number}`,
      odds: rich ? 180.0 : 65.0,
    },
    {
      betType: "trifecta",
      selection: `${long2.number}-${long1.number}-${favorite.number}`,
      odds: rich ? 920.0 : 210.0,
    },
  ];

  for (const h of horses) {
    if (!board.some((e) => e.betType === "win" && e.selection === String(h.number))) {
      board.push({ betType: "win", selection: String(h.number), odds: h.oddsWin });
    }
    const place = h.oddsPlace
      ? Number(((h.oddsPlace.min + h.oddsPlace.max) / 2).toFixed(1))
      : Number((h.oddsWin * 0.4).toFixed(1));
    if (!board.some((e) => e.betType === "place" && e.selection === String(h.number))) {
      board.push({ betType: "place", selection: String(h.number), odds: Math.max(1.1, place) });
    }
  }
  return board;
}

function slug(venue: string) {
  const map: Record<string, string> = {
    札幌: "sapporo",
    函館: "hakodate",
    福島: "fukushima",
    新潟: "niigata",
    東京: "tokyo",
    中山: "nakayama",
    中京: "chukyo",
    京都: "kyoto",
    阪神: "hanshin",
    小倉: "kokura",
  };
  return map[venue] ?? venue;
}

function buildVenueRaces(config: VenueConfig, raceDate: string): Race[] {
  const titles = RACE_TITLES[config.venue] ?? Array.from({ length: 12 }, (_, i) => `${i + 1}R`);
  const featuredNum = FEATURED_RACE_NUMBERS[config.venue];
  const dateKey = raceDate.replace(/-/g, "");

  return Array.from({ length: 12 }, (_, idx) => {
    const raceNumber = idx + 1;
    const rich = raceNumber === featuredNum || raceNumber >= 9;
    const horseCount = rich ? 8 : 6;
    const seed = config.venue.charCodeAt(0) * 10 + raceNumber + dateKey.length;
    const horses = makeHorses(seed, horseCount);

    if (raceNumber === featuredNum) {
      const longShot = [...horses].sort((a, b) => b.oddsWin - a.oddsWin)[0];
      longShot.comment = "人気薄でも複勝圏の内容。高配当候補の軸・相手向き。";
      longShot.factors = {
        ...longShot.factors,
        formSignal: Math.max(longShot.factors.formSignal, 72),
        valueGap: Math.max(longShot.factors.valueGap, 85),
      };
    }

    return {
      id: `${slug(config.venue)}-${dateKey}-${raceNumber}`,
      authority: "JRA" as const,
      raceDate,
      venue: config.venue,
      raceNumber,
      title: titles[idx] ?? `${raceNumber}R`,
      distance: config.distances[idx],
      track: config.trackPattern[idx],
      startTime: START_TIMES[idx],
      weather: config.weather,
      condition: config.condition,
      featured: raceNumber === featuredNum,
      fieldSize: horseCount,
      horses,
      oddsBoard: makeOddsBoard(horses, rich),
    };
  });
}

function buildMeeting(raceDate: string, venueConfigs: VenueConfig[]): Race[] {
  return venueConfigs.flatMap((config) => buildVenueRaces(config, raceDate));
}

function fromSnapshot(snap: SnapshotFile): Race[] {
  return snap.races.map((r) => ({
    id: r.id,
    authority: "JRA" as const,
    raceDate: r.raceDate,
    venue: r.venue,
    raceNumber: r.raceNumber,
    title: r.title,
    distance: r.distance,
    track: r.track,
    startTime: r.startTime,
    weather: r.weather,
    condition: r.condition,
    featured: r.featured,
    fieldSize: r.fieldSize ?? r.horses.length,
    sourceRaceId: r.sourceRaceId,
    result: r.result,
    horses: r.horses.map((h) =>
      horse({
        number: h.number,
        bracket: h.bracket,
        name: h.name,
        jockey: h.jockey,
        oddsWin: h.oddsWin,
        oddsPlace: h.oddsPlace,
        runningStyle: h.runningStyle,
        factors: h.factors,
        comment: h.comment,
      }),
    ),
    oddsBoard: r.oddsBoard,
  }));
}

const snapshot = latestSnapshot as SnapshotFile;
export const snapshotMeta = {
  fetchedAt: snapshot.fetchedAt,
  source: snapshot.source,
  raceDate: snapshot.raceDate,
  raceCount: snapshot.raceCount,
};

/** 公開データ反映日（スナップショット） */
export const liveRaceDate = snapshot.raceDate;
/** カレンダー当日（JST） */
export const sampleToday = getJstDateString();
/** 日付切替デモ用 */
export const samplePrevWeek = shiftJstDate(liveRaceDate, -7);

export const races: Race[] = [
  ...fromSnapshot(snapshot),
  // 開催日切替のデモ用（合成データ）
  ...buildMeeting(samplePrevWeek, DEMO_VENUES),
];

export const venues = VENUE_ORDER.filter((v) => races.some((r) => r.venue === v));

export function listRaceDates(list: Race[] = races): string[] {
  return [...new Set(list.map((r) => r.raceDate))].sort((a, b) => b.localeCompare(a));
}

export function filterRacesByDate(list: Race[], raceDate: string): Race[] {
  return list.filter((r) => r.raceDate === raceDate);
}

export function getRace(id: string): Race | undefined {
  return races.find((race) => race.id === id);
}

export function getFeaturedRace(raceDate?: string): Race {
  const pool = raceDate ? filterRacesByDate(races, raceDate) : races;
  return pool.find((race) => race.featured) ?? pool[0] ?? races[0];
}

export function getRacesByVenue(venue: string, raceDate?: string): Race[] {
  return races
    .filter((r) => r.venue === venue && (!raceDate || r.raceDate === raceDate))
    .sort((a, b) => a.raceNumber - b.raceNumber);
}

export function groupRacesByVenue(list: Race[]): { venue: string; races: Race[] }[] {
  const present = VENUE_ORDER.filter((venue) => list.some((r) => r.venue === venue));
  return present.map((venue) => ({
    venue,
    races: list.filter((r) => r.venue === venue).sort((a, b) => a.raceNumber - b.raceNumber),
  }));
}
