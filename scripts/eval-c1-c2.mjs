/**
 * C1/C2 反映後のスコア帯別 place / ticket / gatedOppRecall。
 *   node scripts/eval-c1-c2.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  selectLongshots,
  DEFAULT_SETTINGS,
  evaluatePick,
  findPayoutYen,
  isInMoney,
  LABEL_SCORE_THRESHOLD,
} from "./lib/loop-domain.mjs";
import { valueGapFromPopularity } from "../src/domain/scoring/deriveFactors.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const snapDir = join(root, "src/data/snapshots");
const outDir = join(root, "src/data/loop/reports");

function pct(n, d, digits = 1) {
  if (!d) return null;
  return Number(((100 * n) / d).toFixed(digits));
}

function band(score) {
  if (score >= 85) return "85+";
  if (score >= 80) return "80-84";
  if (score >= 75) return "75-79";
  if (score >= 70) return "70-74";
  return "60-69";
}

function main() {
  const files = readdirSync(snapDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();

  const byBand = {};
  for (const b of ["85+", "80-84", "75-79", "70-74", "60-69"]) {
    byBand[b] = { n: 0, place: 0, ticket: 0 };
  }

  let candidates = 0;
  let placeHits = 0;
  let ticketHits = 0;
  let labelHot = { n: 0, place: 0 };
  let labelKeep = { n: 0, place: 0 };
  let gatedOpp = 0;
  let gatedCaught = 0;
  let formCoverage = { with: 0, without: 0 };

  for (const f of files) {
    const snap = JSON.parse(readFileSync(join(snapDir, f), "utf8"));
    for (const race of snap.races || []) {
      if (!race.result?.finishes?.length) continue;
      for (const h of race.horses || []) {
        if (h.formStats?.lastRank != null) formCoverage.with += 1;
        else formCoverage.without += 1;
      }
      const picks = selectLongshots([race], DEFAULT_SETTINGS);
      candidates += picks.length;

      const finishes = race.result.finishes.filter((x) => x.rank >= 1 && x.rank <= 3);
      const popSorted = [...(race.horses || [])].sort(
        (a, b) => (a.oddsWin ?? 999) - (b.oddsWin ?? 999),
      );
      const popOf = (n) => {
        const i = popSorted.findIndex((h) => h.number === n);
        return i >= 0 ? i + 1 : null;
      };
      const gatedNums = new Set();
      for (const fin of finishes) {
        const pop = fin.popularity ?? popOf(fin.number);
        if (pop == null || pop < 6) continue;
        const horse = (race.horses || []).find((h) => h.number === fin.number);
        const odds = fin.oddsWin ?? horse?.oddsWin;
        const inGate =
          odds != null &&
          odds >= DEFAULT_SETTINGS.oddsThreshold &&
          (DEFAULT_SETTINGS.oddsMax == null || odds <= DEFAULT_SETTINGS.oddsMax);
        const boardHit = (race.oddsBoard || []).some((e) => {
          if (e.odds < DEFAULT_SETTINGS.oddsThreshold) return false;
          if (DEFAULT_SETTINGS.oddsMax != null && e.odds > DEFAULT_SETTINGS.oddsMax) return false;
          return String(e.selection).split(/[-–]/).map(Number).includes(fin.number);
        });
        if (inGate || boardHit) gatedNums.add(fin.number);
      }
      if (gatedNums.size) {
        gatedOpp += 1;
        if (picks.some((p) => (p.relatedHorseNumbers || []).some((n) => gatedNums.has(n)))) {
          gatedCaught += 1;
        }
      }

      for (const pick of picks) {
        const outcome = evaluatePick(pick, race.result);
        if (outcome === "pending") continue;
        const score = pick.relatedPlacePotential;
        const b = band(score);
        byBand[b].n += 1;
        const placed = isInMoney(outcome);
        if (placed) {
          byBand[b].place += 1;
          placeHits += 1;
        }
        const pay = findPayoutYen(race.result, pick.betType, pick.selection);
        const ticket =
          (pay != null && pay > 0) || (outcome === "win" && pick.betType === "win");
        if (ticket) {
          byBand[b].ticket += 1;
          ticketHits += 1;
        }
        if (pick.label === "注目穴" || score >= LABEL_SCORE_THRESHOLD) {
          labelHot.n += 1;
          if (placed) labelHot.place += 1;
        } else {
          labelKeep.n += 1;
          if (placed) labelKeep.place += 1;
        }
      }
    }
  }

  const report = {
    analyzedAt: new Date().toISOString(),
    change: "C1/C2 valueGap from popularity + formSignal from formStats",
    settings: DEFAULT_SETTINGS,
    files,
    candidates,
    placePrecisionPct: pct(placeHits, candidates),
    ticketPrecisionPct: pct(ticketHits, candidates, 2),
    gatedOppRecallPct: pct(gatedCaught, gatedOpp),
    gatedOpp,
    gatedCaught,
    labelPlacePct: {
      注目穴: pct(labelHot.place, labelHot.n),
      抑え候補: pct(labelKeep.place, labelKeep.n),
      hotN: labelHot.n,
      keepN: labelKeep.n,
    },
    scoreBandPlacePct: Object.fromEntries(
      Object.entries(byBand).map(([k, v]) => [
        k,
        { n: v.n, placeP: pct(v.place, v.n), ticketP: pct(v.ticket, v.n, 2) },
      ]),
    ),
    formStatsCoveragePct: pct(formCoverage.with, formCoverage.with + formCoverage.without),
    valueGapTableSample: [1, 3, 5, 6, 7, 10, 12, 16].map((p) => ({
      popularity: p,
      valueGap: valueGapFromPopularity(p),
    })),
    note: "成功条件: 高スコア帯の place が低スコア帯より悪くないこと（逆指標解消）",
  };

  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, "c1-c2-after.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log("→", out);
}

main();
