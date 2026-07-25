import { BET_TYPE_LABELS } from "@/domain/betTypes";
import type { LongshotPick } from "@/domain/types";
import Link from "next/link";
import { LongshotMark } from "@/components/LongshotMark";

type Props = {
  picks: LongshotPick[];
  emptyMessage?: string;
};

export function LongshotTable({ picks, emptyMessage = "条件に合う候補がありません。" }: Props) {
  if (picks.length === 0) {
    return <p className="py-10 text-center text-ink/60">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-ink/20 text-ink/50">
            <th className="py-3 pr-3 font-medium">印</th>
            <th className="py-3 pr-3 font-medium">レース</th>
            <th className="py-3 pr-3 font-medium">券種</th>
            <th className="py-3 pr-3 font-medium">買い目</th>
            <th className="py-3 pr-3 font-medium">オッズ</th>
            <th className="py-3 pr-3 font-medium">スコア</th>
            <th className="py-3 pr-3 font-medium">ラベル</th>
            <th className="py-3 font-medium">短評</th>
          </tr>
        </thead>
        <tbody>
          {picks.map((pick) => (
            <tr
              key={`${pick.raceId}-${pick.betType}-${pick.selection}`}
              className="border-b border-ink/10 align-top"
            >
              <td className="py-4 pr-3 text-lg">
                {pick.label === "注目穴" ? <LongshotMark /> : null}
              </td>
              <td className="py-4 pr-3">
                <Link href={`/races/${pick.raceId}`} className="font-medium text-turf hover:underline">
                  {pick.venue} {pick.raceNumber}R
                </Link>
                <span className="mt-1 block text-xs text-ink/50">{pick.startTime}</span>
              </td>
              <td className="py-4 pr-3">{BET_TYPE_LABELS[pick.betType]}</td>
              <td className="py-4 pr-3 font-[family-name:var(--font-display)] text-base font-semibold">
                {pick.selection}
                {pick.label === "注目穴" && (
                  <span className="ml-1 text-sm font-normal text-signal">
                    <LongshotMark />
                  </span>
                )}
              </td>
              <td className="py-4 pr-3 font-medium text-signal">{pick.odds.toFixed(1)}</td>
              <td className="min-w-[120px] py-4 pr-3">
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-display)] text-lg font-semibold text-turf">
                    {pick.relatedPlacePotential}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden bg-sand-dim">
                  <div
                    className="animate-bar h-full bg-turf"
                    style={{ width: `${pick.relatedPlacePotential}%` }}
                  />
                </div>
              </td>
              <td className="py-4 pr-3">
                <span
                  className={
                    pick.label === "注目穴" ? "font-medium text-signal" : "text-ink/60"
                  }
                >
                  {pick.label}
                </span>
              </td>
              <td className="max-w-xs py-4 leading-relaxed text-ink/70">{pick.comment}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
