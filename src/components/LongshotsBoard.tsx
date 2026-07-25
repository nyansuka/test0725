"use client";

import { useMemo, useState } from "react";
import { BET_TYPE_LABELS, ALL_BET_TYPES } from "@/domain/betTypes";
import { selectLongshots } from "@/domain/longshots";
import type { BetType, Race } from "@/domain/types";
import { useSettings } from "@/components/SettingsProvider";
import { LongshotTable } from "@/components/LongshotTable";

type SortKey = "score" | "odds" | "time";

type Props = {
  races: Race[];
};

export function LongshotsBoard({ races }: Props) {
  const { settings, setOddsThreshold, hydrated } = useSettings();
  const [sort, setSort] = useState<SortKey>("score");
  const [venue, setVenue] = useState<string>("all");
  const [track, setTrack] = useState<"all" | "芝" | "ダート">("all");
  const [betType, setBetType] = useState<"all" | BetType>("all");

  const venues = useMemo(
    () => [...new Set(races.map((r) => r.venue))],
    [races],
  );

  const picks = useMemo(() => {
    let list = selectLongshots(races, settings);
    if (venue !== "all") list = list.filter((p) => p.venue === venue);
    if (track !== "all") list = list.filter((p) => p.track === track);
    if (betType !== "all") list = list.filter((p) => p.betType === betType);

    if (sort === "odds") return [...list].sort((a, b) => b.odds - a.odds);
    if (sort === "time") {
      return [...list].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return list;
  }, [races, settings, venue, track, betType, sort]);

  return (
    <div>
      <div className="flex flex-col gap-6 border border-ink/10 bg-sand-dim/40 p-5 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="text-ink/60">オッズ閾値（以上）</span>
            <input
              type="number"
              min={1}
              step={1}
              value={settings.oddsThreshold}
              onChange={(e) => setOddsThreshold(Number(e.target.value) || 1)}
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink/60">会場</span>
            <select
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            >
              <option value="all">すべて</option>
              {venues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-ink/60">芝／ダート</span>
            <select
              value={track}
              onChange={(e) => setTrack(e.target.value as typeof track)}
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            >
              <option value="all">すべて</option>
              <option value="芝">芝</option>
              <option value="ダート">ダート</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-ink/60">券種</span>
            <select
              value={betType}
              onChange={(e) => setBetType(e.target.value as typeof betType)}
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            >
              <option value="all">すべて</option>
              {ALL_BET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BET_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-ink/60">ソート</span>
          {(
            [
              ["score", "スコア順"],
              ["odds", "オッズ順"],
              ["time", "発走順"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={`border px-3 py-1.5 transition ${
                sort === key
                  ? "border-turf bg-turf text-sand"
                  : "border-ink/15 text-ink/70 hover:border-ink/40"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-ink/50">
            {hydrated ? `${picks.length} 件` : "読込中…"}
            {" · "}最低スコア {settings.scoreMin}
            （券種ごとの見送りはレース詳細へ）
          </span>
        </div>
      </div>

      <div className="mt-8">
        <LongshotTable picks={picks} />
      </div>
    </div>
  );
}
