"use client";

import { useRaceDay } from "@/components/RaceDayProvider";
import { isWeekendExperiment } from "@/domain/experiment";

export function ExperimentNote() {
  const { selectedDate } = useRaceDay();
  if (!isWeekendExperiment(selectedDate)) return null;
  return (
    <p className="mt-3 max-w-2xl text-sm text-ink/60">
      9/12–13 実験: 既存のゲート内候補はそのまま残し、追加分だけ
      <span className="text-ink">候補（検討）</span>
      と出します。3連複は人気相手を1頭増やし、3連単は人気帯の1着軸を足し、本体は軸帯×中穴の合成を平均に緩和します。オッズゲートは外しません。
    </p>
  );
}
