import type { Horse, OddsEntry, Race } from "@/domain/types";
import { getJstDateString, shiftJstDate } from "@/domain/date";

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
  京都: [
    "3歳未勝利",
    "3歳未勝利",
    "3歳以上1勝クラス",
    "3歳以上1勝クラス",
    "2歳新馬",
    "3歳以上2勝クラス",
    "3歳以上2勝クラス",
    "木津川特別",
    "朱雀ステークス",
    "貴船ステークス",
    "清水ステークス",
    "鴨川ステークス",
  ],
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
    { betType: "place", selection: String(long1.number), odds: Math.max(21, Number((long1.oddsWin * 0.55).toFixed(1))) },
    {
      betType: "quinella",
      selection: `${favorite.number}-${long1.number}`,
      odds: Number((favorite.oddsWin * long1.oddsWin * 0.45).toFixed(1)),
    },
    {
      betType: "wide",
      selection: `${favorite.number}-${long1.number}`,
      odds: Number((Math.max(8, favorite.oddsWin * long1.oddsWin * 0.12)).toFixed(1)),
    },
  ];

  // 複勝の高配当サンプル（閾値20以上）を必ず含める
  board.push({
    betType: "place",
    selection: String(long2.number),
    odds: 24.5,
  });

  if (rich) {
    board.push(
      {
        betType: "quinella",
        selection: `${long1.number}-${long2.number}`,
        odds: Number((long1.oddsWin * long2.oddsWin * 0.35).toFixed(1)),
      },
      {
        betType: "wide",
        selection: `${mid.number}-${long1.number}`,
        odds: 22.8,
      },
      {
        betType: "exacta",
        selection: `${favorite.number}-${long1.number}`,
        odds: Number((favorite.oddsWin * long1.oddsWin * 0.85).toFixed(1)),
      },
      {
        betType: "exacta",
        selection: `${long1.number}-${favorite.number}`,
        odds: Number((long1.oddsWin * favorite.oddsWin * 1.2).toFixed(1)),
      },
      {
        betType: "trio",
        selection: `${favorite.number}-${mid.number}-${long1.number}`,
        odds: 96.0,
      },
      {
        betType: "trifecta",
        selection: `${favorite.number}-${mid.number}-${long1.number}`,
        odds: 520.0,
      },
      {
        betType: "bracket_quinella",
        selection: `${favorite.bracket}-${long1.bracket}`,
        odds: 26.0,
      },
    );
  }

  return board.map((e) => ({
    ...e,
    odds: Math.max(1.1, Number(e.odds.toFixed(1))),
  }));
}

type VenueConfig = {
  venue: string;
  weather: string;
  condition: string;
  trackPattern: ("芝" | "ダート")[];
  distances: string[];
};

const VENUES: VenueConfig[] = [
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
  {
    venue: "京都",
    weather: "晴",
    condition: "良",
    trackPattern: ["ダート", "ダート", "芝", "芝", "芝", "ダート", "芝", "ダート", "ダート", "芝", "芝", "芝"],
    distances: [
      "ダート1200m",
      "ダート1800m",
      "芝1400m",
      "芝1800m",
      "芝1200m",
      "ダート1400m",
      "芝2000m",
      "ダート1400m",
      "ダート1400m",
      "芝1600m",
      "芝1800m",
      "芝2200m",
    ],
  },
];

/** 特に厚いオッズ板・馬データにするレース番号（1-indexed） */
const FEATURED_RACE_NUMBERS: Record<string, number> = {
  東京: 11,
  阪神: 10,
  京都: 9,
};

function buildVenueRaces(config: VenueConfig, raceDate: string): Race[] {
  const titles = RACE_TITLES[config.venue];
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
      title: titles[idx],
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

function slug(venue: string) {
  const map: Record<string, string> = { 東京: "tokyo", 阪神: "hanshin", 京都: "kyoto" };
  return map[venue] ?? venue;
}

/** サンプル開催日: カレンダー当日（JST）と1週間前 */
export const sampleToday = getJstDateString();
export const samplePrevWeek = shiftJstDate(sampleToday, -7);

function buildMeeting(raceDate: string, venueConfigs: VenueConfig[]): Race[] {
  return venueConfigs.flatMap((config) => buildVenueRaces(config, raceDate));
}

export const races: Race[] = [
  ...buildMeeting(sampleToday, VENUES),
  // 日付切替のデモ用（東京・阪神のみ）
  ...buildMeeting(samplePrevWeek, VENUES.filter((v) => v.venue !== "京都")),
];

export const venues = VENUES.map((v) => v.venue);

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
  const order = venues;
  const present = order.filter((venue) => list.some((r) => r.venue === venue));
  return present.map((venue) => ({
    venue,
    races: list.filter((r) => r.venue === venue).sort((a, b) => a.raceNumber - b.raceNumber),
  }));
}
