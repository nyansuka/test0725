/**
 * レース期待度 S〜D の再キャリブ感度。
 *   node scripts/sweep-expectation-rank.mjs
 *
 * 固定: DEFAULT_SETTINGS（25/80/75）· 結果付きスナップショット
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
} from "./lib/loop-domain.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const snapDir = join(root, "src/data/snapshots");
const outDir = join(root, "src/data/loop/reports");

const LABEL = 70;
const RANKS = ["S", "A", "B", "C", "D"];

function pct(n, d, digits = 2) {
  if (!d) return null;
  return Number(((100 * n) / d).toFixed(digits));
}

/** 現行（件数ボーナス） */
function rankCurrent(picks) {
  if (picks.length === 0) return "D";
  const top = Math.max(...picks.map((p) => p.relatedPlacePotential));
  const highCount = picks.filter((p) => p.relatedPlacePotential >= LABEL).length;
  const edge = Math.min(
    100,
    top * 0.7 + Math.min(highCount, 4) * 8 + Math.min(picks.length, 6) * 3,
  );
  if (edge >= 85 && highCount >= 2) return "S";
  if (edge >= 70) return "A";
  if (edge >= 55) return "B";
  if (edge >= 40) return "C";
  return "D";
}

/**
 * 件数ペナルティ版:
 * edge = top*0.75 + min(high,3)*10 - max(0, n-3)*4  （件数は3超で減点）
 * S: edge≥78 かつ high≥2 かつ n≤8
 * A: ≥65 / B: ≥52 / C: ≥40
 */
function rankCountPenalty(picks) {
  if (picks.length === 0) return "D";
  const top = Math.max(...picks.map((p) => p.relatedPlacePotential));
  const highCount = picks.filter((p) => p.relatedPlacePotential >= LABEL).length;
  const n = picks.length;
  const edge = Math.min(
    100,
    Math.max(0, top * 0.75 + Math.min(highCount, 3) * 10 - Math.max(0, n - 3) * 4),
  );
  if (edge >= 78 && highCount >= 2 && n <= 8) return "S";
  if (edge >= 65) return "A";
  if (edge >= 52) return "B";
  if (edge >= 40) return "C";
  return "D";
}

/**
 * 質優先（件数ほぼ無視）:
 * edge = top*0.85 + min(high,2)*8
 * S: top≥82 かつ high≥2
 * A: top≥78 / B: top≥75 / C: 候補あり
 */
function rankQualityFirst(picks) {
  if (picks.length === 0) return "D";
  const top = Math.max(...picks.map((p) => p.relatedPlacePotential));
  const highCount = picks.filter((p) => p.relatedPlacePotential >= LABEL).length;
  if (top >= 82 && highCount >= 2) return "S";
  if (top >= 78) return "A";
  if (top >= 75) return "B";
  if (picks.length > 0) return "C";
  return "D";
}

/** スコア用メタ（日内相対で使う） */
function raceScoreMeta(picks) {
  if (picks.length === 0) {
    return { top: 0, highCount: 0, n: 0, edge: 0 };
  }
  const top = Math.max(...picks.map((p) => p.relatedPlacePotential));
  const highCount = picks.filter((p) => p.relatedPlacePotential >= LABEL).length;
  const n = picks.length;
  const edge = Math.max(
    0,
    top * 0.75 + Math.min(highCount, 3) * 10 - Math.max(0, n - 3) * 4,
  );
  return { top, highCount, n, edge };
}

/**
 * 日内相対: 候補ありレースを edge 降順で
 * 上位 ~12% → S, 次 ~20% → A, 次 ~25% → B, 残り候補あり → C, なし → D
 */
function assignRelativeDay(raceMetas) {
  const withPicks = raceMetas
    .filter((r) => r.n > 0)
    .sort((a, b) => b.edge - a.edge || b.top - a.top);
  const m = withPicks.length;
  const ranks = new Map(raceMetas.map((r) => [r.raceId, "D"]));
  if (m === 0) return ranks;

  const sCut = Math.max(1, Math.ceil(m * 0.12));
  const aCut = Math.max(sCut + 1, Math.ceil(m * 0.32));
  const bCut = Math.max(aCut + 1, Math.ceil(m * 0.57));

  withPicks.forEach((r, i) => {
    let rank = "C";
    if (i < sCut && r.highCount >= 1) rank = "S";
    else if (i < aCut) rank = "A";
    else if (i < bCut) rank = "B";
    ranks.set(r.raceId, rank);
  });
  return ranks;
}

function emptyBucket() {
  return {
    races: 0,
    candidates: 0,
    settled: 0,
    placeHits: 0,
    ticketHits: 0,
  };
}

function evaluateVariant(name, raceRows, rankByRaceId) {
  const buckets = Object.fromEntries(RANKS.map((r) => [r, emptyBucket()]));
  for (const row of raceRows) {
    const rank = rankByRaceId.get(row.raceId) ?? "D";
    const b = buckets[rank];
    b.races += 1;
    b.candidates += row.picks.length;
    for (const pick of row.picks) {
      const outcome = evaluatePick(pick, row.result);
      if (outcome === "pending") continue;
      b.settled += 1;
      if (isInMoney(outcome)) b.placeHits += 1;
      const pay = findPayoutYen(row.result, pick.betType, pick.selection);
      if (pay != null && pay > 0) b.ticketHits += 1;
      else if (outcome === "win" && pick.betType === "win") b.ticketHits += 1;
    }
  }

  const byRank = {};
  for (const r of RANKS) {
    const b = buckets[r];
    byRank[r] = {
      races: b.races,
      raceSharePct: pct(b.races, raceRows.length, 1),
      candidates: b.candidates,
      dens: raceRows.length ? Number((b.candidates / Math.max(1, b.races)).toFixed(1)) : 0,
      placeP: pct(b.placeHits, b.settled, 1),
      ticketP: pct(b.ticketHits, b.settled, 2),
      placeHits: b.placeHits,
      ticketHits: b.ticketHits,
      settled: b.settled,
    };
  }

  // 識別性: S の ticketP - 全体 ticketP、および S レース率が 5–20% 帯か
  const allSettled = RANKS.reduce((s, r) => s + buckets[r].settled, 0);
  const allTickets = RANKS.reduce((s, r) => s + buckets[r].ticketHits, 0);
  const sShare = byRank.S.raceSharePct ?? 0;
  const sTicket = byRank.S.ticketP;
  const overallTicket = pct(allTickets, allSettled, 2);
  const delta = sTicket != null && overallTicket != null ? Number((sTicket - overallTicket).toFixed(2)) : null;

  let score = 0;
  if (sShare >= 5 && sShare <= 20) score += 3;
  else if (sShare > 0 && sShare < 30) score += 1;
  if (delta != null && delta > 0) score += 2;
  if (delta != null && delta >= 1) score += 2;
  // 単調性（placeP）ざっくり
  const places = RANKS.map((r) => byRank[r].placeP).filter((x) => x != null);
  let mono = true;
  for (let i = 1; i < places.length; i++) {
    if (places[i] > places[i - 1] + 5) mono = false; // 下位が大幅に上なら NG
  }
  if (mono) score += 1;

  return {
    name,
    overallTicketP: overallTicket,
    sTicketDeltaPp: delta,
    fitnessScore: score,
    byRank,
  };
}

function loadRaceRows() {
  const files = readdirSync(snapDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  const rows = [];
  for (const f of files) {
    const snap = JSON.parse(readFileSync(join(snapDir, f), "utf8"));
    const date = snap.raceDate || f.replace(/\.json$/, "");
    for (const race of snap.races || []) {
      if (race.authority !== "JRA") continue;
      if (!race.result?.finishes?.length) continue;
      const picks = selectLongshots([race], DEFAULT_SETTINGS);
      rows.push({
        raceId: race.id,
        date,
        result: race.result,
        picks,
        meta: raceScoreMeta(picks),
      });
    }
  }
  return { files, rows };
}

function main() {
  const { files, rows } = loadRaceRows();
  const settings = DEFAULT_SETTINGS;

  const currentMap = new Map(rows.map((r) => [r.raceId, rankCurrent(r.picks)]));
  const penaltyMap = new Map(rows.map((r) => [r.raceId, rankCountPenalty(r.picks)]));
  const qualityMap = new Map(rows.map((r) => [r.raceId, rankQualityFirst(r.picks)]));

  // 日内相対
  const relativeMap = new Map();
  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push({
      raceId: r.raceId,
      ...r.meta,
    });
  }
  for (const [, dayRows] of byDate) {
    const dayRanks = assignRelativeDay(dayRows);
    for (const [id, rank] of dayRanks) relativeMap.set(id, rank);
  }

  // ハイブリッド: 件数ペナルティの絶対閾値だが S は日内上位のみ
  const hybridMap = new Map();
  for (const [, dayRows] of byDate) {
    const withPicks = dayRows.filter((r) => r.n > 0).sort((a, b) => b.edge - a.edge || b.top - a.top);
    const sCut = Math.max(1, Math.ceil(withPicks.length * 0.15));
    const sIds = new Set(withPicks.slice(0, sCut).map((r) => r.raceId));
    for (const r of dayRows) {
      let rank = rankCountPenalty(
        rows.find((x) => x.raceId === r.raceId)?.picks ?? [],
      );
      if (rank === "S" && !sIds.has(r.raceId)) rank = "A";
      if (sIds.has(r.raceId) && r.highCount >= 1 && r.n > 0 && r.n <= 8) {
        // 日内上位でも絶対条件が弱すぎる場合は A に落とさないよう、edge ベースで昇格
        const abs = rankCountPenalty(rows.find((x) => x.raceId === r.raceId)?.picks ?? []);
        if (abs === "S" || abs === "A") rank = "S";
        else if (abs === "B") rank = "A";
      }
      hybridMap.set(r.raceId, rank);
    }
  }

  const variants = [
    evaluateVariant("current_count_bonus", rows, currentMap),
    evaluateVariant("count_penalty", rows, penaltyMap),
    evaluateVariant("quality_first", rows, qualityMap),
    evaluateVariant("day_relative", rows, relativeMap),
    evaluateVariant("hybrid_penalty_day_s", rows, hybridMap),
  ].sort((a, b) => b.fitnessScore - a.fitnessScore || (b.sTicketDeltaPp ?? -99) - (a.sTicketDeltaPp ?? -99));

  const report = {
    analyzedAt: new Date().toISOString(),
    settings,
    files,
    races: rows.length,
    candidatesTotal: rows.reduce((s, r) => s + r.picks.length, 0),
    variants,
    recommendation: variants[0]?.name ?? null,
    note: "fitness: S share 5–20% + S ticketP uplift + おおむね単調",
  };

  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, "expectation-rank-sweep.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        races: report.races,
        recommendation: report.recommendation,
        variants: variants.map((v) => ({
          name: v.name,
          fitness: v.fitnessScore,
          sShare: v.byRank.S.raceSharePct,
          sTicketP: v.byRank.S.ticketP,
          sDelta: v.sTicketDeltaPp,
          aShare: v.byRank.A.raceSharePct,
          dShare: v.byRank.D.raceSharePct,
        })),
      },
      null,
      2,
    ),
  );
  console.log("→", out);
}

main();
