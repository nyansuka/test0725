import type { BetType, LongshotLabel } from "./types";

export type TrendBucket = {
  candidates: number;
  hits: number;
  /** 券種払戻ヒット件数（無い旧データは 0 扱い） */
  ticketHits?: number;
  pending: number;
  settled: number;
  /** 複勝圏（互換・参考） */
  precision: number | null;
  placePrecision?: number | null;
  /** 主指標: 券種払戻 */
  ticketPrecision?: number | null;
};

export type TrendDaySlice = {
  overall: TrendBucket;
  byBetType: Partial<Record<BetType | string, TrendBucket>>;
  byVenue: Record<string, TrendBucket>;
  byTrack: Record<string, TrendBucket>;
  byLabel: Partial<Record<LongshotLabel | string, TrendBucket>>;
  byOddsBand: Record<string, TrendBucket>;
  byVenueTrack: Record<string, TrendBucket>;
};

export type TrendIndex = {
  builtAt: string;
  source: string;
  primaryMetric?: "ticketPrecision" | "placePrecision";
  dayCount: number;
  dates: string[];
  minSamples: number;
  overall: TrendBucket;
  byDay?: Record<string, TrendBucket>;
  byBetType: Partial<Record<BetType, TrendBucket>>;
  byVenue: Record<string, TrendBucket>;
  byTrack: Record<string, TrendBucket>;
  byLabel: Partial<Record<LongshotLabel | string, TrendBucket>>;
  byOddsBand: Record<string, TrendBucket>;
  byVenueTrack: Record<string, TrendBucket>;
  /** 日別内訳。短評では表示日を除外して合算する */
  daySlices?: Record<string, TrendDaySlice>;
  note?: string;
};

export const EMPTY_TRENDS: TrendIndex = {
  builtAt: "",
  source: "",
  primaryMetric: "ticketPrecision",
  dayCount: 0,
  dates: [],
  minSamples: 20,
  overall: {
    candidates: 0,
    hits: 0,
    ticketHits: 0,
    pending: 0,
    settled: 0,
    precision: null,
    placePrecision: null,
    ticketPrecision: null,
  },
  byBetType: {},
  byVenue: {},
  byTrack: {},
  byLabel: {},
  byOddsBand: {},
  byVenueTrack: {},
  daySlices: {},
};

function emptyRaw() {
  return { candidates: 0, hits: 0, ticketHits: 0, pending: 0 };
}

function addBucket(
  acc: { candidates: number; hits: number; ticketHits: number; pending: number },
  b: TrendBucket | undefined,
) {
  if (!b) return;
  acc.candidates += b.candidates;
  acc.hits += b.hits;
  acc.ticketHits += b.ticketHits ?? 0;
  acc.pending += b.pending;
}

function finalizeBucket(acc: {
  candidates: number;
  hits: number;
  ticketHits: number;
  pending: number;
}): TrendBucket {
  const settled = acc.candidates - acc.pending;
  return {
    ...acc,
    settled,
    precision: settled > 0 ? acc.hits / settled : null,
    placePrecision: settled > 0 ? acc.hits / settled : null,
    ticketPrecision: settled > 0 ? acc.ticketHits / settled : null,
  };
}

/** excludeDate 以外の daySlices を合算したビュー */
export function trendsExcludingDate(
  trends: TrendIndex,
  excludeDate?: string,
): {
  dayCount: number;
  dates: string[];
  minSamples: number;
  overall: TrendBucket;
  byBetType: Record<string, TrendBucket>;
  byVenue: Record<string, TrendBucket>;
  byTrack: Record<string, TrendBucket>;
  byLabel: Record<string, TrendBucket>;
  byOddsBand: Record<string, TrendBucket>;
  byVenueTrack: Record<string, TrendBucket>;
} | null {
  const slices = trends.daySlices ?? {};
  const dates = (trends.dates ?? []).filter((d) => d !== excludeDate && slices[d]);
  if (dates.length === 0) return null;

  const overall = emptyRaw();
  const maps = {
    byBetType: {} as Record<string, ReturnType<typeof emptyRaw>>,
    byVenue: {} as Record<string, ReturnType<typeof emptyRaw>>,
    byTrack: {} as Record<string, ReturnType<typeof emptyRaw>>,
    byLabel: {} as Record<string, ReturnType<typeof emptyRaw>>,
    byOddsBand: {} as Record<string, ReturnType<typeof emptyRaw>>,
    byVenueTrack: {} as Record<string, ReturnType<typeof emptyRaw>>,
  };

  for (const d of dates) {
    const slice = slices[d];
    addBucket(overall, slice.overall);
    for (const [key, map] of [
      ["byBetType", slice.byBetType],
      ["byVenue", slice.byVenue],
      ["byTrack", slice.byTrack],
      ["byLabel", slice.byLabel],
      ["byOddsBand", slice.byOddsBand],
      ["byVenueTrack", slice.byVenueTrack],
    ] as const) {
      for (const [k, b] of Object.entries(map ?? {})) {
        if (!maps[key][k]) maps[key][k] = emptyRaw();
        addBucket(maps[key][k], b);
      }
    }
  }

  const fin = (m: Record<string, ReturnType<typeof emptyRaw>>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, finalizeBucket(v)]));

  return {
    dayCount: dates.length,
    dates,
    minSamples: trends.minSamples ?? 20,
    overall: finalizeBucket(overall),
    byBetType: fin(maps.byBetType),
    byVenue: fin(maps.byVenue),
    byTrack: fin(maps.byTrack),
    byLabel: fin(maps.byLabel),
    byOddsBand: fin(maps.byOddsBand),
    byVenueTrack: fin(maps.byVenueTrack),
  };
}

export type CompletedDayLabelStat = {
  date: string;
  candidates: number;
  hits: number;
  pending: number;
  settled: number;
  precision: number | null;
};

/** 結果が揃った日（pending=0）のラベル別候補的中を集計 */
export function completedDayLabelStats(
  trends: TrendIndex,
  label: LongshotLabel | string = "注目穴",
): {
  days: CompletedDayLabelStat[];
  overall: TrendBucket;
} {
  const days: CompletedDayLabelStat[] = [];
  const acc = emptyRaw();

  for (const date of trends.dates ?? []) {
    const slice = trends.daySlices?.[date] ?? null;
    const dayOverall = slice?.overall ?? trends.byDay?.[date];
    if (!dayOverall || dayOverall.pending > 0) continue;

    const bucket = slice?.byLabel?.[label];
    if (!bucket || bucket.settled <= 0) continue;

    days.push({
      date,
      candidates: bucket.candidates,
      hits: bucket.hits,
      pending: bucket.pending,
      settled: bucket.settled,
      precision: bucket.precision,
    });
    addBucket(acc, bucket);
  }

  days.sort((a, b) => b.date.localeCompare(a.date));
  return { days, overall: finalizeBucket(acc) };
}

export function formatPrecisionPercent(precision: number | null | undefined): string {
  if (precision == null || !Number.isFinite(precision)) return "—";
  return `${(Math.round(precision * 1000) / 10).toFixed(1)}%`;
}
