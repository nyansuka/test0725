"use client";

import { useMemo } from "react";
import { courseProfile } from "@/domain/courseNotes.mjs";

type Props = {
  venue: string;
  track: "芝" | "ダート";
  distance: string;
};

export function CourseNotesPanel({ venue, track, distance }: Props) {
  const profile = useMemo(
    () => courseProfile(venue, track, distance),
    [venue, track, distance],
  );
  if (!profile) return null;

  return (
    <section data-testid="course-notes-panel" className="border-y border-ink/10 py-3 text-ink/70">
      <p className="text-xs tracking-wider text-ink/45">
        コース参考
        {profile.scoreInGate ? " · 枠にわずかに反映" : " · スコア外"}
      </p>
      <p className="mt-0.5 text-sm text-ink/80">{profile.summary}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-ink/60">
        {profile.bullets.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
