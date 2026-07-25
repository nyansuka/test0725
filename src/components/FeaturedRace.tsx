"use client";

import { useState } from "react";
import type { Horse, Race } from "@/data/races";
import { getTopPicks } from "@/data/races";

type Props = {
  race: Race;
};

export function FeaturedRace({ race }: Props) {
  const picks = getTopPicks(race, 3);
  const [selected, setSelected] = useState<Horse>(picks[0]);

  return (
    <section id="featured" className="bg-sand px-6 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-turf">
              TODAY&apos;S PICK
            </p>
            <h2 className="mt-2 text-3xl font-bold text-ink md:text-4xl">本日の本命レース</h2>
            <p className="mt-3 max-w-lg text-ink/70">
              {race.venue}
              {race.raceNumber}R {race.title} — 信頼度の高い上位馬を選択して根拠を確認できます。
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-ink/70">
            <span className="inline-flex items-center gap-2">
              <span className="animate-dot inline-block h-2 w-2 rounded-full bg-turf" />
              {race.startTime} 発走
            </span>
            <span>{race.distance}</span>
            <span>
              {race.weather} / {race.condition}
            </span>
          </div>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            {picks.map((horse, index) => {
              const active = selected.number === horse.number;
              const label = index === 0 ? "本命" : index === 1 ? "対抗" : "穴";
              return (
                <button
                  key={horse.number}
                  type="button"
                  onClick={() => setSelected(horse)}
                  className={`w-full border px-5 py-4 text-left transition ${
                    active
                      ? "border-turf bg-turf text-sand"
                      : "border-ink/15 bg-sand-dim/40 text-ink hover:border-turf/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className={`text-xs tracking-widest ${active ? "text-sand/70" : "text-ink/50"}`}>
                        {label} · {horse.number}番
                      </p>
                      <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">
                        {horse.name}
                      </p>
                      <p className={`mt-1 text-sm ${active ? "text-sand/75" : "text-ink/60"}`}>
                        {horse.jockey} / 単勝 {horse.odds.toFixed(1)}倍
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-[family-name:var(--font-display)] text-2xl font-bold">
                        {horse.confidence}
                      </p>
                      <p className={`text-xs ${active ? "text-sand/70" : "text-ink/50"}`}>信頼度</p>
                    </div>
                  </div>
                  <div className={`mt-4 h-1.5 overflow-hidden ${active ? "bg-sand/25" : "bg-ink/10"}`}>
                    <div
                      className={`animate-bar h-full ${active ? "bg-signal-soft" : "bg-turf"}`}
                      style={{ width: `${horse.confidence}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <aside className="border border-ink/10 bg-turf-deep px-6 py-7 text-sand">
            <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.18em] text-signal-soft">
              ANALYST NOTE
            </p>
            <h3 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold">
              {selected.name}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-sand/80">{selected.comment}</p>
            <dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-sand/50">枠番</dt>
                <dd className="mt-1 text-lg font-medium">{selected.number}</dd>
              </div>
              <div>
                <dt className="text-sand/50">騎手</dt>
                <dd className="mt-1 text-lg font-medium">{selected.jockey}</dd>
              </div>
              <div>
                <dt className="text-sand/50">単勝オッズ</dt>
                <dd className="mt-1 text-lg font-medium">{selected.odds.toFixed(1)}</dd>
              </div>
              <div>
                <dt className="text-sand/50">信頼度</dt>
                <dd className="mt-1 text-lg font-medium">{selected.confidence}%</dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </section>
  );
}
