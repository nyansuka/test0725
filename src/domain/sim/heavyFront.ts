import { courseNoteLines } from "@/domain/courseNotes.mjs";

/**
 * コースメモが「道悪」と「前」を同じ行に書いている距離だけ。
 * 芝のワンターンには、今のメモでは無い。全距離には広げない。
 */
export function heavyGoingKeepsFront(venue: string, track: string, distance: string) {
  return courseNoteLines(venue, track, distance).some((line) => line.includes("道悪") && line.includes("前"));
}

export function isHeavyGoing(condition: string) {
  return condition === "稍重" || condition === "重" || condition === "不良";
}
