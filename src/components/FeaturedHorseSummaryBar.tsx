"use client";

import { useMemo } from "react";
import type { LongshotPick, Race } from "@/domain/types";
import { summarizeTicketHits } from "@/domain/results";

type Props = {
  picks: LongshotPick[];
  races: Race[];
};

export function FeaturedHorseSummaryBar({ picks, races }: Props) {
  const byId = useMemo(() => new Map(races.map((r) => [r.id, r])), [races]);
  const featured = useMemo(
    () => summarizeTicketHits(picks, byId),
    [picks, byId],
  );

  if (picks.length === 0) return null;

  return (
    <section
      aria-label="買い目のヒットサマリー"
      className="border border-turf/30 bg-turf/5 px-4 py-4 md:px-5"
    >
      <p className="text-xs font-medium tracking-wider text-turf">買い目のヒット（券種的中）</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
          {featured.hitRatePercent == null ? "—" : `${featured.hitRatePercent}%`}
        </p>
        <p className="text-sm text-ink/70">
          ヒット {featured.hits} / 確定 {featured.settled}
          {featured.pending > 0 ? ` · 待ち ${featured.pending}` : ""}
          {" · "}
          はずれ {featured.misses}
        </p>
      </div>
      <p className="mt-1 text-xs text-ink/50">
        表示中 {featured.total} 買い目 · その券種の払戻があればヒット
      </p>
    </section>
  );
}
