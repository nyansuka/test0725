import type { AxisHorsePick, LongshotPick, Race } from "./types";
import { getScorer } from "./scoring";

/** レースあたりの軸馬上限（PLAN §5.5） */
export const AXIS_TOP_N = 3;

export function scoreWinPotential(horse: Race["horses"][number], race: Race): number {
  return getScorer().score(horse, race).winPotential;
}

/** 注目穴の関係馬番（レース指定可） */
export function longshotWatchNumbers(
  picks: LongshotPick[],
  raceId?: string,
): Set<number> {
  const set = new Set<number>();
  for (const pick of picks) {
    if (pick.label !== "注目穴") continue;
    if (raceId && pick.raceId !== raceId) continue;
    for (const n of pick.relatedHorseNumbers) set.add(n);
  }
  return set;
}

/**
 * レース内 winPotential Top3（単勝オッズ上限なし）。
 * 同点時は単勝オッズ昇順（人気寄り）で安定させる。
 * longshotPicks を渡すと超注目（注目穴 ∩ 軸）を付与。
 */
export function selectAxisHorses(
  race: Race,
  longshotPicks?: LongshotPick[],
): AxisHorsePick[] {
  if (race.authority !== "JRA" || race.horses.length === 0) return [];

  const scored = race.horses.map((horse) => ({
    horse,
    winPotential: scoreWinPotential(horse, race),
  }));

  scored.sort((a, b) => {
    if (b.winPotential !== a.winPotential) return b.winPotential - a.winPotential;
    return a.horse.oddsWin - b.horse.oddsWin;
  });

  const watch = longshotPicks
    ? longshotWatchNumbers(longshotPicks, race.id)
    : new Set<number>();
  const n = Math.min(AXIS_TOP_N, scored.length);

  return scored.slice(0, n).map((item, index) => ({
    raceId: race.id,
    horseNumber: item.horse.number,
    winPotential: item.winPotential,
    rankInRace: (index + 1) as 1 | 2 | 3,
    isSuperWatch: watch.has(item.horse.number),
  }));
}

export function selectAxisHorsesForRaces(
  races: Race[],
  longshotPicks?: LongshotPick[],
): AxisHorsePick[] {
  const out: AxisHorsePick[] = [];
  for (const race of races) {
    out.push(...selectAxisHorses(race, longshotPicks));
  }
  return out;
}

/** 軸馬番 → rank / 超注目 */
export function axisIndexByNumber(axis: AxisHorsePick[]): Map<
  number,
  { rankInRace: 1 | 2 | 3; winPotential: number; isSuperWatch: boolean }
> {
  const map = new Map<
    number,
    { rankInRace: 1 | 2 | 3; winPotential: number; isSuperWatch: boolean }
  >();
  for (const a of axis) {
    map.set(a.horseNumber, {
      rankInRace: a.rankInRace,
      winPotential: a.winPotential,
      isSuperWatch: a.isSuperWatch,
    });
  }
  return map;
}
