/**
 * 的中時の表示オッズは確定払戻（100円あたり）と一致すること。
 *   npx tsx scripts/test-display-odds.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_SETTINGS } from "../src/domain/betTypes.ts";
import { selectLongshots } from "../src/domain/longshots.ts";
import { oddsFromPayoutYen } from "../src/domain/odds.ts";
import {
  displayHorsePlaceOddsLabel,
  displayHorseWinOdds,
  displayTicketOdds,
  findPayoutYen,
} from "../src/domain/results.ts";

assert.equal(oddsFromPayoutYen(7530), 75.3);
assert.equal(oddsFromPayoutYen(110), 1.1);

const snap = JSON.parse(
  readFileSync(new URL("../src/data/snapshots/2026-09-05.json", import.meta.url), "utf8"),
);
const race = snap.races.find((r) => r.id === "sapporo-20260905-3");
assert.ok(race, "sapporo 3R snapshot");

const horse = race.horses.find((h) => h.number === 2);
assert.equal(horse.oddsWin, 41.4, "frozen morning odds stay on the horse record");
assert.equal(displayHorseWinOdds(horse, race), 75.3);
assert.equal(displayHorsePlaceOddsLabel(horse, race), "10.6倍");

const winPick = { betType: "win", selection: "2", odds: horse.oddsWin };
assert.equal(displayTicketOdds(winPick, race.result), 75.3);
assert.equal(displayTicketOdds(winPick, undefined), 41.4);
assert.equal(displayTicketOdds({ ...winPick, odds: null }, race.result), null);

const picks = selectLongshots([race], DEFAULT_SETTINGS);
const shown = picks.find((p) => p.betType === "win" && p.selection === "2");
assert.ok(shown, "win pick for ペイシャクロス");
assert.equal(shown.odds, 41.4, "gating still uses frozen odds");
assert.equal(displayTicketOdds(shown, race.result), 75.3);
assert.equal(findPayoutYen(race.result, "win", "2"), 7530);

let mismatched = 0;
for (const r of snap.races) {
  for (const p of r.result?.payouts ?? []) {
    if (p.betType !== "win" || !(p.payoutYen > 0)) continue;
    const h = r.horses.find((x) => String(x.number) === p.selection);
    if (!h) continue;
    const shownOdds = displayHorseWinOdds(h, r);
    const official = oddsFromPayoutYen(p.payoutYen);
    if (shownOdds !== official) mismatched += 1;
  }
}
assert.equal(mismatched, 0, "all win payouts match displayed win odds");

console.log("OK display odds: frozen 41.4 → official 75.3 next to ¥7,530");
