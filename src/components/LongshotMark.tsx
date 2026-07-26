import type { LongshotPick } from "@/domain/types";
import Image from "next/image";

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

/** 注目穴ラベルの関係馬に付ける蹄鉄印 */
export function LongshotMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-[1.15em] w-[1.15em] shrink-0 items-center justify-center align-[-0.15em] ${className}`}
      title="注目穴"
      aria-label="注目穴"
    >
      <Image
        src="/brand/horseshoe.png"
        alt=""
        width={36}
        height={36}
        className="h-full w-full object-contain"
        aria-hidden
      />
    </span>
  );
}
