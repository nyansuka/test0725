"use client";

import { useId, useState } from "react";
import type { TipsterHorseRef, TipsterRaceRef } from "@/domain/tipsterRef";

export type TipsterRefPayload = {
  tipsterId: string;
  tipsterName: string;
  raceDate: string;
  note?: string;
  referenceUrl?: string;
  race: TipsterRaceRef;
};

type Props = {
  tipster: TipsterRefPayload;
};

const MARK_ORDER = ["◎", "○", "▲", "△"] as const;

function markClass(mark: string): string {
  if (mark === "◎") return "text-ink/70 font-semibold";
  if (mark === "○") return "text-ink/60 font-medium";
  if (mark === "▲") return "text-ink/55";
  if (mark === "△") return "text-ink/45";
  return "text-ink/25";
}

function scoreBarWidth(score: number, maxScore: number): string {
  if (maxScore <= 0) return "0%";
  return `${Math.max(4, Math.round((score / maxScore) * 100))}%`;
}

export function TipsterMark({ mark }: { mark: string }) {
  if (!mark) return <span className="inline-block w-4 text-center text-ink/20">·</span>;
  return (
    <span
      className={`inline-block w-4 text-center font-[family-name:var(--font-display)] text-sm leading-none ${markClass(mark)}`}
    >
      {mark}
    </span>
  );
}

export function TipsterRefPanel({ tipster }: Props) {
  const { race } = tipster;
  const horses = Array.isArray(race?.horses) ? race.horses : [];
  const panelId = useId();
  const [open, setOpen] = useState(false);

  if (horses.length === 0) return null;

  const sorted = [...horses].sort((a, b) => a.rank - b.rank);
  const maxScore = Math.max(...sorted.map((h) => h.score), 1);
  const marked = MARK_ORDER.flatMap((m) => sorted.filter((h) => h.mark === m));
  const summary =
    race.marksSummary ||
    marked
      .filter((h) => h.mark === "◎" || h.mark === "○" || h.mark === "▲")
      .map((h) => `${h.mark}${h.number}`)
      .join(" ");

  return (
    <section
      data-testid="tipster-ref-panel"
      className="border-y border-ink/10 py-4 text-ink/70"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs tracking-wider text-ink/45">参考 · プロ予想</p>
          <p className="mt-0.5 truncate text-sm text-ink/60">
            {tipster.tipsterName}
            {race.expectation ? ` · 期待度 ${race.expectation}` : ""}
            {summary ? ` · ${summary}` : ""}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-sm text-turf underline-offset-2 hover:underline"
        >
          {open ? "表を隠す" : "指数表を見る"}
        </button>
      </div>

      {open ? (
        <div id={panelId} className="mt-4">
          {marked.length > 0 && (
            <ul className="mb-4 flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-ink/65">
              {marked.map((h) => (
                <li key={`mark-${h.number}`} className="flex items-center gap-1">
                  <TipsterMark mark={h.mark} />
                  <span className="font-[family-name:var(--font-display)] tabular-nums">
                    {h.number}
                  </span>
                  <span>{h.name}</span>
                  <span className="tabular-nums text-ink/40">{h.score}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/15 text-ink/40">
                  <th className="py-1.5 pr-2 font-medium">順</th>
                  <th className="py-1.5 pr-2 font-medium">印</th>
                  <th className="py-1.5 pr-2 font-medium">馬番</th>
                  <th className="py-1.5 pr-2 font-medium">馬名</th>
                  <th className="py-1.5 pr-2 font-medium">得点</th>
                  <th className="py-1.5 font-medium w-[40%]"> </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((h: TipsterHorseRef) => (
                  <tr key={h.number} className="border-b border-ink/8">
                    <td className="py-1.5 pr-2 tabular-nums text-ink/40">{h.rank}</td>
                    <td className="py-1.5 pr-2">
                      <TipsterMark mark={h.mark} />
                    </td>
                    <td className="py-1.5 pr-2 font-[family-name:var(--font-display)] tabular-nums">
                      {h.number}
                    </td>
                    <td className="py-1.5 pr-2 text-ink/70">
                      {h.name}
                      {h.secret ? (
                        <span className="ml-1.5 text-xs text-ink/35">{h.secret}</span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-2 font-[family-name:var(--font-display)] tabular-nums text-ink/55">
                      {h.score}
                    </td>
                    <td className="py-1.5">
                      <div className="h-1 bg-sand-dim">
                        <div
                          className="h-full bg-ink/25"
                          style={{ width: scoreBarWidth(h.score, maxScore) }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink/40">
            選別スコア（穴／軸）とは別。参考のみ。
          </p>
        </div>
      ) : null}
    </section>
  );
}
