export type DangerousFavReason =
  | "factor_win_below_median"
  | "closer_on_front_course"
  | "layoff_over_6_months";

export const DANGEROUS_FAV_REASONS: readonly [
  "factor_win_below_median",
  "closer_on_front_course",
  "layoff_over_6_months",
];

export const DANGEROUS_FAV_REASON_LABELS: Record<DangerousFavReason, string>;

export const LAYOFF_DAYS_MIN: 180;

export function isFrontBiasedCourse(
  venue: string | null | undefined,
  track: string | null | undefined,
  distance?: string | null,
): boolean;

export function isCloserStyle(runningStyle: string | null | undefined): boolean;

export function lowerMedian(values: number[]): number;

export function dangerousFavReasonLabels(
  reasons: Array<DangerousFavReason> | null | undefined,
): string[];

export function calendarDaysBetween(
  fromIso: string | null | undefined,
  toIso: string | null | undefined,
): number | null;

export function isLongLayoff(
  lastDate: string | null | undefined,
  raceDate: string | null | undefined,
  minDays?: number,
): boolean;

export function assessDangerousFirstFavorite(input: {
  raceId: string;
  raceDate?: string;
  venue: string;
  track: string;
  distance?: string;
  horses: Array<{
    number: number;
    runningStyle?: string | null;
    formStats?: { lastDate?: string | null };
  }>;
  popularity: Map<number, number> | Record<number, number>;
  factorWins: Map<number, number> | Record<number, number>;
}): {
  raceId: string;
  horseNumber: number;
  flagged: boolean;
  reasons: DangerousFavReason[];
  popularity: 1;
  factorWin: number;
  factorWinMedian: number;
  runningStyle: string | null;
  layoffDays: number | null;
} | null;
