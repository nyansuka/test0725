/**
 * 馬の過去走（同条件タイム・前走着順）から courseFit / formSignal を導出する。
 * データ源: db.netkeiba.com/horse/result/{horseId}/
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formSignalFromFormStats } from "../../src/domain/scoring/deriveFactors.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const CACHE_DIR = path.join(root, "src", "data", "cache", "horse-form");

const UA =
  "Mozilla/5.0 (compatible; UMANOTE-demo/0.1; +https://github.com/nyansuka/test0725)";

const VENUE_ALIASES = {
  札幌: "札幌",
  函館: "函館",
  福島: "福島",
  新潟: "新潟",
  東京: "東京",
  中山: "中山",
  中京: "中京",
  京都: "京都",
  阪神: "阪神",
  小倉: "小倉",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clamp(n, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** "1:00.3" / "59.8" → seconds */
export function timeToSec(raw) {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t === "**" || t === "-") return null;
  const m = t.match(/^(?:(\d+):)?(\d+)\.(\d+)$/);
  if (!m) return null;
  const min = Number(m[1] ?? 0);
  const sec = Number(m[2]);
  const frac = m[3];
  return min * 60 + sec + Number(frac) / 10 ** frac.length;
}

/** "ダ1000" / "芝1600" / "ダート1700m" → { track, distanceM, label } */
export function parseDistanceCell(raw) {
  if (!raw) return null;
  const m = String(raw)
    .replace(/\s+/g, "")
    .match(/(芝|ダート|ダ|障)(\d+)m?/);
  if (!m) return null;
  const surface = m[1];
  const isDirt = surface === "ダート" || surface === "ダ";
  const isSteeple = surface === "障";
  const track = isDirt ? "ダート" : isSteeple ? "障害" : "芝";
  const distanceM = Number(m[2]);
  const label = `${track === "ダート" ? "ダート" : track === "障害" ? "障害" : "芝"}${distanceM}m`;
  return { track: track === "障害" ? "芝" : track, distanceM, label, steeple: isSteeple };
}

/** "1札幌1" / "2東京7" → 会場名 */
export function parseVenueCell(raw) {
  if (!raw) return null;
  const m = String(raw).match(/[0-9０-９]*([^\d０-９]+)[0-9０-９]*/);
  const name = m?.[1]?.trim();
  if (!name) return null;
  return VENUE_ALIASES[name] ?? name;
}

/** レース distance 文字列（"ダート1000m"）と track から正規化キー */
export function courseKey(venue, track, distance) {
  const parsed = parseDistanceCell(distance) ?? {
    track,
    distanceM: Number(String(distance).match(/(\d+)/)?.[1] ?? 0),
    label: distance,
  };
  const t = parsed.track === "ダート" || track === "ダート" ? "ダート" : "芝";
  return `${venue}|${t}|${parsed.distanceM}`;
}

function cellText(html) {
  return decodeHtml(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * db.netkeiba horse/result HTML（UTF-8 でも EUC-JP 由来の UTF-8 変換後でも可）をパース。
 * @returns {Array<PastRun>}
 */
export function parseHorseResultHtml(html) {
  const table =
    html.match(/<table[^>]*class="[^"]*db_h_race_results[^"]*"[^>]*>([\s\S]*?)<\/table>/i)?.[1] ??
    "";
  if (!table) return [];

  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const runs = [];
  for (const rowMatch of rows) {
    const row = rowMatch[1];
    if (/<th[\s>]/i.test(row)) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => cellText(m[1]));
    // 日付 / 開催 / 天気 / R / レース名 / … / 着順(11) / … / 距離(14) / … / 馬場(16) / … / タイム(18) / 着差(19)
    if (cells.length < 19) continue;
    const date = cells[0]?.replace(/\./g, "/") ?? "";
    if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(date)) continue;

    const venue = parseVenueCell(cells[1]);
    const dist = parseDistanceCell(cells[14]);
    const rankRaw = cells[11];
    const rank = /^\d+$/.test(rankRaw) ? Number(rankRaw) : null;
    const popularity = /^\d+$/.test(cells[10]) ? Number(cells[10]) : null;
    const timeSec = timeToSec(cells[18]);
    const condition = cells[16] || undefined;

    if (!venue || !dist) continue;

    runs.push({
      date: date.replace(
        /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
        (_, y, mo, d) => `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`,
      ),
      venue,
      track: dist.track,
      distanceM: dist.distanceM,
      distanceLabel: dist.label,
      condition,
      rank,
      popularity,
      timeSec,
      raceName: cells[4] || undefined,
      kaiji: cells[1],
    });
  }
  return runs;
}

export async function decodeNetkeibaHtml(buf) {
  const asUtf8 = Buffer.isBuffer(buf) ? buf.toString("utf8") : String(buf);
  if (/charset\s*=\s*["']?utf-8/i.test(asUtf8.slice(0, 800)) && asUtf8.includes("db_h_race")) {
    return asUtf8;
  }
  try {
    const decoded = new TextDecoder("euc-jp").decode(buf);
    if (decoded.includes("db_h_race") || decoded.includes("競走")) return decoded;
  } catch {
    /* fall through */
  }
  return asUtf8;
}

async function fetchHorseResultHtml(horseId) {
  const url = `https://db.netkeiba.com/horse/result/${horseId}/`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,*/*",
      "Accept-Language": "ja,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return decodeNetkeibaHtml(buf);
}

async function readCache(horseId) {
  try {
    return JSON.parse(await readFile(path.join(CACHE_DIR, `${horseId}.json`), "utf8"));
  } catch {
    return null;
  }
}

async function writeCache(horseId, payload) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path.join(CACHE_DIR, `${horseId}.json`), JSON.stringify(payload, null, 2), "utf8");
}

/**
 * @param {string} horseId
 * @param {{ force?: boolean, sleepMs?: number }} [opts]
 */
export async function loadHorseRuns(horseId, opts = {}) {
  const { force = false, sleepMs = 150 } = opts;
  if (!force) {
    const cached = await readCache(horseId);
    if (cached?.runs) return cached;
  }
  const html = await fetchHorseResultHtml(horseId);
  if (sleepMs) await sleep(sleepMs);
  const runs = parseHorseResultHtml(html);
  const payload = { horseId, fetchedAt: new Date().toISOString(), runs };
  await writeCache(horseId, payload);
  return payload;
}

/** 当日以降の走破を除外（発走前スナップ用） */
export function runsBeforeDate(runs, raceDate) {
  if (!raceDate) return runs;
  return runs.filter((r) => r.date < raceDate);
}

export function sameCourseRuns(runs, venue, track, distance) {
  const key = courseKey(venue, track, distance);
  return runs.filter((r) => courseKey(r.venue, r.track, r.distanceLabel) === key);
}

/** 同芝ダ×同距離（会場不問）。同場が無いときのフォールバック */
export function sameDistanceRuns(runs, track, distance) {
  const parsed = parseDistanceCell(distance);
  const distanceM = parsed?.distanceM ?? Number(String(distance).match(/(\d+)/)?.[1] ?? 0);
  const t = (parsed?.track ?? track) === "ダート" || track === "ダート" ? "ダート" : "芝";
  return runs.filter((r) => r.track === t && r.distanceM === distanceM);
}

function placeScoreFromSame(same) {
  const placed = same.filter((r) => r.rank != null);
  if (!placed.length) return null;
  const avg = placed.reduce((s, r) => s + r.rank, 0) / placed.length;
  // 平均1着→90、平均6着→50、平均10着→34
  return clamp(98 - (avg - 1) * 8, 30, 92);
}

/**
 * レース内の相対タイム順位 → courseFit。
 * 同条件タイムがある馬同士で比較し、無い馬は着順ベース or 中立。
 */
export function applyFormToRace(race, runsByHorseId) {
  /** @type {Map<number, { summary: object, placeScore: number|null, form: number|null, exactMatch: boolean }>} */
  const prepared = new Map();
  const timed = [];

  for (const horse of race.horses ?? []) {
    const hid = horse.horseId;
    const all = hid ? (runsByHorseId.get(hid)?.runs ?? []) : [];
    const past = runsBeforeDate(all, race.raceDate);
    const exact = sameCourseRuns(past, race.venue, race.track, race.distance);
    const soft = exact.length ? exact : sameDistanceRuns(past, race.track, race.distance);
    const exactMatch = exact.length > 0;
    const withTime = soft.filter((r) => r.timeSec != null);
    const bestTime = withTime.length ? Math.min(...withTime.map((r) => r.timeSec)) : null;
    const last = past[0] ?? null; // ページは新しい順
    const ranked = soft.filter((r) => r.rank != null);
    const summary = {
      horseId: hid,
      pastStarts: past.length,
      sameCourseStarts: exact.length,
      sameDistanceStarts: soft.length,
      courseMatch: exactMatch ? "venue" : soft.length ? "distance" : "none",
      bestTimeSec: bestTime,
      avgSameRank:
        ranked.length > 0
          ? Number((ranked.reduce((s, r) => s + r.rank, 0) / ranked.length).toFixed(2))
          : null,
      lastRank: last?.rank ?? null,
      lastPopularity: last?.popularity ?? null,
      lastDate: last?.date ?? null,
    };
    let placeScore = placeScoreFromSame(soft);
    // 同距離フォールバックはやや控えめ
    if (placeScore != null && !exactMatch) placeScore = clamp(50 + (placeScore - 50) * 0.85);
    prepared.set(horse.number, {
      summary,
      placeScore,
      form: formSignalFromFormStats(summary),
      exactMatch,
    });
    if (bestTime != null) timed.push({ number: horse.number, bestTime, exactMatch });
  }

  timed.sort((a, b) => a.bestTime - b.bestTime);
  const timeRank = new Map(timed.map((t, i) => [t.number, i]));

  for (const horse of race.horses ?? []) {
    const { summary, placeScore, form, exactMatch } = prepared.get(horse.number);
    const factors = { ...horse.factors };

    let courseFit;
    if (summary.bestTimeSec != null && timed.length >= 2) {
      const idx = timeRank.get(horse.number) ?? timed.length - 1;
      const pct = idx / (timed.length - 1);
      let timeScore = 92 - pct * 42; // 92 … 50
      if (!exactMatch) timeScore = 50 + (timeScore - 50) * 0.85;
      courseFit = placeScore != null ? clamp(timeScore * 0.65 + placeScore * 0.35) : clamp(timeScore);
    } else if (placeScore != null) {
      courseFit = placeScore;
    } else if (summary.pastStarts > 0) {
      courseFit = 52; // 他距離のみ
    } else {
      courseFit = factors.courseFit ?? 50; // データ無しは既存合成を維持
    }

    if (form != null) factors.formSignal = form;
    factors.courseFit = courseFit;

    horse.factors = factors;
    horse.formStats = summary;
  }

  return race;
}

/**
 * 出走馬の horseId を集めて過去走を取得し、factors を更新。
 */
export async function enrichRaceWithForm(race, opts = {}) {
  const { force = false, sleepMs = 150, onProgress } = opts;
  const ids = [...new Set((race.horses ?? []).map((h) => h.horseId).filter(Boolean))];
  const runsByHorseId = new Map();
  for (const [i, id] of ids.entries()) {
    onProgress?.(i + 1, ids.length, id);
    try {
      const payload = await loadHorseRuns(id, { force, sleepMs });
      runsByHorseId.set(id, payload);
    } catch (err) {
      onProgress?.(i + 1, ids.length, id, err);
    }
  }
  applyFormToRace(race, runsByHorseId);
  return { race, fetched: runsByHorseId.size, total: ids.length };
}

export function extractHorseIdFromAnchorHtml(rowHtml) {
  const m =
    rowHtml.match(/db\.netkeiba\.com\/horse\/result\/(\d+)/i) ??
    rowHtml.match(/db\.netkeiba\.com\/horse\/(\d+)/i) ??
    rowHtml.match(/horse_id=(\d+)/i);
  return m?.[1] ?? null;
}
