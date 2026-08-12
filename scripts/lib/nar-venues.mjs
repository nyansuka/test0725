/**
 * NAR 会場マスタ（公式 CSV の漢字名 ↔ netkeiba code / slug）
 */
export const NAR_VENUES = [
  { code: "42", name: "浦和", slug: "urawa", region: "南関東", phase: 1 },
  { code: "43", name: "船橋", slug: "funabashi", region: "南関東", phase: 1 },
  { code: "44", name: "大井", slug: "oi", region: "南関東", phase: 1 },
  { code: "45", name: "川崎", slug: "kawasaki", region: "南関東", phase: 1 },
  { code: "30", name: "門別", slug: "monbetsu", region: "北海道", phase: 2 },
  { code: "35", name: "盛岡", slug: "morioka", region: "東北", phase: 2 },
  { code: "36", name: "水沢", slug: "mizusawa", region: "東北", phase: 2 },
  { code: "46", name: "金沢", slug: "kanazawa", region: "北陸", phase: 2 },
  { code: "47", name: "笠松", slug: "kasamatsu", region: "東海", phase: 2 },
  { code: "48", name: "名古屋", slug: "nagoya", region: "東海", phase: 2 },
  { code: "50", name: "園田", slug: "sonoda", region: "兵庫", phase: 2 },
  { code: "51", name: "姫路", slug: "himeji", region: "兵庫", phase: 2 },
  { code: "54", name: "高知", slug: "kochi", region: "四国", phase: 2 },
  { code: "55", name: "佐賀", slug: "saga", region: "九州", phase: 2 },
  // ばんえい等（公式に出る場合）
  { code: "65", name: "帯広", slug: "obihiro", region: "ばんえい", phase: 3 },
];

const byName = new Map(NAR_VENUES.map((v) => [v.name, v]));
const byCode = new Map(NAR_VENUES.map((v) => [v.code, v]));

export function venueByName(name) {
  return byName.get(name) ?? null;
}

export function venueByCode(code) {
  return byCode.get(String(code).padStart(2, "0")) ?? null;
}

export function slugForVenueName(name) {
  return venueByName(name)?.slug ?? String(name);
}

/** 南関東4場名 */
export const MINAMI_KANTO_NAMES = NAR_VENUES.filter((v) => v.region === "南関東").map((v) => v.name);

export function parseVenueFilter(arg) {
  if (!arg || arg === "all") return null;
  if (arg === "南関東" || arg === "minami-kanto" || arg === "p1") {
    return new Set(MINAMI_KANTO_NAMES);
  }
  return new Set(
    arg
      .split(/[,、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}
