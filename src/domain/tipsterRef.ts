/** 参考予想家の指数・印（Manual）。Scorer 入力には混ぜない。 */

export type TipsterHorseRef = {
  number: number;
  mark: string;
  secret?: string;
  name: string;
  jockey?: string;
  score: number;
  rank: number;
};

export type TipsterRaceRef = {
  raceId: string;
  venue: string;
  raceNumber: number;
  expectation?: string;
  postTime?: string;
  marksSummary?: string;
  horses: TipsterHorseRef[];
  topByScore?: TipsterHorseRef[];
};

export type TipsterRefBundle = {
  schemaVersion: number;
  source: "tipster";
  tipsterId: string;
  tipsterName: string;
  raceDate: string;
  filter?: string;
  usage: string;
  note?: string;
  referenceUrl?: string;
  extractedAt?: string;
  raceCount: number;
  races: TipsterRaceRef[];
};

export type TipsterRaceView = {
  tipsterId: string;
  tipsterName: string;
  raceDate: string;
  note?: string;
  referenceUrl?: string;
  race: TipsterRaceRef;
  byNumber: Map<number, TipsterHorseRef>;
};

export function tipsterByNumber(race: TipsterRaceRef): Map<number, TipsterHorseRef> {
  return new Map(race.horses.map((h) => [h.number, h]));
}
