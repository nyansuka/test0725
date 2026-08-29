"use client";

import { useId, useMemo, useState } from "react";
import { buildSupplementNotes } from "@/domain/supplementNotes";

type Props = {
  venue: string;
  raceDate: string;
};

export function SupplementNotesPanel({ venue, raceDate }: Props) {
  const notes = useMemo(
    () => buildSupplementNotes({ venue, raceDate }),
    [venue, raceDate],
  );
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const summary =
    notes.raceHints.length > 0
      ? notes.raceHints.join(" ")
      : "調教は縦比較。馬体重は2桁増減だけで消さない。";

  return (
    <section
      data-testid="supplement-notes-panel"
      className="border-y border-ink/10 py-4 text-ink/70"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs tracking-wider text-ink/45">補足 · スコア外</p>
          <p className="mt-0.5 truncate text-sm text-ink/60">{summary}</p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-sm text-turf underline-offset-2 hover:underline"
        >
          {open ? "チェックを隠す" : "チェックを見る"}
        </button>
      </div>

      {open ? (
        <div id={panelId} className="mt-4 space-y-4">
          {notes.raceHints.length > 0 ? (
            <ul className="space-y-1 text-sm text-ink/65">
              {notes.raceHints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          ) : null}
          {[notes.workout, notes.weight].map((section) => (
            <div key={section.id}>
              <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs leading-relaxed text-ink/60">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-ink/40">
            穴／軸スコア・危険1人気・3連系研究所には使わない。調教履歴と当日馬体重はスナップショット未収録のため、JRA・新聞で確認する。
          </p>
        </div>
      ) : null}
    </section>
  );
}
