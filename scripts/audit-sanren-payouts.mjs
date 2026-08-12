/**
 * S1 監査: 複数日で trio/trifecta 払戻が 3 脚・lookup 可能か、evaluate に載るか。
 *   node scripts/audit-sanren-payouts.mjs
 */
import fs from "node:fs";
import { findPayoutYen } from "./lib/loop-domain.mjs";

const dates = process.argv.slice(2);
const targets =
  dates.length > 0
    ? dates
    : ["2026-07-25", "2026-08-02", "2026-08-08", "2026-08-09"];

function audit(date) {
  const live = JSON.parse(fs.readFileSync(`src/data/snapshots/${date}.json`, "utf8"));
  const evPath = `src/data/loop/evaluations/${date}.json`;
  const ev = fs.existsSync(evPath) ? JSON.parse(fs.readFileSync(evPath, "utf8")) : null;

  let resultTrio = 0;
  let resultTrifecta = 0;
  let legsOk = 0;
  let legsBad = 0;
  let lookupOk = 0;
  let lookupFail = 0;

  for (const r of live.races ?? []) {
    for (const bt of ["trio", "trifecta"]) {
      const p = (r.result?.payouts ?? []).find((x) => x.betType === bt && x.payoutYen > 0);
      if (!p) continue;
      if (bt === "trio") resultTrio += 1;
      else resultTrifecta += 1;
      const legs = String(p.selection).split("-").filter(Boolean).length;
      if (legs === 3) legsOk += 1;
      else legsBad += 1;
      const yen = findPayoutYen(r.result, bt, p.selection);
      if (yen === p.payoutYen) lookupOk += 1;
      else lookupFail += 1;
    }
  }

  const rows = (ev?.rows ?? []).filter((r) => r.betType === "trio" || r.betType === "trifecta");
  const payRows = rows.filter((r) => typeof r.payoutYen === "number" && r.payoutYen > 0);

  return {
    date,
    races: live.races?.length ?? 0,
    resultTrioPayouts: resultTrio,
    resultTrifectaPayouts: resultTrifecta,
    threeLegOk: legsOk,
    threeLegBad: legsBad,
    lookupOk,
    lookupFail,
    evalCandidateRows: rows.length,
    evalPayoutYenGt0: payRows.length,
    evalTicketHitsTrio: ev?.byBetType?.trio?.ticketHits ?? null,
    evalTicketHitsTrifecta: ev?.byBetType?.trifecta?.ticketHits ?? null,
    ok:
      resultTrio > 0 &&
      resultTrifecta > 0 &&
      legsBad === 0 &&
      lookupFail === 0,
  };
}

const rows = targets.map(audit);
for (const row of rows) {
  console.log(JSON.stringify(row));
}
const pass = rows.filter((r) => r.ok).length;
console.log(`S1_RESULT ${pass}/${rows.length} days ok (need >=2)`);
if (pass < 2) process.exitCode = 1;
