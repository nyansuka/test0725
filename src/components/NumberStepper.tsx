"use client";

import { useEffect, useId, useState } from "react";

type Props = {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  /** true のとき空＝null を許容（オッズ上限など） */
  nullable?: boolean;
  emptyLabel?: string;
  /** null から＋したときの初期値 */
  nullStepTo?: number;
  "aria-label": string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  nullable = false,
  emptyLabel = "なし",
  nullStepTo,
  "aria-label": ariaLabel,
}: Props) {
  const id = useId();
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(value == null ? "" : String(value));
    }
  }, [value, focused]);

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      if (nullable) {
        onChange(null);
        setDraft("");
        return;
      }
      onChange(min);
      setDraft(String(min));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      setDraft(value == null ? "" : String(value));
      return;
    }
    const next = clamp(Math.round(n), min, max);
    onChange(next);
    setDraft(String(next));
  }

  function stepBy(delta: number) {
    if (value == null) {
      if (delta < 0) return;
      const start = nullStepTo ?? min;
      onChange(clamp(start, min, max));
      return;
    }
    const next = value + delta;
    if (nullable && next < min) {
      onChange(null);
      return;
    }
    onChange(clamp(next, min, max));
  }

  const atMin = value == null || value <= min;
  const atMax = value != null && value >= max;
  const display = focused ? draft : value == null ? emptyLabel : String(value);

  return (
    <div className="mt-2 flex w-full max-w-full min-w-0 items-stretch overflow-hidden border border-ink/15 bg-sand">
      <button
        type="button"
        aria-label={`${ariaLabel}を減らす`}
        disabled={nullable ? value == null : atMin}
        onClick={() => stepBy(-step)}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center border-r border-ink/15 text-lg font-medium text-ink transition enabled:hover:bg-sand-dim disabled:text-ink/25 sm:h-12 sm:w-12 sm:text-xl"
      >
        −
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        size={1}
        aria-label={ariaLabel}
        value={focused ? draft : display}
        placeholder={nullable ? emptyLabel : undefined}
        onFocus={() => {
          setFocused(true);
          setDraft(value == null ? "" : String(value));
        }}
        onBlur={() => {
          setFocused(false);
          commit(draft);
        }}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            stepBy(step);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            stepBy(-step);
          }
        }}
        className="w-0 min-w-0 flex-1 bg-transparent px-2 text-center text-base font-[family-name:var(--font-display)] font-semibold tabular-nums text-ink outline-none sm:px-3"
      />
      <button
        type="button"
        aria-label={`${ariaLabel}を増やす`}
        disabled={atMax}
        onClick={() => stepBy(step)}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center border-l border-ink/15 text-lg font-medium text-ink transition enabled:hover:bg-sand-dim disabled:text-ink/25 sm:h-12 sm:w-12 sm:text-xl"
      >
        ＋
      </button>
    </div>
  );
}
