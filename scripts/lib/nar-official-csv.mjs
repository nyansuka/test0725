/**
 * keiba.go.jp 公式 CSV → UMANOTE Race[] 変換
 */
import { slugForVenueName } from "./nar-venues.mjs";

export const OFFICIAL_BET_TO_TYPE = {
  単勝: "win",
  複勝: "place",
  枠複: "bracket_quinella",
  枠連: "bracket_quinella",
  枠単: "bracket_exacta",
  馬複: "quinella",
  馬連: "quinella",
  ワイド: "wide",
  馬単: "exacta",
  "３連複": "trio",
  "3連複": "trio",
  "３連単": "trifecta",
  "3連単": "trifecta",
};

/** RFC4180 風の簡易 CSV（BOM・引用符対応） */
export function parseCsv(text) {
  const src = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

export function csvObjects(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const obj = {};
    for (let i = 0; i < headers.length; i += 1) {
      obj[headers[i]] = cols[i] ?? "";
    }
    return obj;
  });
}

export function ymdOfficialToIso(ymd) {
  const s = String(ymd).replaceAll("/", "").replaceAll("-", "");
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export function formatStartTime(raw) {
  const s = String(raw ?? "").trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) return s;
  if (/^\d{3,4}$/.test(s)) {
    const padded = s.padStart(4, "0");
    return `${Number(padded.slice(0, 2))}:${padded.slice(2, 4)}`;
  }
  return "";
}

export function toTrack(raw) {
  const s = String(raw ?? "");
  if (s.includes("芝")) return "芝";
  return "ダート";
}

export function distanceLabel(trackRaw, meters) {
  const m = String(meters ?? "").trim();
  if (!m) return "?";
  const prefix = String(trackRaw ?? "").includes("芝") ? "芝" : "ダ";
  return `${prefix}${m}m`;
}

function raceKey(venue, ymd, raceNumber) {
  return `${venue}|${ymd}|${Number(raceNumber)}`;
}

function synthesizeFactors(oddsWin) {
  const o = Number.isFinite(oddsWin) ? oddsWin : 50;
  return {
    courseFit: 50,
    paceFit: 50,
    conditionFit: 50,
    formSignal: 50,
    valueGap: Math.min(100, Math.round(o)),
  };
}

function buildComment(oddsWin) {
  if (oddsWin >= 20) return "公開オッズ上は人気薄。複勝圏の余地をスコアで確認。";
  if (oddsWin >= 10) return "中人気帯。展開次第で複勝圏争いに加わりうる。";
  return "相対的に支持を集める帯。穴候補としては見送り寄り。";
}

function selectionFromNums(n1, n2, n3) {
  const parts = [n1, n2, n3]
    .map((x) => String(x ?? "").trim())
    .filter((x) => x !== "" && x !== "0");
  return parts.join("-");
}

function thinComboBoard(entries, { minOdds = 8, perType = 40 } = {}) {
  const byType = new Map();
  for (const e of entries) {
    if (e.betType === "win" || e.betType === "place") {
      byType.set(e.betType, [...(byType.get(e.betType) ?? []), e]);
      continue;
    }
    if (!(e.odds >= minOdds)) continue;
    byType.set(e.betType, [...(byType.get(e.betType) ?? []), e]);
  }
  const out = [];
  for (const [betType, list] of byType) {
    if (betType === "win" || betType === "place") {
      out.push(...list);
      continue;
    }
    out.push(
      ...[...list]
        .sort((a, b) => b.odds - a.odds)
        .slice(0, perType),
    );
  }
  return out;
}

function numOrNull(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {{ racelist: string, horselist: string, odds?: string, payback?: string }} files
 * @param {{ venueFilter?: Set<string>|null, comboMinOdds?: number }} opts
 */
export function buildNarSnapshotFromOfficialCsv(files, opts = {}) {
  const venueFilter = opts.venueFilter ?? null;
  const racesRows = csvObjects(files.racelist);
  const horseRows = csvObjects(files.horselist);
  const oddsRows = files.odds ? csvObjects(files.odds) : [];
  const paybackRows = files.payback ? csvObjects(files.payback) : [];

  /** @type {Map<string, object>} */
  const raceMap = new Map();

  for (const row of racesRows) {
    const venue = row["競馬場"]?.trim();
    const ymd = row["競走年月日"]?.trim();
    const raceNumber = Number(row["レース番号"]);
    if (!venue || !ymd || !Number.isFinite(raceNumber)) continue;
    if (venueFilter && !venueFilter.has(venue)) continue;
    const raceDate = ymdOfficialToIso(ymd);
    if (!raceDate) continue;
    const key = raceKey(venue, ymd, raceNumber);
    const trackRaw = row["芝ダート区分"] ?? "";
    raceMap.set(key, {
      id: `${slugForVenueName(venue)}-${ymd}-${raceNumber}`,
      authority: "NAR",
      raceDate,
      venue,
      raceNumber,
      title: (row["レース名"] || `${venue}${raceNumber}R`).trim(),
      distance: distanceLabel(trackRaw, row["距離"]),
      track: toTrack(trackRaw),
      startTime: formatStartTime(row["発走時刻"]),
      weather: (row["天候"] || "").trim(),
      condition: (row["馬場"] || "").trim(),
      horses: [],
      oddsBoard: [],
      fieldSize: numOrNull(row["頭数"]) ?? undefined,
      source: "keiba.go.jp official csv",
    });
  }

  /** place odds ranges by horse */
  const placeRange = new Map(); // key|umaban -> {min,max}
  const winOdds = new Map(); // key|umaban -> odds
  const boardRaw = new Map(); // key -> OddsEntry[]

  for (const row of oddsRows) {
    const venue = row["競馬場"]?.trim();
    const ymd = row["競走年月日"]?.trim();
    const raceNumber = Number(row["レース番号"]);
    if (!venue || !ymd || !Number.isFinite(raceNumber)) continue;
    if (venueFilter && !venueFilter.has(venue)) continue;
    const key = raceKey(venue, ymd, raceNumber);
    if (!raceMap.has(key)) continue;
    const betType = OFFICIAL_BET_TO_TYPE[row["賭式"]?.trim()];
    if (!betType) continue;
    const odds = numOrNull(row["オッズ"]);
    if (odds == null || odds <= 0) continue;
    const selection = selectionFromNums(row["番号1"], row["番号2"], row["番号3"]);
    if (!selection) continue;

    if (betType === "win") {
      winOdds.set(`${key}|${selection}`, odds);
    }
    if (betType === "place") {
      const max = numOrNull(row["オッズ（最大）"]);
      placeRange.set(`${key}|${selection}`, {
        min: odds,
        max: max != null && max > 0 ? max : odds,
      });
    }

    const list = boardRaw.get(key) ?? [];
    list.push({ betType, selection, odds });
    boardRaw.set(key, list);
  }

  for (const row of horseRows) {
    const venue = row["競馬場"]?.trim();
    const ymd = row["競走年月日"]?.trim();
    const raceNumber = Number(row["レース番号"]);
    if (!venue || !ymd || !Number.isFinite(raceNumber)) continue;
    if (venueFilter && !venueFilter.has(venue)) continue;
    const key = raceKey(venue, ymd, raceNumber);
    const race = raceMap.get(key);
    if (!race) continue;
    const number = Number(row["馬番"]);
    if (!Number.isFinite(number)) continue;
    const oddsWin = winOdds.get(`${key}|${number}`) ?? 99.9;
    const place = placeRange.get(`${key}|${number}`);
    race.horses.push({
      number,
      bracket: numOrNull(row["枠番"]) ?? undefined,
      name: (row["馬名"] || "").trim(),
      jockey: (row["騎手名"] || "").trim(),
      oddsWin,
      oddsPlace: place
        ? { min: place.min, max: place.max }
        : {
            min: Math.max(1.1, Number((oddsWin * 0.28).toFixed(1))),
            max: Math.max(1.3, Number((oddsWin * 0.55).toFixed(1))),
          },
      factors: synthesizeFactors(oddsWin),
      comment: buildComment(oddsWin),
      placePotential: 50,
    });
  }

  // results from horselist finishes + payback
  for (const [key, race] of raceMap) {
    const finishes = [];
    for (const row of horseRows) {
      const k = raceKey(row["競馬場"]?.trim(), row["競走年月日"]?.trim(), row["レース番号"]);
      if (k !== key) continue;
      const rank = numOrNull(row["着順"]);
      const number = Number(row["馬番"]);
      if (!Number.isFinite(number)) continue;
      if (rank == null || rank < 1) continue;
      finishes.push({
        rank,
        number,
        bracket: numOrNull(row["枠番"]) ?? undefined,
        name: (row["馬名"] || "").trim(),
        jockey: (row["騎手名"] || "").trim(),
        time: (row["タイム"] || "").trim() || undefined,
        margin: (row["着差"] || "").trim() || undefined,
        popularity: numOrNull(row["人気"]) ?? undefined,
        oddsWin: winOdds.get(`${key}|${number}`) ?? undefined,
      });
    }
    finishes.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

    const payouts = [];
    for (const row of paybackRows) {
      const k = raceKey(row["競馬場"]?.trim(), row["競走年月日"]?.trim(), row["レース番号"]);
      if (k !== key) continue;
      const push = (betType, selection, yen, pop) => {
        const payoutYen = numOrNull(yen);
        if (!selection || payoutYen == null || payoutYen <= 0) return;
        payouts.push({
          betType,
          selection: String(selection).replaceAll("-", "-"),
          payoutYen,
          popularity: numOrNull(pop) ?? undefined,
        });
      };
      push("win", row["単勝組番"], row["単勝払戻金（円）"], row["単勝人気"]);
      push("place", row["複勝組番1"], row["複勝払戻金1（円）"], row["複勝人気1"]);
      push("place", row["複勝組番2"], row["複勝払戻金2（円）"], row["複勝人気2"]);
      push("place", row["複勝組番3"], row["複勝払戻金3（円）"], row["複勝人気3"]);
      if (row["枠複組番1"] && row["枠複組番2"]) {
        push(
          "bracket_quinella",
          `${row["枠複組番1"]}-${row["枠複組番2"]}`,
          row["枠複払戻金（円）"],
          row["枠複人気"],
        );
      }
      if (row["枠単組番1"] && row["枠単組番2"]) {
        push(
          "bracket_exacta",
          `${row["枠単組番1"]}-${row["枠単組番2"]}`,
          row["枠単払戻金（円）"],
          row["枠単人気"],
        );
      }
      if (row["馬複組番1"] && row["馬複組番2"]) {
        push("quinella", `${row["馬複組番1"]}-${row["馬複組番2"]}`, row["馬複払戻金（円）"], row["馬複人気1"] ?? row["馬複人気"]);
      }
      if (row["馬単組番1"] && row["馬単組番2"]) {
        push("exacta", `${row["馬単組番1"]}-${row["馬単組番2"]}`, row["馬単払戻金（円）"], row["馬単人気1"] ?? row["馬単人気"]);
      }
      for (const i of [1, 2, 3]) {
        const a = row[`ワイド組番${i}馬番1`];
        const b = row[`ワイド組番${i}馬番2`];
        if (a && b) push("wide", `${a}-${b}`, row[`ワイド払戻金${i}（円）`], row[`ワイド人気${i}`]);
      }
      if (row["３連複組番馬番1"] && row["３連複組番馬番2"] && row["３連複組番馬番3"]) {
        push(
          "trio",
          `${row["３連複組番馬番1"]}-${row["３連複組番馬番2"]}-${row["３連複組番馬番3"]}`,
          row["３連複払戻金（円）"],
          row["３連複人気"],
        );
      }
      if (row["３連単組番馬番1"] && row["３連単組番馬番2"] && row["３連単組番馬番3"]) {
        push(
          "trifecta",
          `${row["３連単組番馬番1"]}-${row["３連単組番馬番2"]}-${row["３連単組番馬番3"]}`,
          row["３連単払戻金（円）"],
          row["３連単人気"],
        );
      }
    }

    if (finishes.length) {
      race.result = {
        status: "official",
        finishes,
        payouts,
      };
    }

    const rawBoard = boardRaw.get(key) ?? [];
    // ensure win/place board entries from horses if odds csv missing some
    for (const h of race.horses) {
      if (!rawBoard.some((e) => e.betType === "win" && e.selection === String(h.number))) {
        rawBoard.push({ betType: "win", selection: String(h.number), odds: h.oddsWin });
      }
      if (h.oddsPlace && !rawBoard.some((e) => e.betType === "place" && e.selection === String(h.number))) {
        const mid = Number(((h.oddsPlace.min + h.oddsPlace.max) / 2).toFixed(1));
        rawBoard.push({ betType: "place", selection: String(h.number), odds: mid });
      }
    }
    race.oddsBoard = thinComboBoard(rawBoard, { minOdds: opts.comboMinOdds ?? 8 });
    race.horses.sort((a, b) => a.number - b.number);
    if (!race.fieldSize) race.fieldSize = race.horses.length;
  }

  const races = [...raceMap.values()].sort((a, b) => {
    if (a.venue !== b.venue) return a.venue.localeCompare(b.venue, "ja");
    return a.raceNumber - b.raceNumber;
  });

  const raceDates = [...new Set(races.map((r) => r.raceDate))];
  const raceDate = raceDates.sort().at(-1) ?? null;

  return {
    fetchedAt: new Date().toISOString(),
    source: "keiba.go.jp (official daily CSV)",
    authority: "NAR",
    raceDate,
    raceDates,
    raceCount: races.length,
    venues: [...new Set(races.map((r) => r.venue))],
    races,
  };
}
