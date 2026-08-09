/** レース詳細・出馬表の並び替え既定（localStorage） */

export type EntrySortKey =
  | "number"
  | "name"
  | "jockey"
  | "popularity"
  | "oddsWin"
  | "placeOdds"
  | "tipScore"
  | "placePotential"
  | "winPotential";

export type EntrySortDir = "asc" | "desc";

export type EntrySortPref = {
  key: EntrySortKey;
  dir: EntrySortDir;
};

export const DEFAULT_ENTRY_SORT: EntrySortPref = {
  key: "placePotential",
  dir: "desc",
};

const STORAGE_KEY = "umanote-entry-table-sort-v1";

const SORT_KEYS = new Set<EntrySortKey>([
  "number",
  "name",
  "jockey",
  "popularity",
  "oddsWin",
  "placeOdds",
  "tipScore",
  "placePotential",
  "winPotential",
]);

export function loadEntrySortPref(): EntrySortPref {
  if (typeof window === "undefined") return { ...DEFAULT_ENTRY_SORT };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ENTRY_SORT };
    const parsed = JSON.parse(raw) as Partial<EntrySortPref>;
    if (!parsed.key || !SORT_KEYS.has(parsed.key)) return { ...DEFAULT_ENTRY_SORT };
    if (parsed.dir !== "asc" && parsed.dir !== "desc") return { ...DEFAULT_ENTRY_SORT };
    return { key: parsed.key, dir: parsed.dir };
  } catch {
    return { ...DEFAULT_ENTRY_SORT };
  }
}

export function saveEntrySortPref(pref: EntrySortPref): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
}

export function entrySortPrefEquals(a: EntrySortPref, b: EntrySortPref): boolean {
  return a.key === b.key && a.dir === b.dir;
}
