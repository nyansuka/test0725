"use client";

import { useMemo } from "react";
import Link from "next/link";
import { selectLongshots } from "@/domain/longshots";
import type { Race } from "@/domain/types";
import { useSettings } from "@/components/SettingsProvider";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import { useRaceDay } from "@/components/RaceDayProvider";
import { RaceDayPicker } from "@/components/RaceDayPicker";
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
  const picks = useMemo(
    () => selectLongshots(dayRaces, settings).slice(0, limit),
    [dayRaces, settings, limit],
  );
  const isToday = selectedDate === today;

  return (
    <section id="featured" className="bg-sand px-6 py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-turf">
              TODAY&apos;S LONGSHOTS
            </p>
            <h2 className="mt-2 text-3xl font-bold text-ink md:text-4xl">
              {isToday ? "今日の注目穴" : "選択日の注目穴"}
            </h2>
            <p className="mt-3 max-w-xl text-ink/70">
              {formatJstDateLabel(selectedDate)}
              {isToday ? "（本日）" : ""} の候補。オッズ閾値・スコアは設定と連動します。
            </p>
          </div>
          <Link
            href="/longshots"
            className="inline-flex items-center bg-turf px-5 py-2.5 text-sm font-medium text-sand transition hover:bg-turf-deep"
          >
            注目穴ボードへ
          </Link>
        </div>
        <div className="mt-6">
          <RaceDayPicker />
        </div>
        <div className="mt-10">
          <LongshotTable
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
