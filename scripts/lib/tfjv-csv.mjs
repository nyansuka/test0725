/**
 * TFJV CSV 共通パース（ロード／検証用）
 */

export function parseCsvLine(line) {
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

export function toNum(s) {
  if (s == null || s === "" || s === "*") return null;
  const normalized = String(s)
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[^\d.-]/g, "");
  if (normalized === "" || normalized === "-" || normalized === ".") return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** DB の整数列用（小数は四捨五入） */
export function toInt(s) {
  const n = toNum(s);
  if (n == null) return null;
  return Math.round(n);
}

/** YYMMDD → Date（2000年代想定: 00–99 → 2000–2099） */
export function parseRaceDate(yymmdd) {
  const raw = String(yymmdd ?? "").replace(/\D/g, "");
  if (raw.length !== 6) return null;
  const y = 2000 + Number(raw.slice(0, 2));
  const m = Number(raw.slice(2, 4));
  const d = Number(raw.slice(4, 6));
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return null;
  return iso;
}

export function raceKey(dateRaw, kaijou, raceNo) {
  return `${dateRaw}|${kaijou}|${raceNo}`;
}

/** 走破タイム 1101 → 70.1 秒（MSSD） */
export function parseTimeSec(raw) {
  if (raw == null || raw === "" || raw === "*") return null;
  const digits = String(raw).replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.length === 4) {
    const m = Number(digits[0]);
    const sec = Number(digits.slice(1, 3));
    const tenths = Number(digits[3]);
    return m * 60 + sec + tenths / 10;
  }
  if (digits.length === 3) {
    const sec = Number(digits.slice(0, 2));
    const tenths = Number(digits[2]);
    return sec + tenths / 10;
  }
  if (digits.length === 5) {
    const m = Number(digits.slice(0, 2));
    const sec = Number(digits.slice(2, 4));
    const tenths = Number(digits[4]);
    return m * 60 + sec + tenths / 10;
  }
  return null;
}

export function stakesGrade(name) {
  const s = String(name ?? "");
  if (/G\s*(?:III|Ⅲ|3|３)|ＪＧ\s*３|JG\s*3/i.test(s)) return "G3";
  if (/G\s*(?:II|Ⅱ|2|２)|ＪＧ\s*２|JG\s*2/i.test(s)) return "G2";
  if (/G\s*(?:I|Ⅰ|1|１)|ＪＧ\s*１|JG\s*1/i.test(s)) return "G1";
  if (/重賞/.test(s)) return "重賞";
  return null;
}

export function weightCarried(raw) {
  return toNum(raw);
}
