"use client";

import { useMemo } from "react";
import Link from "next/link";
import { selectLongshots } from "@/domain/longshots";
import type { Race } from "@/domain/types";
import { useSettings } from "@/components/SettingsProvider";
import { LongshotTable } from "@/components/LongshotTable";

type Props = {
  races: Race[];
  limit?: number;
};

export function TodayLongshots({ races, limit = 5 }: Props) {
  const { settings } = useSettings();
  const picks = useMemo(
    () => selectLongshots(races, settings).slice(0, limit),
    [races, settings, limit],
  );

  return (
    <section id="featured" className="bg-sand px-6 py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-turf">
              TODAY&apos;S LONGSHOTS
            </p>
            <h2 className="mt-2 text-3xl font-bold text-ink md:text-4xl">今日の注目穴</h2>
            <p className="mt-3 max-w-xl text-ink/70">
              オッズ閾値以上かつ複勝圏スコアが基準を超えた候補（設定と連動）。
            </p>
          </div>
          <Link
            href="/longshots"
            className="inline-flex items-center bg-turf px-5 py-2.5 text-sm font-medium text-sand transition hover:bg-turf-deep"
          >
            注目穴ボードへ
          </Link>
        </div>
        <div className="mt-10">
          <LongshotTable picks={picks} emptyMessage="現在の設定では候補がありません。閾値を下げてみてください。" />
        </div>
      </div>
    </section>
  );
}
