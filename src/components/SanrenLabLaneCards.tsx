"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import { useRaceDay } from "@/components/RaceDayProvider";
import { filterRacesByDate } from "@/data/races";
import {
  DEFAULT_TRIO_LANE,
  DEFAULT_TRIFECTA_LANE,
  selectTrioLab,
  selectTrifectaLab,
  summarizeSanrenLabDensity,
} from "@/domain/sanrenLab";
import type { Race } from "@/domain/types";

type Props = {
  races?: Race[];
};

export function SanrenLabLaneCards({ races: racesProp }: Props) {
  const { races: catalogRaces } = useRaceCatalog();
  const races = racesProp ?? catalogRaces;
  const { selectedDate } = useRaceDay();
  const dayRaces = useMemo(
    () => filterRacesByDate(races, selectedDate),
    [races, selectedDate],
  );

  const trio = useMemo(() => {
    const picks = selectTrioLab(dayRaces, DEFAULT_TRIO_LANE);
    return { picks, density: summarizeSanrenLabDensity(picks) };
  }, [dayRaces]);

  const trifecta = useMemo(() => {
    const picks = selectTrifectaLab(dayRaces, DEFAULT_TRIFECTA_LANE);
    return { picks, density: summarizeSanrenLabDensity(picks) };
  }, [dayRaces]);

  const cards = [
    {
      href: "/lab/sanren/trio",
      eyebrow: "TRIO LANE",
      title: "3連複研究",
      blurb: `当日全レース。人気×人気×穴を ev 指数で最大 ${DEFAULT_TRIO_LANE.topNPerRace} 点。`,
      density: trio.density,
    },
    {
      href: "/lab/sanren/trifecta",
      eyebrow: "TRIFECTA LANE",
      title: "3連単研究",
      blurb: `1着固定フォーメーション。オッズ ≥ ${DEFAULT_TRIFECTA_LANE.oddsThreshold} 倍。`,
      density: trifecta.density,
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="group border border-ink/10 bg-sand-dim/30 px-5 py-6 transition hover:border-turf/40 hover:bg-sand-dim/50"
        >
          <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.18em] text-turf">
            {card.eyebrow}
          </p>
          <h3 className="mt-2 text-2xl font-bold text-ink group-hover:text-turf">
            {card.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/65">{card.blurb}</p>
          <p className="mt-5 font-[family-name:var(--font-display)] text-sm text-ink/80">
            {card.density.pickCount} 点 · {card.density.raceCount} R
            {card.density.raceCount > 0
              ? ` · 平均 ${card.density.avgPerRace.toFixed(1)} 点/R`
              : ""}
          </p>
          <p className="mt-3 text-sm font-medium text-turf">一覧を開く →</p>
        </Link>
      ))}
    </div>
  );
}
