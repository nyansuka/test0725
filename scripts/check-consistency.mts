import { races, venues, groupRacesByVenue } from "../src/data/races";
import { selectLongshots, classifyOddsEntry } from "../src/domain/longshots";
import { DEFAULT_SETTINGS } from "../src/domain/betTypes";

const groups = groupRacesByVenue();
console.log("venues", venues.join(","));
console.log("total races", races.length);
for (const g of groups) {
  console.log(g.venue, g.races.length, `R1-R${g.races[g.races.length - 1].raceNumber}`);
}

const picks = selectLongshots(races, DEFAULT_SETTINGS);
const byBet: Record<string, number> = {};
for (const p of picks) byBet[p.betType] = (byBet[p.betType] || 0) + 1;
console.log("candidates", picks.length, byBet);

let placeCand = 0;
let placePass = 0;
let placeBelow = 0;
for (const r of races) {
  for (const e of r.oddsBoard.filter((x) => x.betType === "place")) {
    const row = classifyOddsEntry(r, e, DEFAULT_SETTINGS);
    if (row.status === "candidate") placeCand++;
    else if (row.status === "pass") placePass++;
    else if (row.status === "below_threshold") placeBelow++;
  }
}
console.log("place status cand/pass/below", placeCand, placePass, placeBelow);

const honmei = races.flatMap((r) => r.horses.map((h) => h.comment)).filter((c) => c.includes("本命"));
console.log("honmei comments", honmei.length);

const fieldMismatch = races.filter((r) => (r.fieldSize ?? 0) !== r.horses.length);
console.log("fieldSize mismatch", fieldMismatch.length);
