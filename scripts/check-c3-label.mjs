/**
 * C3 反映後のラベル整合チェック。
 *   node scripts/check-c3-label.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  selectLongshots,
  DEFAULT_SETTINGS,
  HOT_SCORE_MIN,
  HOT_SCORE_MAX,
  evaluatePick,
  isInMoney,
  findPayoutYen,
} from "./lib/loop-domain.mjs";

const settings = {
  ...DEFAULT_SETTINGS,
  enabledBetTypes: [...DEFAULT_SETTINGS.enabledBetTypes],
};

let mismatches = 0;
let hot = 0;
let keep = 0;
let hotPlace = 0;
let keepPlace = 0;
let hotTicket = 0;
let keepTicket = 0;
let scoreOutOfBandHot = 0;

for (const f of readdirSync("src/data/snapshots").filter((x) => /^\d{4}/.test(x))) {
  const snap = JSON.parse(readFileSync(join("src/data/snapshots", f), "utf8"));
  for (const race of snap.races || []) {
    if (!race.result?.finishes?.length) continue;
    for (const pick of selectLongshots([race], settings)) {
      const s = pick.relatedPlacePotential;
      const expect =
        s >= HOT_SCORE_MIN && s < HOT_SCORE_MAX ? "注目穴" : "抑え候補";
      if (pick.label !== expect) {
        mismatches += 1;
        if (mismatches <= 5) {
          console.error("label mismatch", {
            raceId: race.id,
            score: s,
            label: pick.label,
            expect,
          });
        }
      }
      const outcome = evaluatePick(pick, race.result);
      if (outcome === "pending") continue;
      const placed = isInMoney(outcome);
      const pay = findPayoutYen(race.result, pick.betType, pick.selection);
      const ticket =
        (pay != null && pay > 0) || (outcome === "win" && pick.betType === "win");
      if (pick.label === "注目穴") {
        hot += 1;
        if (s < HOT_SCORE_MIN || s >= HOT_SCORE_MAX) scoreOutOfBandHot += 1;
        if (placed) hotPlace += 1;
        if (ticket) hotTicket += 1;
      } else {
        keep += 1;
        if (placed) keepPlace += 1;
        if (ticket) keepTicket += 1;
      }
    }
  }
}

const pct = (n, d) => (d ? Number(((100 * n) / d).toFixed(2)) : null);
const report = {
  ok: mismatches === 0 && scoreOutOfBandHot === 0,
  mismatches,
  scoreOutOfBandHot,
  hotBand: `[${HOT_SCORE_MIN}, ${HOT_SCORE_MAX})`,
  settings: {
    oddsThreshold: settings.oddsThreshold,
    oddsMax: settings.oddsMax,
    scoreMin: settings.scoreMin,
  },
  counts: { hot, keep },
  placeP: { hot: pct(hotPlace, hot), keep: pct(keepPlace, keep) },
  ticketP: { hot: pct(hotTicket, hot), keep: pct(keepTicket, keep) },
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
