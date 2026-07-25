import type { LongshotPick } from "@/domain/types";

/** 注目穴ラベルの関係馬に付ける印 */
export const LONGSHOT_MARK = "♪";

/** レース内で「注目穴」候補に含まれる馬番の集合 */
export function longshotHorseNumbers(
  picks: LongshotPick[],
  raceId?: string,
): Set<number> {
  const set = new Set<number>();
  for (const pick of picks) {
    if (pick.label !== "注目穴") continue;
    if (raceId && pick.raceId !== raceId) continue;
    for (const n of pick.relatedHorseNumbers) set.add(n);
  }
  return set;
}

export function LongshotMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block text-signal ${className}`}
      title="注目穴"
      aria-label="注目穴"
    >
      {LONGSHOT_MARK}
    </span>
  );
}
