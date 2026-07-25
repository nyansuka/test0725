import type { Horse, OddsEntry, Race } from "./types";

/** 単勝オッズから人気順位を算出（オッズが低いほど上位人気） */
export function popularityByNumber(horses: Pick<Horse, "number" | "oddsWin">[]): Map<number, number> {
  const sorted = [...horses].sort(
    (a, b) => a.oddsWin - b.oddsWin || a.number - b.number,
  );
  const map = new Map<number, number>();
  sorted.forEach((h, i) => map.set(h.number, i + 1));
  return map;
}

export function formatPopularity(rank: number | undefined): string {
  if (rank == null) return "—";
  return `${rank}番人気`;
}

/** 買い目横用: (3番人気) */
export function formatPopularityParen(rank: number | undefined): string {
  if (rank == null) return "";
  return `(${rank}番人気)`;
}

export function formatWinOdds(odds: number): string {
  return `${odds.toFixed(1)}倍`;
}

/** 複勝オッズ表示（馬データ or オッズ板から） */
export function placeOddsLabel(horse: Horse, race?: Race): string {
  if (horse.oddsPlace) {
    const { min, max } = horse.oddsPlace;
    if (Math.abs(min - max) < 0.05) return `${min.toFixed(1)}倍`;
    return `${min.toFixed(1)}〜${max.toFixed(1)}倍`;
  }
  if (race) {
    const entry = race.oddsBoard.find(
      (e) => e.betType === "place" && e.selection === String(horse.number),
    );
    if (entry) return `${entry.odds.toFixed(1)}倍`;
  }
  // サンプル用の粗い推定
  const estMin = Math.max(1.1, Number((horse.oddsWin * 0.28).toFixed(1)));
  const estMax = Math.max(estMin + 0.1, Number((horse.oddsWin * 0.52).toFixed(1)));
  return `${estMin.toFixed(1)}〜${estMax.toFixed(1)}倍`;
}

export function winOddsFromBoard(race: Race, horseNumber: number): number | undefined {
  const entry = race.oddsBoard.find(
    (e: OddsEntry) => e.betType === "win" && e.selection === String(horseNumber),
  );
  return entry?.odds;
}
