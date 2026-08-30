/**
 * 調教・馬体重の読み方（スコア外）。
 * Scorer / selectLongshots / 軸選定には混ぜない。
 */

import type { LongshotLabel, LongshotPick } from "./types";

export const STAY_RACE_VENUES = ["札幌", "函館", "小倉"] as const;

export type SupplementNoteSection = {
  id: "workout" | "weight";
  title: string;
  items: readonly string[];
};

export type SupplementCandidate = {
  number: number;
  name: string;
  label: LongshotLabel;
};

export type SupplementNotes = {
  /** 常に true。呼び出し側でスコア結合しないための目印 */
  scoreExcluded: true;
  workout: SupplementNoteSection;
  weight: SupplementNoteSection;
  /** 会場・季節から出る注意。データが無い項目の読み方だけ */
  raceHints: string[];
};

const WORKOUT_ITEMS = [
  "「追い切り絶好」など公開の称賛は人気に織り込み済み。加点材料にしない。",
  "他馬との調教時計の横比較はしない。その馬の過去調教との縦比較。",
  "見るのは本数（仕上げの本気度）と質（馬なりで出せたか、一杯か）。",
  "水曜の強め追い切りは日曜に疲れが残ることがある。直前が地味でも、1〜2週前に負荷があれば計算通りのこともある。",
  "いつものコースから変わっていたら事情を疑う。映像は必須ではない。",
] as const;

const WEIGHT_ITEMS = [
  "2桁増減だけで候補から消さない（±15kgの一律減点もしない）。",
  "−20kg以上は体調・仕上げすぎの疑い。ここだけ警戒する。",
  "＋20kgは好走率が少し落ちても、嫌われてオッズが開きやすい。減点しない。",
  "好走したときの体重が、その馬の適正目安。",
  "2〜3歳の増は成長、6歳以上の大幅増は太め残りを疑う。",
  "夏の減は夏バテ疑い。夏の増は食欲の証拠として見る。",
] as const;

export const WORKOUT_SECTION: SupplementNoteSection = {
  id: "workout",
  title: "調教",
  items: WORKOUT_ITEMS,
};

export const WEIGHT_SECTION: SupplementNoteSection = {
  id: "weight",
  title: "馬体重",
  items: WEIGHT_ITEMS,
};

export function isStayRaceVenue(venue: string): boolean {
  return (STAY_RACE_VENUES as readonly string[]).includes(venue);
}

/** 夏競馬の目安（6〜9月）。調教・体重の季節ヒント用 */
export function isSummerRaceDate(raceDate: string): boolean {
  const month = Number(raceDate.slice(5, 7));
  return Number.isFinite(month) && month >= 6 && month <= 9;
}

export function buildSupplementNotes(input: {
  venue: string;
  raceDate: string;
}): SupplementNotes {
  const raceHints: string[] = [];
  if (isStayRaceVenue(input.venue)) {
    raceHints.push(
      `${input.venue}は滞在競馬。馬体重が減っていたら輸送・環境不適応を疑う。`,
    );
  }
  if (isSummerRaceDate(input.raceDate)) {
    raceHints.push("夏開催。減は夏バテ疑い、増は食欲の証拠として見る。");
  }

  return {
    scoreExcluded: true,
    workout: WORKOUT_SECTION,
    weight: WEIGHT_SECTION,
    raceHints,
  };
}

/**
 * 補足で調教・馬体重を見る対象。注目穴を優先し、抑え候補と混ぜてラベルしない。
 */
export function supplementCandidatesFromPicks(
  picks: Pick<LongshotPick, "relatedHorseNumbers" | "label">[],
  horses: { number: number; name: string }[],
): SupplementCandidate[] {
  const byNumber = new Map<number, LongshotLabel>();
  for (const pick of picks) {
    for (const n of pick.relatedHorseNumbers ?? []) {
      const prev = byNumber.get(n);
      if (prev === "注目穴") continue;
      if (pick.label === "注目穴" || !prev) byNumber.set(n, pick.label);
    }
  }
  const nameOf = new Map(horses.map((h) => [h.number, h.name]));
  return [...byNumber.entries()]
    .map(([number, label]) => ({
      number,
      name: nameOf.get(number) ?? `#${number}`,
      label,
    }))
    .sort((a, b) => {
      if (a.label !== b.label) return a.label === "注目穴" ? -1 : 1;
      return a.number - b.number;
    });
}
