import { BET_TYPE_LABELS, parseSelectionNumbers } from "@/domain/betTypes";
import type { LongshotPick } from "@/domain/types";
import Link from "next/link";
import { LongshotMark } from "@/components/LongshotMark";
import { getRace } from "@/data/races";
import {
  formatPopularityParen,
  formatWinOdds,
  popularityByNumber,
} from "@/domain/odds";
import type { ReactNode } from "react";

type Props = {
  picks: LongshotPick[];
  emptyMessage?: string;
};

function SelectionCell({ pick }: { pick: LongshotPick }) {
  const race = getRace(pick.raceId);
  const pop = race ? popularityByNumber(race.horses) : new Map<number, number>();

  let body: ReactNode;

  if (!race) {
    body = pick.selection;
  } else if (pick.betType === "bracket_quinella") {
    const ranks = [...new Set(
      pick.relatedHorseNumbers
        .map((n) => pop.get(n))
        .filter((r): r is number => r != null),
    )].sort((a, b) => a - b);
    body = (
      <>
        {pick.selection}{" "}
        {ranks.map((r) => (
          <span key={r} className="ml-1 text-sm font-medium text-ink/65">
            {formatPopularityParen(r)}
          </span>
        ))}
      </>
    );
  } else {
    const parts = pick.selection.split(/[-–—/]/);
    const nums = parseSelectionNumbers(pick.selection);
    body = (
      <>
        {parts.map((part, i) => {
          const n = nums[i];
          const rank = n != null ? pop.get(n) : undefined;
          return (
            <span key={`${part}-${i}`}>
              {i > 0 ? "-" : null}
              {part.trim()}
              {rank != null && (
                <span className="ml-1 text-sm font-medium text-ink/65">
                  {formatPopularityParen(rank)}
                </span>
              )}
            </span>
          );
        })}
      </>
    );
  }

  return (
    <td className="py-4 pr-3">
      <span className="font-[family-name:var(--font-display)] text-base font-semibold text-ink">
        {body}
      </span>
      {pick.label === "注目穴" && (
        <span className="ml-1.5 align-middle text-base">
          <LongshotMark />
        </span>
      )}
    </td>
  );
}

export function LongshotTable({ picks, emptyMessage = "条件に合う候補がありません。" }: Props) {
  if (picks.length === 0) {
    return <p className="py-10 text-center text-ink/60">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-left text-sm">
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
              <SelectionCell pick={pick} />
              <td className="py-4 pr-3 font-medium text-signal">
                {formatWinOdds(pick.odds)}
              </td>
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
