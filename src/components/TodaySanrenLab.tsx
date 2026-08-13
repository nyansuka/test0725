"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SanrenLabLaneCards } from "@/components/SanrenLabLaneCards";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import { useRaceDay } from "@/components/RaceDayProvider";
import { filterRacesByDate } from "@/data/races";
import { formatJstDateLabel } from "@/domain/date";
import type { Race } from "@/domain/types";

type Props = {
  races?: Race[];
};

export function TodaySanrenLab({ races: racesProp }: Props) {
  const { races: catalogRaces } = useRaceCatalog();
  const races = racesProp ?? catalogRaces;
  const { selectedDate, today } = useRaceDay();
  const dayRaces = useMemo(
    () => filterRacesByDate(races, selectedDate),
    [races, selectedDate],
  );
  const isToday = selectedDate === today;

  return (
    <section id="sanren-lab" className="bg-sand px-4 py-8 sm:px-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink sm:text-xl">3連系研究所</h2>
            <p className="mt-1 text-xs text-ink/55 sm:text-sm">
              {formatJstDateLabel(selectedDate)}
              {isToday ? "（本日）" : ""}
              {dayRaces.length === 0
                ? " · 開催なし"
                : ` · ${dayRaces.length} レース`}
              {" · "}
              複／単を別レーンで選別
            </p>
          </div>
          <Link
            href="/lab/sanren"
            className="inline-flex items-center bg-turf px-3.5 py-1.5 text-xs font-medium text-sand transition hover:bg-turf-deep sm:text-sm"
          >
            研究所へ
          </Link>
        </div>
        <div className="mt-4">
          <SanrenLabLaneCards races={races} />
        </div>
        <p className="mt-4 max-w-2xl text-xs leading-relaxed text-ink/50 sm:text-sm">
          本体の注目穴ボードとは独立した研究所面です。設定・KPI・週次実験は複／単を混ぜません。
        </p>
      </div>
    </section>
  );
}
