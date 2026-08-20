import type { Race } from "./types";
import { popularityByNumber } from "./odds";
import { scoreFactorWin } from "./scoring/ruleBased";
import {
  assessDangerousFirstFavorite as assessCore,
  dangerousFavReasonLabels,
  DANGEROUS_FAV_REASON_LABELS,
  isCloserStyle,
  isFrontBiasedCourse,
} from "./dangerousFavorite.mjs";

export type DangerousFirstFavoriteAssessment = NonNullable<
  ReturnType<typeof assessCore>
>;
export {
  DANGEROUS_FAV_REASON_LABELS,
  dangerousFavReasonLabels,
  isCloserStyle,
  isFrontBiasedCourse,
};

/** レースの1番人気について、危険フラグの有無を返す。人気不明なら null */
export function findDangerousFirstFavorite(
  race: Race,
): DangerousFirstFavoriteAssessment | null {
  if (race.authority !== "JRA" || race.horses.length === 0) return null;
  const popularity = popularityByNumber(race.horses);
  const factorWins = new Map(
    race.horses.map((h) => [h.number, scoreFactorWin(h, race)]),
  );
  return assessCore({
    raceId: race.id,
    venue: race.venue,
    track: race.track,
    distance: race.distance,
    horses: race.horses,
    popularity,
    factorWins,
  });
}

export function selectDangerousFirstFavorites(
  races: Race[],
): DangerousFirstFavoriteAssessment[] {
  const out: DangerousFirstFavoriteAssessment[] = [];
  for (const race of races) {
    const assessment = findDangerousFirstFavorite(race);
    if (assessment) out.push(assessment);
  }
  return out;
}
