/**
 * 設定ゲート内の券種的中（払戻）を蓄積する。
 * 選別ロジックは変えない。本体 / 3連複 / 3連単はレーン分離（合算しない）。
 *
 *   node scripts/loop-hits.mjs
 *   node scripts/loop-hits.mjs 2026-08-30
 */
import { mkdir, readdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SETTINGS,
  classifyOddsEntry,
  parseSelectionNumbers,
  popularityByNumber,
} from "./lib/loop-domain.mjs";
import { DEFAULT_TRIO_LANE, DEFAULT_TRIFECTA_LANE } from "./lib/sanren-lab-domain.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const loopRoot = path.join(root, "src", "data", "loop");
const liveSnapDir = path.join(root, "src", "data", "snapshots");
const hitsDir = path.join(loopRoot, "hits");

const UNORDERED = new Set(["quinella", "wide", "bracket_quinella", "trio"]);
const SANREN_BETS = new Set(["trio", "trifecta"]);
/** 本体的中帳。3連系は研究所レーン専用 */
export const MAIN_BET_TYPES = [
  "win",
  "place",
  "bracket_quinella",
  "bracket_exacta",
  "quinella",
  "wide",
  "exacta",
];

function emptyCoverage() {
  return { payouts: 0, onBoard: 0, gated: 0, knownGated: 0, picked: 0 };
}

function mainBetTypeSet(settings) {
  const enabled = new Set(settings.enabledBetTypes ?? DEFAULT_SETTINGS.enabledBetTypes);
  return new Set(MAIN_BET_TYPES.filter((t) => enabled.has(t) && !SANREN_BETS.has(t)));
}

function selKey(betType, selection) {
  const nums = parseSelectionNumbers(selection);
  const legs = UNORDERED.has(betType) ? [...nums].sort((a, b) => a - b) : nums;
  return `${betType}:${legs.join("-")}`;
}

function oddsBand(odds, lane) {
  if (odds == null || !Number.isFinite(odds)) return "不明";
  if (lane === "trio") {
    if (odds < 150) return "100-149";
    if (odds < 300) return "150-299";
    if (odds < 500) return "300-499";
    return "500+";
  }
  if (lane === "trifecta") {
    if (odds < 500) return "200-499";
    if (odds < 1000) return "500-999";
    return "1000+";
  }
  if (odds < 50) return "25-49";
  if (odds < 80) return "50-79";
  return "80+";
}

export function parseDistanceM(distance) {
  const m = String(distance ?? "").match(/(\d+)\s*m/i);
  return m ? Number(m[1]) : null;
}

export function distanceBand(meters) {
  if (meters == null) return "不明";
  if (meters < 1400) return "〜1200";
  if (meters < 1800) return "1400-1600";
  if (meters < 2200) return "1800-2000";
  return "2200+";
}

export function classBand(title) {
  const t = String(title ?? "");
  if (/障害/.test(t)) return "障害";
  if (/新馬/.test(t)) return "新馬";
  if (/未勝利/.test(t)) return "未勝利";
  if (/1勝/.test(t)) return "1勝";
  if (/2勝/.test(t)) return "2勝";
  if (/3勝/.test(t)) return "3勝";
  if (/\bG1\b|GI/.test(t)) return "G1";
  if (/\bG2\b|GII/.test(t)) return "G2";
  if (/\bG3\b|GIII/.test(t)) return "G3";
  return "特別他";
}

export function fieldBand(n) {
  if (n == null || !Number.isFinite(n)) return "不明";
  if (n <= 10) return "〜10頭";
  if (n <= 14) return "11-14頭";
  return "15頭+";
}

function weekdayJa(ymd) {
  const d = new Date(`${ymd}T12:00:00+09:00`);
  return ["日", "月", "火", "水", "木", "金", "土"][d.getDay()] ?? "不明";
}

function trackBand(track, distance) {
  const raw = String(track ?? distance ?? "");
  if (/障/.test(raw)) return "障害";
  if (/ダ/.test(raw)) return "ダート";
  if (/芝/.test(raw)) return "芝";
  return "不明";
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p) {
  return JSON.parse(await readFile(p, "utf8"));
}

function frozenBoardEntry(frozenRace, betType, selection) {
  const want = selKey(betType, selection);
  for (const e of frozenRace.oddsBoard ?? []) {
    if (e.betType !== betType) continue;
    if (selKey(e.betType, e.selection) === want) return e;
  }
  return null;
}

function horseChips(race, selection, betType) {
  const pops = popularityByNumber(race.horses ?? []);
  const nums = parseSelectionNumbers(selection);
  const isBracket = betType === "bracket_quinella" || betType === "bracket_exacta";
  const horses = isBracket
    ? (race.horses ?? []).filter((h) => h.bracket != null && nums.includes(h.bracket))
    : nums.map((n) => (race.horses ?? []).find((x) => x.number === n)).filter(Boolean);
  if (horses.length === 0) {
    return nums.map((n) => ({ number: n, name: `#${n}`, popularity: null }));
  }
  return horses.map((h) => ({
    number: h.number,
    name: h.name ?? `#${h.number}`,
    popularity: pops.get(h.number) ?? null,
  }));
}

function pickIndex(picks) {
  const set = new Set();
  for (const p of picks ?? []) {
    set.add(`${p.raceId}|${selKey(p.betType, p.selection)}`);
  }
  return set;
}

function findPick(picks, raceId, betType, selection) {
  const want = selKey(betType, selection);
  return (picks ?? []).find((p) => p.raceId === raceId && selKey(p.betType, p.selection) === want);
}

function inOddsGate(odds, settings) {
  if (odds == null || !Number.isFinite(odds)) return false;
  if (odds < settings.oddsThreshold) return false;
  if (settings.oddsMax != null && odds > settings.oddsMax) return false;
  return true;
}

function raceMeta(race, raceDate) {
  const meters = parseDistanceM(race.distance);
  return {
    venue: race.venue,
    raceNumber: race.raceNumber,
    title: race.title,
    track: trackBand(race.track, race.distance),
    distanceM: meters,
    distanceBand: distanceBand(meters),
    classBand: classBand(race.title),
    fieldSize: race.fieldSize ?? (race.horses ?? []).length,
    fieldBand: fieldBand(race.fieldSize ?? (race.horses ?? []).length),
    weather: race.weather ?? null,
    condition: race.condition ?? null,
    weekday: weekdayJa(raceDate),
    startTime: race.startTime ?? null,
  };
}

function extractLaneHits({
  lane,
  raceDate,
  frozen,
  live,
  picks,
  settings,
  betTypes,
  pickKnown,
}) {
  const liveById = new Map((live.races ?? []).map((r) => [r.id, r]));
  const index = pickIndex(picks);
  const hits = [];
  const coverage = emptyCoverage();
  const coverageByBetType = {};

  for (const frozenRace of frozen.races ?? []) {
    const liveRace = liveById.get(frozenRace.id);
    const result = liveRace?.result;
    if (!result?.payouts?.length) continue;
    const meta = raceMeta(liveRace ?? frozenRace, raceDate);

    for (const payout of result.payouts) {
      if (!betTypes.has(payout.betType)) continue;
      if (!(payout.payoutYen > 0)) continue;
      coverageByBetType[payout.betType] ??= emptyCoverage();
      coverage.payouts += 1;
      coverageByBetType[payout.betType].payouts += 1;
      const board = frozenBoardEntry(frozenRace, payout.betType, payout.selection);
      if (!board) continue;
      coverage.onBoard += 1;
      coverageByBetType[payout.betType].onBoard += 1;
      if (!inOddsGate(board.odds, settings)) continue;
      coverage.gated += 1;
      coverageByBetType[payout.betType].gated += 1;
      if (pickKnown) {
        coverage.knownGated += 1;
        coverageByBetType[payout.betType].knownGated += 1;
      }

      const classified =
        lane === "main" ? classifyOddsEntry(frozenRace, board, settings) : null;
      const picked =
        pickKnown && index.has(`${frozenRace.id}|${selKey(payout.betType, payout.selection)}`);
      if (picked) {
        coverage.picked += 1;
        coverageByBetType[payout.betType].picked += 1;
      }
      const pred = findPick(picks, frozenRace.id, payout.betType, payout.selection);

      hits.push({
        id: `${lane}|${raceDate}|${frozenRace.id}|${selKey(payout.betType, payout.selection)}`,
        lane,
        raceDate,
        raceId: frozenRace.id,
        ...meta,
        betType: payout.betType,
        selection: payout.selection,
        horses: horseChips(frozenRace, payout.selection, payout.betType),
        odds: board.odds,
        oddsBand: oddsBand(board.odds, lane),
        payoutYen: payout.payoutYen,
        score:
          pred?.relatedPlacePotential ??
          pred?.relatedScore ??
          classified?.relatedPlacePotential ??
          null,
        label: pred?.label ?? classified?.label ?? null,
        pattern: pred?.pattern ?? null,
        axisHorseNumber: pred?.axisHorseNumber ?? null,
        picked,
        pickKnown,
        gateStatus: classified?.status ?? "lab",
        settings: {
          oddsThreshold: settings.oddsThreshold,
          oddsMax: settings.oddsMax ?? null,
          scoreMin: settings.scoreMin ?? null,
        },
      });
    }
  }

  return { hits, coverage, coverageByBetType };
}

async function loadDay(raceDate) {
  const frozenPath = path.join(loopRoot, "snapshots", `${raceDate}.json`);
  const livePath = path.join(liveSnapDir, `${raceDate}.json`);
  if (!(await exists(frozenPath)) || !(await exists(livePath))) return null;
  const frozen = await readJson(frozenPath);
  const live = await readJson(livePath);
  const mainPredPath = path.join(loopRoot, "predictions", `${raceDate}.json`);
  const trioPredPath = path.join(loopRoot, "sanren", "trio", "predictions", `${raceDate}.json`);
  const triPredPath = path.join(loopRoot, "sanren", "trifecta", "predictions", `${raceDate}.json`);
  return {
    frozen,
    live,
    mainPred: (await exists(mainPredPath)) ? await readJson(mainPredPath) : null,
    trioPred: (await exists(trioPredPath)) ? await readJson(trioPredPath) : null,
    trifectaPred: (await exists(triPredPath)) ? await readJson(triPredPath) : null,
  };
}

function emptyBucket() {
  return { n: 0, picked: 0, payoutYen: 0, known: 0 };
}

function bump(map, key, hit) {
  map[key] ??= emptyBucket();
  map[key].n += 1;
  if (hit.pickKnown) {
    map[key].known += 1;
    if (hit.picked) map[key].picked += 1;
  }
  map[key].payoutYen += hit.payoutYen ?? 0;
}

function withCatch(map) {
  return Object.fromEntries(
    Object.entries(map).map(([k, v]) => [
      k,
      {
        n: v.n,
        picked: v.picked,
        payoutYen: v.payoutYen,
        catchRate: v.known > 0 ? v.picked / v.known : null,
      },
    ]),
  );
}

function mergeCoverage(a, b) {
  const left = a ?? emptyCoverage();
  const right = b ?? emptyCoverage();
  return {
    payouts: left.payouts + right.payouts,
    onBoard: left.onBoard + right.onBoard,
    gated: left.gated + right.gated,
    knownGated: left.knownGated + right.knownGated,
    picked: left.picked + right.picked,
  };
}

function mergeCoverageByBetType(into, from) {
  for (const [betType, cov] of Object.entries(from ?? {})) {
    into[betType] = mergeCoverage(into[betType], cov);
  }
  return into;
}

function withRates(coverage) {
  return {
    ...coverage,
    boardRate: coverage.payouts > 0 ? coverage.onBoard / coverage.payouts : null,
    gateRate: coverage.onBoard > 0 ? coverage.gated / coverage.onBoard : null,
    catchRate: coverage.knownGated > 0 ? coverage.picked / coverage.knownGated : null,
  };
}

function summarizeLane(lane, hits, settings, coverage) {
  const byVenue = {};
  const byTrack = {};
  const byBetType = {};
  const byOddsBand = {};
  const byClass = {};
  const byDistance = {};
  const byField = {};
  const byWeekday = {};
  const byWeather = {};
  const byLabel = {};
  const byDay = {};
  for (const hit of hits) {
    bump(byVenue, hit.venue ?? "不明", hit);
    bump(byTrack, hit.track ?? "不明", hit);
    bump(byBetType, hit.betType, hit);
    bump(byOddsBand, hit.oddsBand, hit);
    bump(byClass, hit.classBand, hit);
    bump(byDistance, hit.distanceBand, hit);
    bump(byField, hit.fieldBand, hit);
    bump(byWeekday, hit.weekday, hit);
    bump(byWeather, hit.weather || "不明", hit);
    bump(byLabel, !hit.pickKnown ? "予測なし" : hit.picked ? (hit.label ?? "候補") : "未捕捉", hit);
    bump(byDay, hit.raceDate, hit);
  }
  const n = hits.length;
  const known = hits.filter((h) => h.pickKnown);
  const picked = known.filter((h) => h.picked).length;
  const missed = known.length - picked;
  const payoutYen = hits.reduce((s, h) => s + (h.payoutYen ?? 0), 0);
  return {
    lane,
    settings: {
      oddsThreshold: settings.oddsThreshold,
      oddsMax: settings.oddsMax ?? null,
      scoreMin: settings.scoreMin ?? null,
    },
    n,
    picked,
    missed,
    catchRate: known.length > 0 ? picked / known.length : null,
    payoutYen,
    coverage: withRates(coverage),
    byVenue: withCatch(byVenue),
    byTrack: withCatch(byTrack),
    byBetType: withCatch(byBetType),
    byOddsBand: withCatch(byOddsBand),
    byClass: withCatch(byClass),
    byDistance: withCatch(byDistance),
    byField: withCatch(byField),
    byWeekday: withCatch(byWeekday),
    byWeather: withCatch(byWeather),
    byLabel: withCatch(byLabel),
    byDay: withCatch(byDay),
  };
}

function withBetTypeDetail(laneSummary, hits, settings, coverageByBetType) {
  const detail = {};
  for (const betType of MAIN_BET_TYPES) {
    detail[betType] = summarizeLane(
      laneSummary.lane,
      hits.filter((h) => h.betType === betType),
      settings,
      coverageByBetType[betType] ?? emptyCoverage(),
    );
  }
  return {
    ...laneSummary,
    coverageByBetType: Object.fromEntries(
      Object.entries(coverageByBetType ?? {}).map(([k, v]) => [k, withRates(v)]),
    ),
    byBetTypeDetail: detail,
  };
}

export async function rebuildHitCatalog() {
  await mkdir(hitsDir, { recursive: true });
  const frozenFiles = (await readdir(path.join(loopRoot, "snapshots"))).filter((f) =>
    /^\d{4}-\d{2}-\d{2}\.json$/.test(f),
  );
  const dates = frozenFiles.map((f) => f.replace(/\.json$/, "")).sort();

  const hits = [];
  const skipped = [];
  const coverage = {
    main: emptyCoverage(),
    trio: emptyCoverage(),
    trifecta: emptyCoverage(),
  };
  const mainCoverageByBet = {};
  for (const raceDate of dates) {
    const day = await loadDay(raceDate);
    if (!day) {
      skipped.push(raceDate);
      continue;
    }
    const mainSettings = day.mainPred?.settings ?? DEFAULT_SETTINGS;
    const main = extractLaneHits({
      lane: "main",
      raceDate,
      frozen: day.frozen,
      live: day.live,
      picks: day.mainPred?.picks,
      settings: mainSettings,
      betTypes: mainBetTypeSet(mainSettings),
      pickKnown: Boolean(day.mainPred),
    });
    const trio = extractLaneHits({
      lane: "trio",
      raceDate,
      frozen: day.frozen,
      live: day.live,
      picks: day.trioPred?.picks,
      settings: day.trioPred?.settings ?? DEFAULT_TRIO_LANE,
      betTypes: new Set(["trio"]),
      pickKnown: Boolean(day.trioPred),
    });
    const trifecta = extractLaneHits({
      lane: "trifecta",
      raceDate,
      frozen: day.frozen,
      live: day.live,
      picks: day.trifectaPred?.picks,
      settings: day.trifectaPred?.settings ?? DEFAULT_TRIFECTA_LANE,
      betTypes: new Set(["trifecta"]),
      pickKnown: Boolean(day.trifectaPred),
    });
    hits.push(...main.hits, ...trio.hits, ...trifecta.hits);
    coverage.main = mergeCoverage(coverage.main, main.coverage);
    coverage.trio = mergeCoverage(coverage.trio, trio.coverage);
    coverage.trifecta = mergeCoverage(coverage.trifecta, trifecta.coverage);
    mergeCoverageByBetType(mainCoverageByBet, main.coverageByBetType);
  }

  hits.sort((a, b) => {
    if (a.raceDate !== b.raceDate) return a.raceDate.localeCompare(b.raceDate);
    if (a.lane !== b.lane) return a.lane.localeCompare(b.lane);
    return a.id.localeCompare(b.id);
  });

  const catalog = {
    builtAt: new Date().toISOString(),
    kind: "gated-ticket-hits",
    note: "Freeze odds met that day's settings and the payout hit. Main = non-sanren bet types at board settings. Trio/trifecta are separate. Do not merge KPI.",
    scannedDates: dates.filter((d) => !skipped.includes(d)),
    dates: [...new Set(hits.map((h) => h.raceDate))],
    hitCount: hits.length,
    hits,
  };

  const conditions = {
    builtAt: catalog.builtAt,
    kind: "gated-hit-conditions",
    note: catalog.note,
    scannedDates: catalog.scannedDates,
    dates: catalog.dates,
    byLane: {
      main: withBetTypeDetail(
        summarizeLane(
          "main",
          hits.filter((h) => h.lane === "main"),
          DEFAULT_SETTINGS,
          coverage.main,
        ),
        hits.filter((h) => h.lane === "main"),
        DEFAULT_SETTINGS,
        mainCoverageByBet,
      ),
      trio: summarizeLane(
        "trio",
        hits.filter((h) => h.lane === "trio"),
        DEFAULT_TRIO_LANE,
        coverage.trio,
      ),
      trifecta: summarizeLane(
        "trifecta",
        hits.filter((h) => h.lane === "trifecta"),
        DEFAULT_TRIFECTA_LANE,
        coverage.trifecta,
      ),
    },
  };

  const catalogPath = path.join(hitsDir, "catalog.json");
  const conditionsPath = path.join(hitsDir, "conditions.json");
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  await writeFile(conditionsPath, `${JSON.stringify(conditions, null, 2)}\n`);

  return { catalogPath, conditionsPath, hitCount: hits.length, dates: catalog.dates, skipped };
}

async function main() {
  const result = await rebuildHitCatalog();
  console.log(
    `Hit catalog → ${path.relative(root, result.catalogPath)} (${result.hitCount} hits, ${result.dates.length} days)`,
  );
  if (result.skipped.length) console.log(`skip (no freeze+live): ${result.skipped.join(", ")}`);
}

const isCli = process.argv[1] && path.basename(process.argv[1]) === "loop-hits.mjs";
if (isCli) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
