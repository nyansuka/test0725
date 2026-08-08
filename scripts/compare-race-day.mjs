/**
 * 2開催日の evaluate メトリクスを突合する。
 *
 *   node scripts/compare-race-day.mjs 2026-08-08 2026-08-09
 *   npm run loop:compare -- 2026-08-08 2026-08-09
 *
 * 基準日に src/data/loop/reports/analyze-YYYY-MM-DD.json があれば
 * settings / nextActions も併記する。
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEval(date) {
  const p = path.join(root, "src/data/loop/evaluations", `${date}.json`);
  if (!existsSync(p)) throw new Error(`missing evaluation: ${p}`);
  return JSON.parse(readFileSync(p, "utf8"));
}

function loadAnalyze(date) {
  const p = path.join(root, "src/data/loop/reports", `analyze-${date}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

function pct(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return null;
  return Number((n * 100).toFixed(digits));
}

function pickMetrics(e) {
  const m = e.metrics;
  return {
    settings: e.settings,
    candidates: m.candidates,
    density: Number(m.density.toFixed(2)),
    ticketHits: m.ticketHits,
    ticketPrecision: m.ticketPrecision,
    placePrecision: m.placePrecision,
    recall: m.recall,
    virtualReturnRatePercent: m.virtualReturnRatePercent,
    axisWinRate: m.axisWinRate ?? null,
    superWinRate: m.superWinRate ?? null,
    superPlaceRate:
      m.superSettled > 0 ? m.superPlace / m.superSettled : null,
  };
}

function delta(a, b) {
  if (a == null || b == null) return null;
  return Number((b - a).toFixed(4));
}

function main() {
  const [baseDate, nextDate] = process.argv.slice(2);
  if (!baseDate || !nextDate) {
    console.error("Usage: node scripts/compare-race-day.mjs <baseDate> <nextDate>");
    process.exit(1);
  }

  const baseEval = loadEval(baseDate);
  const nextEval = loadEval(nextDate);
  const base = pickMetrics(baseEval);
  const next = pickMetrics(nextEval);
  const analyze = loadAnalyze(baseDate);

  const comparison = {
    kind: "race-day-compare",
    builtAt: new Date().toISOString(),
    primaryMetric: "ticketPrecision",
    baseDate,
    nextDate,
    base,
    next,
    deltas: {
      candidates: delta(base.candidates, next.candidates),
      density: delta(base.density, next.density),
      ticketHits: delta(base.ticketHits, next.ticketHits),
      ticketPrecisionPp: delta(pct(base.ticketPrecision), pct(next.ticketPrecision)),
      placePrecisionPp: delta(pct(base.placePrecision), pct(next.placePrecision)),
      recallPp: delta(pct(base.recall), pct(next.recall)),
      virtualReturnRatePp: delta(
        base.virtualReturnRatePercent,
        next.virtualReturnRatePercent,
      ),
    },
    settingsChanged:
      JSON.stringify(base.settings) !== JSON.stringify(next.settings),
    baselineAnalyze: analyze
      ? {
          builtAt: analyze.builtAt,
          nextActions: analyze.nextActions,
          improvements: analyze.improvements,
        }
      : null,
    verdictHints: [],
  };

  const d = comparison.deltas;
  if (d.ticketPrecisionPp != null && d.ticketPrecisionPp > 0) {
    comparison.verdictHints.push("ticketPrecision improved vs baseline");
  } else if (d.ticketPrecisionPp != null && d.ticketPrecisionPp < 0) {
    comparison.verdictHints.push("ticketPrecision worsened vs baseline");
  }
  if (next.density > 15) {
    comparison.verdictHints.push("density still above target band 5-15");
  } else if (next.density >= 5 && next.density <= 15) {
    comparison.verdictHints.push("density inside target band 5-15");
  }
  if (comparison.settingsChanged) {
    comparison.verdictHints.push(
      "settings differ — attribute carefully (one-change rule)",
    );
  }

  const outDir = path.join(root, "src/data/loop/reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `compare-${baseDate}_${nextDate}.json`);
  writeFileSync(outPath, JSON.stringify(comparison, null, 2));

  console.log(`Compare ${baseDate} → ${nextDate}`);
  console.log(
    `  ticketP  ${pct(base.ticketPrecision)}% → ${pct(next.ticketPrecision)}%  (Δ ${d.ticketPrecisionPp} pp)`,
  );
  console.log(
    `  placeP   ${pct(base.placePrecision)}% → ${pct(next.placePrecision)}%  (Δ ${d.placePrecisionPp} pp)`,
  );
  console.log(
    `  density  ${base.density} → ${next.density}  (Δ ${d.density})`,
  );
  console.log(
    `  ticketHits ${base.ticketHits} → ${next.ticketHits}  candidates ${base.candidates} → ${next.candidates}`,
  );
  console.log(
    `  vRR      ${base.virtualReturnRatePercent}% → ${next.virtualReturnRatePercent}%`,
  );
  if (comparison.settingsChanged) {
    console.log("  settings BASE", JSON.stringify(base.settings));
    console.log("  settings NEXT", JSON.stringify(next.settings));
  } else {
    console.log("  settings unchanged", JSON.stringify(next.settings));
  }
  for (const h of comparison.verdictHints) console.log(`  · ${h}`);
  console.log(`Wrote ${outPath}`);
}

main();
