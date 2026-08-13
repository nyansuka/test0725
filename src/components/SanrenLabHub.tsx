"use client";

import { useMemo } from "react";
import { SanrenLabLaneCards } from "@/components/SanrenLabLaneCards";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import { useRaceDay } from "@/components/RaceDayProvider";
import { filterRacesByDate } from "@/data/races";
import { formatJstDateLabel } from "@/domain/date";

export function SanrenLabHub() {
  const { races } = useRaceCatalog();
  const { selectedDate } = useRaceDay();
  const dayRaces = useMemo(
    () => filterRacesByDate(races, selectedDate),
    [races, selectedDate],
  );

  return (
    <div>
      <p className="text-sm text-ink/55">
        表示対象: {formatJstDateLabel(selectedDate)}
        {dayRaces.length === 0
          ? "（開催なし）"
          : ` · ${dayRaces.length} レース`}
        <span className="text-ink/40"> · 開催日は上部バーで変更</span>
      </p>

      <div className="mt-8">
        <SanrenLabLaneCards />
      </div>

      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink/55">
        研究所は本体の注目穴ボードとは別レーンです。設定・KPI・週次実験は複／単を混ぜません。
        本体のデフォルト券種は変えません。
      </p>
    </div>
  );
}
