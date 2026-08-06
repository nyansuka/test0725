/**
 * C3: 注目穴ラベル境界の感度。
 * 固定: odds 25 / max 80 / scoreMin 60
 *   node scripts/sweep-label-threshold.mjs
 *
 * 現行は score>=T → 注目穴だが、C1/C2 後は高スコアほど place が悪化。
 * 候補:
 *   - ge: score >= T → 注目穴（旧方式）
 *   - lt: score < T → 注目穴（上限キャップ方式）
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  selectLongshots,
  evaluatePick,
  isInMoney,
  findPayoutYen,
  DEFAULT_SETTINGS,
} from "./lib/loop-domain.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const snapDir = join(root, "src/data/snapshots");
const outDir = join(root, "src/data/loop/reports");

function pct(n, d, digits = 1) {
  if (!d) return null;
  return Number(((100 * n) / d).toFixed(digits));
}

function loadRaces() {
  const files = readdirSync(snapDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  const races = [];
  for (const f of files) {
    const snap = JSON.parse(readFileSync(join(snapDir, f), "utf8"));
    for (const r of snap.races || []) {
      if (r.result?.finishes?.length) races.push(r);
    }
  }
  return { files, races };
}

function evalMode(races, mode, T) {
  const settings = {
    ...DEFAULT_SETTINGS,
    scoreMin: 60,
    enabledBetTypes: [...DEFAULT_SETTINGS.enabledBetTypes],
  };
  const buckets = {
    注目穴: { n: 0, place: 0, ticket: 0 },
    抑え候補: { n: 0, place: 0, ticket: 0 },
  };

  for (const race of races) {
    const picks = selectLongshots([race], settings);
    for (const pick of picks) {
      const outcome = evaluatePick(pick, race.result);
      if (outcome === "pending") continue;
      const score = pick.relatedPlacePotential;
      const label =
        mode === "ge"
          ? score >= T
            ? "注目穴"
            : "抑え候補"
          : score < T
            ? "注目穴"
            : "抑え候補";
      const b = buckets[label];
      b.n += 1;
      if (isInMoney(outcome)) b.place += 1;
      const pay = findPayoutYen(race.result, pick.betType, pick.selection);
      if ((pay != null && pay > 0) || (outcome === "win" && pick.betType === "win")) {
        b.ticket += 1;
      }
    }
  }

  const hot = buckets["注目穴"];
  const keep = buckets["抑え候補"];
  const hotPlace = pct(hot.place, hot.n);
  const keepPlace = pct(keep.place, keep.n);
  const hotTicket = pct(hot.ticket, hot.n, 2);
  const keepTicket = pct(keep.ticket, keep.n, 2);
  const placeDelta =
    hotPlace != null && keepPlace != null
      ? Number((hotPlace - keepPlace).toFixed(1))
      : null;
  const ticketDelta =
    hotTicket != null && keepTicket != null
      ? Number((hotTicket - keepTicket).toFixed(2))
      : null;

  // 成功: 注目穴 place ≥ 抑え、かつ注目穴が極端に少なくない（≥5% of labeled）
  const total = hot.n + keep.n;
  const hotShare = pct(hot.n, total);
  let fitness = 0;
  if (placeDelta != null && placeDelta >= 0) fitness += 4;
  else if (placeDelta != null && placeDelta >= -3) fitness += 1;
  if (ticketDelta != null && ticketDelta >= 0) fitness += 2;
  if (hotShare != null && hotShare >= 15 && hotShare <= 70) fitness += 2;
  else if (hotShare != null && hotShare >= 5 && hotShare <= 85) fitness += 1;
  if (hot.n >= 50) fitness += 1;

  return {
    mode,
    threshold: T,
    hotN: hot.n,
    keepN: keep.n,
    hotSharePct: hotShare,
    hotPlaceP: hotPlace,
    keepPlaceP: keepPlace,
    placeDeltaPp: placeDelta,
    hotTicketP: hotTicket,
    keepTicketP: keepTicket,
    ticketDeltaPp: ticketDelta,
    fitness,
  };
}

function main() {
  const { files, races } = loadRaces();
  const rows = [];
  for (const mode of ["ge", "lt"]) {
    for (let T = 61; T <= 72; T++) {
      rows.push(evalMode(races, mode, T));
    }
  }
  rows.sort(
    (a, b) =>
      b.fitness - a.fitness ||
      (b.placeDeltaPp ?? -99) - (a.placeDeltaPp ?? -99) ||
      (b.ticketDeltaPp ?? -99) - (a.ticketDeltaPp ?? -99),
  );

  const best = rows[0];
  const report = {
    analyzedAt: new Date().toISOString(),
    settings: { ...DEFAULT_SETTINGS, scoreMin: 60 },
    files,
    races: races.length,
    note: "ge: score>=T→注目穴 / lt: score<T→注目穴（高スコア逆指標向け上限）",
    recommendation: best,
    rows,
  };

  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, "label-threshold-sweep.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        recommendation: best,
        top5: rows.slice(0, 5),
      },
      null,
      2,
    ),
  );
  console.log("→", out);
}

main();
