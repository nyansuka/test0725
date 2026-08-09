"use client";

import { useMemo } from "react";
import Link from "next/link";
import { selectLongshots } from "@/domain/longshots";
import type { Race } from "@/domain/types";
import { useSettings } from "@/components/SettingsProvider";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import { useRaceDay } from "@/components/RaceDayProvider";
import { LongshotTable } from "@/components/LongshotTable";
import { filterRacesByDate } from "@/data/races";
import { formatJstDateLabel } from "@/domain/date";

type Props = {
  races?: Race[];
  limit?: number;
};

export function TodayLongshots({ races: racesProp, limit = 5 }: Props) {
  const { races: catalogRaces } = useRaceCatalog();
  const races = racesProp ?? catalogRaces;
  const { settings } = useSettings();
  const { selectedDate, today } = useRaceDay();
  const dayRaces = useMemo(
    () => filterRacesByDate(races, selectedDate),
    [races, selectedDate],
  );
  const picks = useMemo(() => {
    // 見出しは「注目穴」。抑え候補はボード側で見る
    return selectLongshots(dayRaces, settings)
      .filter((p) => p.label === "注目穴")
      .slice(0, limit);
  }, [dayRaces, settings, limit]);
  const isToday = selectedDate === today;

  return (
    <section id="featured" className="bg-sand px-4 py-8 sm:px-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink sm:text-xl">
              {isToday ? "今日の注目穴" : "選択日の注目穴"}
            </h2>
            <p className="mt-1 text-xs text-ink/55 sm:text-sm">
              {formatJstDateLabel(selectedDate)}
              {isToday ? "（本日）" : ""} · 上位{limit}件
            </p>
          </div>
          <Link
            href="/longshots"
            className="inline-flex items-center bg-turf px-3.5 py-1.5 text-xs font-medium text-sand transition hover:bg-turf-deep sm:text-sm"
          >
            ボードへ
          </Link>
        </div>
        <div className="mt-4">
          <LongshotTable
            compact
            picks={picks}
            emptyMessage={
              dayRaces.length === 0
                ? "この日の開催データがありません。開催日を変更してください。"
                : "現在の設定では候補がありません。閾値を下げてみてください。"
            }
          />
        </div>
      </div>
    </section>
  );
}
