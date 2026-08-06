/**
 * 過去結果から「穴馬が馬券内（1〜3着）」になったレースを検証する。
 *
 *   node scripts/verify-longshot-in-money.mjs
 *   node scripts/verify-longshot-in-money.mjs --tfjv
 *   node scripts/verify-longshot-in-money.mjs --tfjv "C:/TFJV/TXT/Race Results2000.utf8.csv"
 *
 * 定義（PLAN / loop-domain と同期）:
 *   - 中穴: 単勝人気 6〜10
 *   - 大穴: 単勝人気 11+
 *   - 穴（広義）: 中穴 ∪ 大穴（人気 6+）
 *   - 馬券内: 着順 1〜3
 *   - ゲート内機会: 人気≥6 ∧ 単勝オッズ∈[oddsThreshold, oddsMax] ∧ ≤3着
 *   - gatedOppRecall: ゲート内機会馬を selectLongshots 関係馬で拾えたレース率
 */
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createInterface } from "node:readline";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  selectLongshots,
  classifyOddsEntry,
  DEFAULT_SETTINGS,
} from "./lib/loop-domain.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const snapDir = join(root, "src/data/snapshots");
const outDir = join(root, "src/data/loop/reports");

const args = process.argv.slice(2);
const wantTfjv = args.includes("--tfjv");
const tfjvArg = args.find((a, i) => args[i - 1] === "--tfjv" && !a.startsWith("-"));

function resolveTfjvCsv() {
  if (tfjvArg) return resolve(tfjvArg);
  if (process.env.TFJV_CSV) return resolve(process.env.TFJV_CSV);
  const candidates = [
    "C:/TFJV/TXT/Race Results2000.utf8.csv",
    "/tfjv/Race Results2000.utf8.csv",
    "C:/TFJV/TXT/Race Results2000.csv",
    "/tfjv/Race Results2000.csv",
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  return candidates[0];
}

function pct(n, d, digits = 1) {
  if (!d) return null;
  return Number(((100 * n) / d).toFixed(digits));
}

function popularityBand(pop) {
  if (pop == null || pop < 1) return "unknown";
  if (pop <= 3) return "fav1to3";
  if (pop <= 5) return "p4to5";
  if (pop <= 10) return "mid6to10";
  return "long11plus";
}

function isLongshotPop(pop) {
  return pop != null && pop >= 6;
}

function derivePopularity(horses) {
  const sorted = [...(horses ?? [])].sort(
    (a, b) => (a.oddsWin ?? 9999) - (b.oddsWin ?? 9999) || a.number - b.number,
  );
  const map = new Map();
  sorted.forEach((h, i) => map.set(h.number, i + 1));
  return map;
}

function finishPopularity(finish, popByNumber) {
  if (finish?.popularity != null && finish.popularity >= 1) return finish.popularity;
  return popByNumber.get(finish.number) ?? null;
}

function inOddsGate(odds, settings) {
  if (odds == null || !Number.isFinite(odds)) return false;
  if (odds < settings.oddsThreshold) return false;
  if (settings.oddsMax != null && odds > settings.oddsMax) return false;
  return true;
}

/** 単勝が欠損/99.9キャップでも、関係買い目がゲート内なら機会に含める */
function isGatedOpportunityPlacer(placer, race, settings) {
  if (!isLongshotPop(placer.popularity)) return false;
  if (inOddsGate(placer.oddsWin, settings)) return true;
  for (const entry of race.oddsBoard ?? []) {
    if (!inOddsGate(entry.odds, settings)) continue;
    const row = classifyOddsEntry(race, entry, {
      ...settings,
      scoreMin: 0, // オッズゲート通過判定だけ欲しい
    });
    // scoreMin=0 でも disabled/below/above/no_related は残る
    if (!(row.relatedHorseNumbers || []).includes(placer.number)) continue;
    if (row.status === "candidate" || row.status === "pass") return true;
  }
  return false;
}

/** ゲート内機会馬に紐づく買い目が候補になれなかった主因 */
function missReasonForHorse(race, horseNumber, settings) {
  const board = race.oddsBoard ?? [];
  if (board.length === 0) return "no_odds_board";

  const statuses = [];
  for (const entry of board) {
    const row = classifyOddsEntry(race, entry, settings);
    if (!(row.relatedHorseNumbers || []).includes(horseNumber)) continue;
    statuses.push(row.status);
  }
  if (statuses.length === 0) return "no_related_entry";
  if (statuses.includes("candidate")) return "caught_elsewhere"; // 呼び出し側で通常は使わない
  if (statuses.includes("pass")) return "score_insufficient";
  if (statuses.includes("below_threshold")) return "ticket_below_threshold";
  if (statuses.includes("above_max")) return "ticket_above_max";
  if (statuses.includes("disabled_bet")) return "disabled_bet";
  if (statuses.includes("no_related")) return "no_related";
  return "other";
}

/** レース単位の主因（近い順: score → ticket帯 → 板なし） */
function primaryMissReason(reasons) {
  const order = [
    "score_insufficient",
    "ticket_below_threshold",
    "ticket_above_max",
    "no_related_entry",
    "no_odds_board",
    "disabled_bet",
    "no_related",
    "other",
  ];
  for (const key of order) {
    if (reasons.includes(key)) return key;
  }
  return reasons[0] || "other";
}

function analyzeSnapshots() {
  const files = readdirSync(snapDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();

  const summary = {
    raceDays: files.length,
    racesWithResult: 0,
    racesWithAnyLongshotInMoney: 0,
    racesWithMidInMoney: 0,
    racesWithDeepInMoney: 0,
    racesWithLongshotWin: 0,
    top3Slots: 0,
    top3ByBand: { fav1to3: 0, p4to5: 0, mid6to10: 0, long11plus: 0, unknown: 0 },
    longshotInMoneyHorses: 0,
    midInMoneyHorses: 0,
    deepInMoneyHorses: 0,
    byVenue: new Map(),
    byDate: new Map(),
  };

  /** @type {Array<object>} */
  const sampleRaces = [];
  /** 候補（selectLongshots）が関係馬として穴馬券内を拾えたか（広義・参考） */
  let candidateEvalRaces = 0;
  let candidateCaughtLongshotInMoney = 0;
  let longshotInMoneyRacesForCatch = 0;

  /** ゲート内機会（製品設定と揃えた分母） */
  const gated = {
    opportunityRaces: 0,
    opportunityHorses: 0,
    midHorses: 0,
    deepHorses: 0,
    withOddsBoard: 0,
    caught: 0,
    missByReason: {
      score_insufficient: 0,
      ticket_below_threshold: 0,
      ticket_above_max: 0,
      no_related_entry: 0,
      no_odds_board: 0,
      disabled_bet: 0,
      no_related: 0,
      other: 0,
    },
    missSamples: [],
  };

  for (const f of files) {
    const snap = JSON.parse(readFileSync(join(snapDir, f), "utf8"));
    const date = snap.raceDate || f.replace(/\.json$/, "");
    if (!summary.byDate.has(date)) {
      summary.byDate.set(date, {
        date,
        races: 0,
        withLongshotInMoney: 0,
        mid: 0,
        deep: 0,
        longshotWins: 0,
      });
    }
    const day = summary.byDate.get(date);

    for (const race of snap.races || []) {
      const finishes = race.result?.finishes;
      if (!finishes?.length) continue;
      const top3 = finishes
        .filter((x) => x.rank >= 1 && x.rank <= 3)
        .sort((a, b) => a.rank - b.rank);
      if (top3.length === 0) continue;

      summary.racesWithResult += 1;
      day.races += 1;

      const venue = race.venue || "?";
      if (!summary.byVenue.has(venue)) {
        summary.byVenue.set(venue, { venue, races: 0, withLongshotInMoney: 0 });
      }
      const v = summary.byVenue.get(venue);
      v.races += 1;

      const popByNumber = derivePopularity(race.horses);
      const nameByNumber = new Map((race.horses || []).map((h) => [h.number, h.name]));
      const oddsByNumber = new Map((race.horses || []).map((h) => [h.number, h.oddsWin]));

      let hasMid = false;
      let hasDeep = false;
      let hasLongshotWin = false;
      /** @type {Array<object>} */
      const longshotPlacers = [];

      for (const fin of top3) {
        summary.top3Slots += 1;
        const pop = finishPopularity(fin, popByNumber);
        const band = popularityBand(pop);
        summary.top3ByBand[band] = (summary.top3ByBand[band] || 0) + 1;

        if (!isLongshotPop(pop)) continue;
        summary.longshotInMoneyHorses += 1;
        const odds = fin.oddsWin ?? oddsByNumber.get(fin.number) ?? null;
        const entry = {
          rank: fin.rank,
          number: fin.number,
          name: fin.name || nameByNumber.get(fin.number) || null,
          popularity: pop,
          oddsWin: odds,
          band: pop <= 10 ? "mid6to10" : "long11plus",
        };
        longshotPlacers.push(entry);

        if (pop <= 10) {
          hasMid = true;
          summary.midInMoneyHorses += 1;
        } else {
          hasDeep = true;
          summary.deepInMoneyHorses += 1;
        }
        if (fin.rank === 1) hasLongshotWin = true;
      }

      if (longshotPlacers.length === 0) continue;

      summary.racesWithAnyLongshotInMoney += 1;
      day.withLongshotInMoney += 1;
      v.withLongshotInMoney += 1;
      if (hasMid) {
        summary.racesWithMidInMoney += 1;
        day.mid += 1;
      }
      if (hasDeep) {
        summary.racesWithDeepInMoney += 1;
        day.deep += 1;
      }
      if (hasLongshotWin) {
        summary.racesWithLongshotWin += 1;
        day.longshotWins += 1;
      }

      const sample = {
        raceId: race.id,
        raceDate: date,
        venue: race.venue,
        raceNumber: race.raceNumber,
        title: race.title,
        track: race.track,
        distance: race.distance,
        fieldSize: race.fieldSize ?? race.horses?.length ?? null,
        longshotPlacers,
        top3: top3.map((fin) => ({
          rank: fin.rank,
          number: fin.number,
          name: fin.name || nameByNumber.get(fin.number) || null,
          popularity: finishPopularity(fin, popByNumber),
          oddsWin: fin.oddsWin ?? oddsByNumber.get(fin.number) ?? null,
        })),
      };
      sampleRaces.push(sample);

      const gatedPlacers = longshotPlacers.filter((p) =>
        isGatedOpportunityPlacer(p, race, DEFAULT_SETTINGS),
      );

      // 選別候補が穴馬券内を関係馬として拾えたか（広義・参考）
      if (race.oddsBoard?.length) {
        longshotInMoneyRacesForCatch += 1;
        const picks = selectLongshots([race], DEFAULT_SETTINGS);
        const longshotNums = new Set(longshotPlacers.map((p) => p.number));
        const caught = picks.some((p) =>
          (p.relatedHorseNumbers || []).some((n) => longshotNums.has(n)),
        );
        candidateEvalRaces += 1;
        if (caught) candidateCaughtLongshotInMoney += 1;

        // ゲート内機会に対する Recall / Miss 分解
        if (gatedPlacers.length > 0) {
          gated.opportunityRaces += 1;
          gated.withOddsBoard += 1;
          gated.opportunityHorses += gatedPlacers.length;
          for (const gp of gatedPlacers) {
            if (gp.band === "mid6to10") gated.midHorses += 1;
            else if (gp.band === "long11plus") gated.deepHorses += 1;
          }
          const gatedNums = new Set(gatedPlacers.map((p) => p.number));
          const gatedCaught = picks.some((p) =>
            (p.relatedHorseNumbers || []).some((n) => gatedNums.has(n)),
          );
          if (gatedCaught) {
            gated.caught += 1;
          } else {
            const reasons = gatedPlacers.map((gp) =>
              missReasonForHorse(race, gp.number, DEFAULT_SETTINGS),
            );
            const primary = primaryMissReason(reasons);
            gated.missByReason[primary] = (gated.missByReason[primary] || 0) + 1;
            if (gated.missSamples.length < 25) {
              gated.missSamples.push({
                raceId: race.id,
                raceDate: date,
                venue: race.venue,
                raceNumber: race.raceNumber,
                title: race.title,
                primaryMissReason: primary,
                gatedPlacers,
              });
            }
          }
        }
      } else if (gatedPlacers.length > 0) {
        gated.opportunityRaces += 1;
        gated.opportunityHorses += gatedPlacers.length;
        for (const gp of gatedPlacers) {
          if (gp.band === "mid6to10") gated.midHorses += 1;
          else if (gp.band === "long11plus") gated.deepHorses += 1;
        }
        gated.missByReason.no_odds_board += 1;
        if (gated.missSamples.length < 25) {
          gated.missSamples.push({
            raceId: race.id,
            raceDate: date,
            venue: race.venue,
            raceNumber: race.raceNumber,
            title: race.title,
            primaryMissReason: "no_odds_board",
            gatedPlacers,
          });
        }
      }
    }
  }

  // 代表例: 大穴優先 → 中穴1着 → 中穴複勝、各日バランス用に日付順で先頭〜
  const notable = [...sampleRaces]
    .sort((a, b) => {
      const deepA = a.longshotPlacers.some((p) => p.band === "long11plus") ? 1 : 0;
      const deepB = b.longshotPlacers.some((p) => p.band === "long11plus") ? 1 : 0;
      if (deepB !== deepA) return deepB - deepA;
      const winA = a.longshotPlacers.some((p) => p.rank === 1) ? 1 : 0;
      const winB = b.longshotPlacers.some((p) => p.rank === 1) ? 1 : 0;
      if (winB !== winA) return winB - winA;
      const popA = Math.max(...a.longshotPlacers.map((p) => p.popularity ?? 0));
      const popB = Math.max(...b.longshotPlacers.map((p) => p.popularity ?? 0));
      return popB - popA;
    })
    .slice(0, 40);

  const n = summary.racesWithResult;
  return {
    source: "snapshots",
    analyzedAt: new Date().toISOString(),
    files,
    definition: {
      mid: "popularity 6-10",
      deep: "popularity 11+",
      inMoney: "finish rank 1-3",
      gatedOpportunity:
        "popularity>=6 AND finish<=3 AND (winOdds in gate OR related board odds in gate)",
      candidateSettings: DEFAULT_SETTINGS,
    },
    racesWithResult: n,
    raceDays: summary.raceDays,
    rates: {
      anyLongshotInMoneyPct: pct(summary.racesWithAnyLongshotInMoney, n),
      midInMoneyPct: pct(summary.racesWithMidInMoney, n),
      deepInMoneyPct: pct(summary.racesWithDeepInMoney, n),
      longshotWinPct: pct(summary.racesWithLongshotWin, n),
      gatedOpportunityRacePct: pct(gated.opportunityRaces, n),
    },
    counts: {
      racesWithAnyLongshotInMoney: summary.racesWithAnyLongshotInMoney,
      racesWithMidInMoney: summary.racesWithMidInMoney,
      racesWithDeepInMoney: summary.racesWithDeepInMoney,
      racesWithLongshotWin: summary.racesWithLongshotWin,
      longshotInMoneyHorses: summary.longshotInMoneyHorses,
      midInMoneyHorses: summary.midInMoneyHorses,
      deepInMoneyHorses: summary.deepInMoneyHorses,
      gatedOpportunityRaces: gated.opportunityRaces,
      gatedOpportunityHorses: gated.opportunityHorses,
    },
    top3SlotSharePct: {
      fav1to3: pct(summary.top3ByBand.fav1to3, summary.top3Slots),
      p4to5: pct(summary.top3ByBand.p4to5, summary.top3Slots),
      mid6to10: pct(summary.top3ByBand.mid6to10, summary.top3Slots),
      long11plus: pct(summary.top3ByBand.long11plus, summary.top3Slots),
      unknown: pct(summary.top3ByBand.unknown, summary.top3Slots),
    },
    top3SlotCounts: summary.top3ByBand,
    top3Slots: summary.top3Slots,
    byVenue: [...summary.byVenue.values()]
      .map((x) => ({
        ...x,
        longshotInMoneyPct: pct(x.withLongshotInMoney, x.races),
      }))
      .sort((a, b) => (b.longshotInMoneyPct ?? 0) - (a.longshotInMoneyPct ?? 0)),
    byDate: [...summary.byDate.values()]
      .map((x) => ({
        ...x,
        longshotInMoneyPct: pct(x.withLongshotInMoney, x.races),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    /** 広義（ゲート外の穴馬券内を含む）。ボード改善の分母には使わない */
    candidateCatchBroad: {
      longshotInMoneyRacesWithOddsBoard: longshotInMoneyRacesForCatch,
      evaluated: candidateEvalRaces,
      caught: candidateCaughtLongshotInMoney,
      catchRatePct: pct(candidateCaughtLongshotInMoney, longshotInMoneyRacesForCatch),
      note: "参考。人気≥6かつ≤3着ならオッズ閾値外も含む",
    },
    /** 製品ゲートと揃えた副指標（HIT-RATE-PLAN 接続用） */
    gatedOpportunity: {
      settings: {
        oddsThreshold: DEFAULT_SETTINGS.oddsThreshold,
        oddsMax: DEFAULT_SETTINGS.oddsMax,
        scoreMin: DEFAULT_SETTINGS.scoreMin,
      },
      opportunityRaces: gated.opportunityRaces,
      opportunityHorses: gated.opportunityHorses,
      midHorses: gated.midHorses,
      deepHorses: gated.deepHorses,
      withOddsBoard: gated.withOddsBoard,
      caught: gated.caught,
      missed: gated.opportunityRaces - gated.caught,
      gatedOppRecallPct: pct(gated.caught, gated.opportunityRaces),
      missByReason: gated.missByReason,
      missByReasonPct: Object.fromEntries(
        Object.entries(gated.missByReason).map(([k, v]) => [
          k,
          pct(v, Math.max(0, gated.opportunityRaces - gated.caught)),
        ]),
      ),
      missSamples: gated.missSamples,
      note: "分母=単勝オッズがゲート内の穴馬券内レース。分子=selectLongshots関係馬にその馬を含む",
    },
    notableRaces: notable,
    allLongshotInMoneyRaceCount: sampleRaces.length,
  };
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function toNum(s) {
  if (s == null || s === "" || s === "*") return null;
  const normalized = String(s)
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[^\d.-]/g, "");
  if (normalized === "" || normalized === "-" || normalized === ".") return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

async function analyzeTfjv(csvPath) {
  if (!existsSync(csvPath)) {
    return { error: "CSV not found", csvPath };
  }

  const rl = createInterface({
    input: createReadStream(csvPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let headers = null;
  let finishCol = null;
  let currentKey = null;
  let current = [];
  let rowCount = 0;
  let minDate = null;
  let maxDate = null;

  const stats = {
    races: 0,
    racesWithAnyLongshotInMoney: 0,
    racesWithMidInMoney: 0,
    racesWithDeepInMoney: 0,
    racesWithLongshotWin: 0,
    top3Slots: 0,
    top3ByBand: { fav1to3: 0, p4to5: 0, mid6to10: 0, long11plus: 0, unknown: 0 },
    horsePlaceByBand: { fav1to3: 0, p4to5: 0, mid6to10: 0, long11plus: 0, unknown: 0 },
    startsByBand: { fav1to3: 0, p4to5: 0, mid6to10: 0, long11plus: 0, unknown: 0 },
  };

  function flush(entries) {
    const withFinish = entries.filter((e) => toNum(e.finish) != null);
    if (withFinish.length === 0) return;
    stats.races += 1;

    for (const e of withFinish) {
      const band = popularityBand(e.pop);
      stats.startsByBand[band] += 1;
    }

    const top3 = withFinish
      .filter((e) => {
        const r = toNum(e.finish);
        return r != null && r >= 1 && r <= 3;
      })
      .sort((a, b) => toNum(a.finish) - toNum(b.finish));

    let hasMid = false;
    let hasDeep = false;
    let hasLongWin = false;

    for (const e of top3) {
      stats.top3Slots += 1;
      const pop = e.pop;
      const band = popularityBand(pop);
      stats.top3ByBand[band] += 1;
      stats.horsePlaceByBand[band] += 1;
      if (pop != null && pop >= 6 && pop <= 10) hasMid = true;
      if (pop != null && pop >= 11) hasDeep = true;
      if (pop != null && pop >= 6 && toNum(e.finish) === 1) hasLongWin = true;
    }

    if (hasMid || hasDeep) stats.racesWithAnyLongshotInMoney += 1;
    if (hasMid) stats.racesWithMidInMoney += 1;
    if (hasDeep) stats.racesWithDeepInMoney += 1;
    if (hasLongWin) stats.racesWithLongshotWin += 1;
  }

  for await (const line of rl) {
    if (!line) continue;
    if (!headers) {
      headers = parseCsvLine(line);
      finishCol = headers.includes("着順") ? "着順" : headers.includes("着") ? "着" : null;
      if (!finishCol) throw new Error("着順列なし");
      continue;
    }
    const cols = parseCsvLine(line);
    if (cols.length < 8) continue;
    const get = (name) => {
      const i = headers.indexOf(name);
      return i >= 0 ? cols[i] ?? "" : "";
    };
    const date = get("日付");
    const key = `${date}|${get("開催")}|${get("Ｒ") || get("R")}`;
    rowCount += 1;
    if (date) {
      if (minDate == null || date < minDate) minDate = date;
      if (maxDate == null || date > maxDate) maxDate = date;
    }
    const entry = {
      pop: toNum(get("人気")),
      finish: get(finishCol),
    };
    if (currentKey == null) currentKey = key;
    if (key !== currentKey) {
      flush(current);
      current = [];
      currentKey = key;
    }
    current.push(entry);
  }
  if (current.length) flush(current);

  const n = stats.races;
  const placeRate = (band) => pct(stats.horsePlaceByBand[band], stats.startsByBand[band]);

  return {
    source: "tfjv",
    csvPath,
    analyzedAt: new Date().toISOString(),
    dateRangeYymmdd: { min: minDate, max: maxDate },
    rowCount,
    races: n,
    rates: {
      anyLongshotInMoneyPct: pct(stats.racesWithAnyLongshotInMoney, n),
      midInMoneyPct: pct(stats.racesWithMidInMoney, n),
      deepInMoneyPct: pct(stats.racesWithDeepInMoney, n),
      longshotWinPct: pct(stats.racesWithLongshotWin, n),
    },
    counts: {
      racesWithAnyLongshotInMoney: stats.racesWithAnyLongshotInMoney,
      racesWithMidInMoney: stats.racesWithMidInMoney,
      racesWithDeepInMoney: stats.racesWithDeepInMoney,
      racesWithLongshotWin: stats.racesWithLongshotWin,
    },
    top3SlotSharePct: {
      fav1to3: pct(stats.top3ByBand.fav1to3, stats.top3Slots),
      p4to5: pct(stats.top3ByBand.p4to5, stats.top3Slots),
      mid6to10: pct(stats.top3ByBand.mid6to10, stats.top3Slots),
      long11plus: pct(stats.top3ByBand.long11plus, stats.top3Slots),
    },
    horsePlaceRatePctByBand: {
      fav1to3: placeRate("fav1to3"),
      p4to5: placeRate("p4to5"),
      mid6to10: placeRate("mid6to10"),
      long11plus: placeRate("long11plus"),
    },
    startsByBand: stats.startsByBand,
    horsePlaceByBand: stats.horsePlaceByBand,
  };
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const snapReport = analyzeSnapshots();
  const snapOut = join(outDir, "longshot-in-money-snapshots.json");
  writeFileSync(snapOut, JSON.stringify(snapReport, null, 2));
  console.log(
    JSON.stringify(
      {
        snapshots: {
          racesWithResult: snapReport.racesWithResult,
          rates: snapReport.rates,
          top3SlotSharePct: snapReport.top3SlotSharePct,
          candidateCatchBroad: snapReport.candidateCatchBroad,
          gatedOpportunity: {
            opportunityRaces: snapReport.gatedOpportunity.opportunityRaces,
            caught: snapReport.gatedOpportunity.caught,
            gatedOppRecallPct: snapReport.gatedOpportunity.gatedOppRecallPct,
            missByReason: snapReport.gatedOpportunity.missByReason,
          },
          notableCount: snapReport.notableRaces.length,
        },
      },
      null,
      2,
    ),
  );
  console.log("→", snapOut);

  if (wantTfjv) {
    const csvPath = resolveTfjvCsv();
    console.log("streaming TFJV", csvPath);
    const tfjvReport = await analyzeTfjv(csvPath);
    const stem =
      basename(csvPath, ".csv")
        .replace(/\.utf8$/i, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .toLowerCase() || "tfjv";
    const tfjvOut = join(outDir, `longshot-in-money-tfjv-${stem}.json`);
    writeFileSync(tfjvOut, JSON.stringify(tfjvReport, null, 2));
    console.log(JSON.stringify({ tfjv: { races: tfjvReport.races, rates: tfjvReport.rates, top3SlotSharePct: tfjvReport.top3SlotSharePct, horsePlaceRatePctByBand: tfjvReport.horsePlaceRatePctByBand } }, null, 2));
    console.log("→", tfjvOut);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
