import type { BetType, LongshotPick, Race, RaceResult } from "./types";
import { parseSelectionNumbers } from "./betTypes";

export type PickOutcome = "hit" | "miss" | "pending";

function topN(result: RaceResult, n: number): number[] {
  return result.finishes
    .filter((f) => f.rank != null && f.rank >= 1 && f.rank <= n)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .map((f) => f.number);
}

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

/** 候補買い目が結果に的中したか（簡易判定） */
export function evaluatePick(pick: LongshotPick, result: RaceResult | undefined): PickOutcome {
  if (!result?.finishes?.length) return "pending";
  const nums = parseSelectionNumbers(pick.selection);
  const first = topN(result, 1);
  const top2 = topN(result, 2);
  const top3 = topN(result, 3);

  switch (pick.betType) {
    case "win":
      return nums[0] != null && first[0] === nums[0] ? "hit" : "miss";
    case "place":
      return nums[0] != null && top3.includes(nums[0]) ? "hit" : "miss";
    case "quinella":
      return nums.length >= 2 && sameSet(nums.slice(0, 2), top2) ? "hit" : "miss";
    case "wide":
      return nums.length >= 2 && nums.slice(0, 2).every((n) => top3.includes(n))
        ? "hit"
        : "miss";
    case "bracket_quinella": {
      // 枠番そのものの厳密判定は省略。関係馬が2着以内に2頭いれば的中扱い
      const related = pick.relatedHorseNumbers;
      return related.filter((n) => top2.includes(n)).length >= 2 ? "hit" : "miss";
    }
    case "exacta":
      return nums.length >= 2 && nums[0] === top2[0] && nums[1] === top2[1] ? "hit" : "miss";
    case "trio":
      return nums.length >= 3 && sameSet(nums.slice(0, 3), top3) ? "hit" : "miss";
    case "trifecta":
      return nums.length >= 3 &&
        nums[0] === top3[0] &&
        nums[1] === top3[1] &&
        nums[2] === top3[2]
        ? "hit"
        : "miss";
    default:
      return "pending";
  }
}

export function formatFinishLine(result: RaceResult): string {
  const top = result.finishes
    .filter((f) => f.rank != null && f.rank <= 3)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  if (top.length === 0) return "結果待ち";
  return top.map((f) => `${f.rank}着 ${f.number}番 ${f.name}`).join(" · ");
}

export function payoutLabel(betType: BetType): string {
  const map: Record<BetType, string> = {
    win: "単勝",
    place: "複勝",
    bracket_quinella: "枠連",
    quinella: "馬連",
    wide: "ワイド",
    exacta: "馬単",
    trio: "3連複",
    trifecta: "3連単",
  };
  return map[betType];
}

export function raceHasResult(race: Race): boolean {
  return Boolean(race.result?.finishes?.length);
}
