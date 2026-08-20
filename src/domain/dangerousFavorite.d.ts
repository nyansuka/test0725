export const DANGEROUS_FAV_REASONS: readonly [
  "factor_win_below_median",
  "closer_on_front_course",
];

export const DANGEROUS_FAV_REASON_LABELS: Record<
  "factor_win_below_median" | "closer_on_front_course",
  string
>;

export function isFrontBiasedCourse(
  venue: string | null | undefined,
  track: string | null | undefined,
  distance?: string | null,
): boolean;

export function isCloserStyle(runningStyle: string | null | undefined): boolean;

export function lowerMedian(values: number[]): number;

export function dangerousFavReasonLabels(
  reasons: Array<"factor_win_below_median" | "closer_on_front_course"> | null | undefined,
): string[];

export function assessDangerousFirstFavorite(input: {
  raceId: string;
  venue: string;
  track: string;
  distance?: string;
  horses: Array<{ number: number; runningStyle?: string | null }>;
  popularity: Map<number, number> | Record<number, number>;
  factorWins: Map<number, number> | Record<number, number>;
}): {
  raceId: string;
  horseNumber: number;
  flagged: boolean;
  reasons: Array<"factor_win_below_median" | "closer_on_front_course">;
  popularity: 1;
  factorWin: number;
  factorWinMedian: number;
  runningStyle: string | null;
} | null;
