"use client";

import { formatJstDateLabel } from "@/domain/date";
import { useRaceDay } from "@/components/RaceDayProvider";

type Props = {
  /** compact: ヘッダー内 / panel: ページ内の大きな選択UI */
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
      <div
        className={`flex flex-wrap items-center gap-2 rounded-sm bg-sand px-2 py-1.5 text-sm text-ink shadow-sm ${className}`}
      >
        <span className="font-medium text-ink/70">開催日</span>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value || today)}
          className="min-w-[9.5rem] border border-ink/20 bg-white px-2 py-1 text-ink"
          aria-label="開催日"
        />
        {hydrated && !isToday ? (
          <button
            type="button"
            onClick={goToday}
            className="text-turf underline hover:text-turf-deep"
          >
            今日
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`rounded-sm border border-turf/30 bg-sand-dim/50 p-4 md:p-5 ${className}`}
    >
      <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.18em] text-turf">
        RACE DAY
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="block text-sm">
          <span className="font-medium text-ink">開催日を選択</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value || today)}
            className="mt-1 block min-w-[12rem] border border-ink/20 bg-white px-3 py-2.5 text-base text-ink"
            aria-label="開催日"
          />
        </label>
        <div className="pb-2 text-sm text-ink/80">
          {hydrated ? formatJstDateLabel(selectedDate) : "読み込み中…"}
          {hydrated && isToday ? (
            <span className="ml-2 rounded-sm bg-turf px-2 py-0.5 text-xs text-sand">本日</span>
          ) : null}
          {hydrated && !hasRaces ? (
            <span className="ml-2 text-signal">この日のサンプル開催はありません</span>
          ) : null}
        </div>
        {hydrated && !isToday ? (
          <button
            type="button"
            onClick={goToday}
            className="border border-turf bg-turf px-4 py-2.5 text-sm font-medium text-sand hover:bg-turf-deep"
          >
            本日に戻す
          </button>
        ) : null}
      </div>
      {availableDates.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3 text-sm">
          <span className="text-ink/50">サンプル開催日:</span>
          {availableDates.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDate(d)}
              className={`border px-3 py-1.5 ${
                d === selectedDate
                  ? "border-turf bg-turf text-sand"
                  : "border-ink/20 bg-white text-ink/70 hover:border-turf"
              }`}
            >
              {hydrated && d === today ? `本日（${d}）` : d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
