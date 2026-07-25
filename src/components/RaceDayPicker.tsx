"use client";

import { formatJstDateLabel } from "@/domain/date";
import { useRaceDay } from "@/components/RaceDayProvider";

type Props = {
  /** compact: ヘッダー向け / panel: 一覧ページ向け */
  variant?: "compact" | "panel";
  className?: string;
};

export function RaceDayPicker({ variant = "panel", className = "" }: Props) {
  const { selectedDate, setSelectedDate, goToday, today, availableDates, hydrated } =
    useRaceDay();

  const isToday = selectedDate === today;
  const hasRaces = availableDates.includes(selectedDate);

  if (variant === "compact") {
    return (
      <label className={`flex items-center gap-2 text-sm ${className}`}>
        <span className="opacity-70">開催日</span>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-current/20 bg-transparent px-2 py-1"
          aria-label="開催日"
        />
        {!isToday && (
          <button type="button" onClick={goToday} className="underline opacity-80 hover:opacity-100">
            今日
          </button>
        )}
      </label>
    );
  }

  return (
    <div className={`flex flex-wrap items-end gap-4 ${className}`}>
      <label className="block text-sm">
        <span className="text-ink/60">開催日</span>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="mt-1 block border border-ink/15 bg-sand px-3 py-2"
          aria-label="開催日"
        />
      </label>
      <div className="pb-2 text-sm text-ink/70">
        {hydrated ? formatJstDateLabel(selectedDate) : "…"}
        {isToday ? "（本日）" : null}
        {!hasRaces && <span className="ml-2 text-signal">この日のサンプル開催はありません</span>}
      </div>
      {!isToday && (
        <button
          type="button"
          onClick={goToday}
          className="mb-0.5 border border-ink/15 px-3 py-2 text-sm text-ink/70 hover:border-turf hover:text-turf"
        >
          本日に戻す
        </button>
      )}
      {availableDates.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-1 text-xs">
          <span className="self-center text-ink/45">サンプル開催:</span>
          {availableDates.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDate(d)}
              className={`border px-2 py-1 ${
                d === selectedDate
                  ? "border-turf bg-turf/10 text-turf"
                  : "border-ink/15 text-ink/55 hover:border-ink/40"
              }`}
            >
              {d === today ? "本日" : d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
