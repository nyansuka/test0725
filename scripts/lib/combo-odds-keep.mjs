/**
 * 組み合わせ券の板間引き。
 * 3連複・3連単は「最高オッズ順」だと当たる帯（複〜100倍、単〜200倍）が落ちる。
 * 本体の枠連〜馬単は従来どおり（odds≥8 の高い順40件）。
 */

/** 枠連・馬連・ワイド・馬単（本体ゲート用。変更しない） */
export const DEFAULT_COMBO_KEEP = {
  minOdds: 8,
  maxOdds: null,
  cap: 40,
  order: "desc",
};

/** 3連複研究所ゲート ≥100 の手前〜万馬券帯。安い順に残す */
export const TRIO_COMBO_KEEP = {
  minOdds: 80,
  maxOdds: 400,
  cap: 150,
  order: "asc",
};

/** 3連単研究所ゲート ≥200 の手前〜中高配当。安い順に残す */
export const TRIFECTA_COMBO_KEEP = {
  minOdds: 150,
  maxOdds: 800,
  cap: 200,
  order: "asc",
};

export function comboKeepPolicy(betType) {
  if (betType === "trio") return TRIO_COMBO_KEEP;
  if (betType === "trifecta") return TRIFECTA_COMBO_KEEP;
  return DEFAULT_COMBO_KEEP;
}

/**
 * @param {Array<{ selection?: string, odds: number }>} entries
 * @param {{ minOdds?: number, maxOdds?: number | null, cap?: number, order?: "asc" | "desc" }} policy
 */
export function keepComboOdds(entries, policy = DEFAULT_COMBO_KEEP) {
  const minOdds = policy.minOdds ?? 8;
  const maxOdds = policy.maxOdds ?? null;
  const cap = policy.cap ?? 40;
  const order = policy.order === "asc" ? "asc" : "desc";

  const filtered = entries.filter((e) => {
    if (!Number.isFinite(e.odds) || e.odds < minOdds) return false;
    if (maxOdds != null && e.odds > maxOdds) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const d = order === "asc" ? a.odds - b.odds : b.odds - a.odds;
    if (d !== 0) return d;
    return String(a.selection ?? "").localeCompare(String(b.selection ?? ""), "en");
  });

  return filtered.slice(0, cap);
}
