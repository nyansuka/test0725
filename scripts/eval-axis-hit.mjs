/**
 * 軸 Top3 的中率（スナップ確定結果）を計測。
 *   node scripts/eval-axis-hit.mjs
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { selectAxisHorses } from "./lib/loop-domain.mjs";

const snapDir = "src/data/snapshots";
const files = readdirSync(snapDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));

let races = 0;
let axisHit = 0;
let fav3Hit = 0;
let popOfAxis = { p1to3: 0, p4to5: 0, p6to10: 0, p11: 0, slots: 0 };

for (const f of files) {
  const snap = JSON.parse(readFileSync(join(snapDir, f), "utf8"));
  for (const r of snap.races || []) {
    const win = r.result?.finishes?.find((x) => x.rank === 1);
    if (!win) continue;
    races += 1;
    const sorted = [...(r.horses || [])].sort((a, b) => a.oddsWin - b.oddsWin);
    const popOf = (n) => {
      const i = sorted.findIndex((h) => h.number === n);
      return i >= 0 ? i + 1 : 99;
    };
    const fav3 = new Set(sorted.slice(0, 3).map((h) => h.number));
    if (fav3.has(win.number)) fav3Hit += 1;

    const axis = selectAxisHorses(r);
    if (axis.some((a) => a.horseNumber === win.number)) axisHit += 1;
    for (const a of axis) {
      popOfAxis.slots += 1;
      const p = popOf(a.horseNumber);
      if (p <= 3) popOfAxis.p1to3 += 1;
      else if (p <= 5) popOfAxis.p4to5 += 1;
      else if (p <= 10) popOfAxis.p6to10 += 1;
      else popOfAxis.p11 += 1;
    }
  }
}

const pct = (x, d = races) => (d ? Number(((100 * x) / d).toFixed(1)) : null);
const share = (x) =>
  popOfAxis.slots ? Number(((100 * x) / popOfAxis.slots).toFixed(1)) : null;

const report = {
  analyzedAt: new Date().toISOString(),
  files,
  races,
  axisTop3HitPct: pct(axisHit),
  favTop3HitPct: pct(fav3Hit),
  axisHit,
  fav3Hit,
  axisSlotPopSharePct: {
    p1to3: share(popOfAxis.p1to3),
    p4to5: share(popOfAxis.p4to5),
    p6to10: share(popOfAxis.p6to10),
    p11plus: share(popOfAxis.p11),
  },
  note: "winPotential に人気ブレンド(WIN_POP_BLEND=0.62)後の計測",
};

mkdirSync("src/data/loop/reports", { recursive: true });
const out = "src/data/loop/reports/axis-hit-after-pop-prior.json";
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log("→", out);
