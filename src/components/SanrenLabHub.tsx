"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import { useRaceDay } from "@/components/RaceDayProvider";
import { filterRacesByDate } from "@/data/races";
import { formatJstDateLabel } from "@/domain/date";
import {
  DEFAULT_TRIO_LANE,
  DEFAULT_TRIFECTA_LANE,
  selectTrioLab,
  selectTrifectaLab,
  summarizeSanrenLabDensity,
} from "@/domain/sanrenLab";

export function SanrenLabHub() {
  const { races } = useRaceCatalog();
  const { selectedDate } = useRaceDay();
  const dayRaces = useMemo(
    () => filterRacesByDate(races, selectedDate),
    [races, selectedDate],
  );

  const trio = useMemo(() => {
    const picks = selectTrioLab(dayRaces, DEFAULT_TRIO_LANE);
    return { picks, density: summarizeSanrenLabDensity(picks) };
  }, [dayRaces]);

  const trifecta = useMemo(() => {
    const picks = selectTrifectaLab(dayRaces, DEFAULT_TRIFECTA_LANE);
    return { picks, density: summarizeSanrenLabDensity(picks) };
  }, [dayRaces]);

  const cards = [
    {
      href: "/lab/sanren/trio",
      eyebrow: "TRIO LANE",
      title: "3連複研究",
      blurb: `人気×人気×穴（順不同）。オッズ ≥ ${DEFAULT_TRIO_LANE.oddsThreshold} 倍。`,
      density: trio.density,
    },
    {
      href: "/lab/sanren/trifecta",
      eyebrow: "TRIFECTA LANE",
      title: "3連単研究",
      blurb: `1着固定フォーメーション。オッズ ≥ ${DEFAULT_TRIFECTA_LANE.oddsThreshold} 倍。`,
      density: trifecta.density,
    },
  ] as const;

  return (
    <div>
      <p className="text-sm text-ink/55">
        表示対象: {formatJstDateLabel(selectedDate)}
        {dayRaces.length === 0
          ? "（開催なし）"
          : ` · ${dayRaces.length} レース`}
        <span className="text-ink/40"> · 開催日は上部バーで変更</span>
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group border border-ink/10 bg-sand-dim/30 px-5 py-6 transition hover:border-turf/40 hover:bg-sand-dim/50"
          >
            <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.18em] text-turf">
              {card.eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-ink group-hover:text-turf">
              {card.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/65">{card.blurb}</p>
            <p className="mt-5 font-[family-name:var(--font-display)] text-sm text-ink/80">
              {card.density.pickCount} 点 · {card.density.raceCount} R
              {card.density.raceCount > 0
                ? ` · 平均 ${card.density.avgPerRace.toFixed(1)} 点/R`
                : ""}
            </p>
            <p className="mt-3 text-sm font-medium text-turf">一覧を開く →</p>
          </Link>
        ))}
      </div>

      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink/55">
        研究所は本体の注目穴ボードとは別レーンです。設定・KPI・週次実験は複／単を混ぜません。
        本体のデフォルト券種は変えません。
      </p>
    </div>
  );
}
