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

/** 軸馬候補（winPotential Top3） */
export function AxisMark({
  rank,
  className = "",
}: {
  rank?: 1 | 2 | 3;
  className?: string;
}) {
  const title = rank != null ? `軸馬候補（${rank}位）` : "軸馬候補";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-sm bg-turf/15 px-1 py-0.5 font-[family-name:var(--font-display)] text-[10px] font-bold leading-none tracking-wide text-turf ${className}`}
      title={title}
      aria-label={title}
    >
      軸{rank != null ? rank : ""}
    </span>
  );
}

/** 中穴の条件付き昇格 */
export function MidPromotedMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-sm bg-ink/10 px-1 py-0.5 font-[family-name:var(--font-display)] text-[10px] font-bold leading-none tracking-wide text-ink/70 ${className}`}
      title="中穴の条件付き昇格（6〜10人気）"
      aria-label="中穴昇格"
    >
      中穴
    </span>
  );
}

/** 超注目馬（注目穴 ∩ 軸 Top3） */
export function SuperWatchMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-sm bg-signal/20 px-1 py-0.5 font-[family-name:var(--font-display)] text-[10px] font-bold leading-none tracking-wide text-signal ${className}`}
      title="超注目馬（穴かつ軸）"
      aria-label="超注目馬"
    >
      超注目
    </span>
  );
}

/** 根拠付きで1番人気を切る候補（軸からは除外しない） */
export function DangerousFavMark({
  reasons,
  className = "",
}: {
  reasons?: string[];
  className?: string;
}) {
  const title = reasons?.length
    ? `危険1人気（${reasons.join("・")}）`
    : "危険1人気";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-sm bg-ink/15 px-1 py-0.5 font-[family-name:var(--font-display)] text-[10px] font-bold leading-none tracking-wide text-ink/80 ${className}`}
      title={title}
      aria-label={title}
    >
      危1
    </span>
  );
}
