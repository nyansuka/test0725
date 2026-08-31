export const GATE_OVERLAY_MAX: 4;

export function parseDistanceMeters(distance: string | null | undefined): number | null;
export function normalizeVenue(venue: string | null | undefined): string;

export type CourseGateMode = "none" | "inner" | "outer" | "mid_outer" | "flatten";

export type CourseProfile = {
  venue: string;
  track: "芝" | "ダート";
  meters: number | null;
  summary: string;
  bullets: string[];
  gate: { mode: CourseGateMode; boost?: number };
  frontBias: boolean;
  scoreInGate: boolean;
};

export function courseProfile(
  venue: string | null | undefined,
  track: string | null | undefined,
  distance?: string | null,
): CourseProfile | null;

export function courseNoteLines(
  venue: string | null | undefined,
  track: string | null | undefined,
  distance?: string | null,
): string[];

export function gateOverlayDelta(
  track: string | null | undefined,
  bracket: number | null | undefined,
  venue?: string | null,
  distance?: string | null,
): number;

export function isFrontBiasedCourse(
  venue: string | null | undefined,
  track: string | null | undefined,
  distance?: string | null,
): boolean;
