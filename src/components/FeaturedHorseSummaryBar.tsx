"use client";

import { useMemo } from "react";
import type { LongshotPick, Race } from "@/domain/types";
import { summarizeFeaturedHorses } from "@/domain/results";

type Props = {
  picks: LongshotPick[];
  races: Race[];
};

export function FeaturedHorseSummaryBar({ picks, races }: Props) {
  const byId = useMemo(() => new Map(races.map((r) => [r.id, r])), [races]);
  const featured = useMemo(
    () => summarizeFeaturedHorses(picks, byId),
    [picks, byId],
  );

  if (picks.length === 0) return null;

  return (
    <section
      aria-label="注目馬の的中サマリー"
      className="border border-turf/30 bg-turf/5 px-4 py-4 md:px-5"
    >
      <p className="text-xs font-medium tracking-wider text-turf">注目馬の的中（複勝圏）</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
          {featured.hitRatePercent == null ? "—" : `${featured.hitRatePercent}%`}
        </p>
        <p className="text-sm text-ink/70">
          的中 {featured.hits} / 確定 {featured.settled}
          {featured.pending > 0 ? ` · 待ち ${featured.pending}` : ""}
          {" · "}
          大当たり {featured.wins} · 馬券内 {featured.places} · はずれ {featured.misses}
        </p>
      </div>
      <p className="mt-1 text-xs text-ink/50">
        表示中 {featured.total} 頭（買い目の重複は除外）· 結果は関係馬の着順で判定
      </p>
    </section>
  );
}
