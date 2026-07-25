import { parseSelectionNumbers } from "./betTypes";
import { getScorer } from "./scoring";
import type {
  Horse,
  LongshotPick,
  Race,
  RaceExpectationRank,
  UserSelectionSettings,
} from "./types";

function resolveRelatedHorses(race: Race, selection: string, betType: string): Horse[] {
  const nums = parseSelectionNumbers(selection);
  if (betType === "bracket_quinella") {
    return race.horses.filter((h) => h.bracket != null && nums.includes(h.bracket));
  }
  return race.horses.filter((h) => nums.includes(h.number));
}

function combinePlacePotential(scores: number[]): number {
  if (scores.length === 0) return 0;
  // 初期: 下限（一番弱い関係馬で評価）
  return Math.min(...scores);
}

function scoreHorse(horse: Horse, race: Race): number {
  if (typeof horse.placePotential === "number") {
    return horse.placePotential;
  }
  return getScorer().score(horse, race).placePotential;
}

function pickComment(race: Race, related: Horse[]): string {
  if (related.length === 0) return "関係馬の評価が不足しています。";
  const best = [...related].sort(
    (a, b) => scoreHorse(b, race) - scoreHorse(a, race),
  )[0];
  return best.comment;
}

export function selectLongshots(
  races: Race[],
  settings: UserSelectionSettings,
): LongshotPick[] {
  const picks: LongshotPick[] = [];
  const enabled = new Set(settings.enabledBetTypes);

  for (const race of races) {
    if (race.authority !== "JRA") continue;

    for (const entry of race.oddsBoard) {
      if (!enabled.has(entry.betType)) continue;
      if (entry.odds < settings.oddsThreshold) continue;

      const related = resolveRelatedHorses(race, entry.selection, entry.betType);
      const scores = related.map((h) => scoreHorse(h, race));
      const relatedPlacePotential = combinePlacePotential(scores);

      if (relatedPlacePotential < settings.scoreMin) continue;

      picks.push({
        raceId: race.id,
        venue: race.venue,
        raceNumber: race.raceNumber,
        startTime: race.startTime,
        track: race.track,
        title: race.title,
        betType: entry.betType,
        selection: entry.selection,
        odds: entry.odds,
        relatedHorseNumbers: related.map((h) => h.number),
        relatedPlacePotential,
        label: relatedPlacePotential >= 70 ? "注目穴" : "抑え候補",
        comment: pickComment(race, related),
      });
    }
  }

  return picks.sort((a, b) => b.relatedPlacePotential - a.relatedPlacePotential);
}

export function raceExpectationRank(
  picksForRace: LongshotPick[],
): RaceExpectationRank {
  if (picksForRace.length === 0) return "D";
  const top = Math.max(...picksForRace.map((p) => p.relatedPlacePotential));
  const highCount = picksForRace.filter((p) => p.relatedPlacePotential >= 70).length;
  const edge =
    Math.min(100, top * 0.7 + Math.min(highCount, 4) * 8 + Math.min(picksForRace.length, 6) * 3);

  if (edge >= 85 && highCount >= 2) return "S";
  if (edge >= 70) return "A";
  if (edge >= 55) return "B";
  if (edge >= 40) return "C";
  return "D";
}

export function enrichHorseScores(race: Race) {
  const scorer = getScorer();
  return race.horses.map((horse) => {
    const result = scorer.score(horse, race);
    return {
      ...horse,
      placePotential: result.placePotential,
      factors: result.factors,
      rationale: result.rationale,
    };
  });
}
