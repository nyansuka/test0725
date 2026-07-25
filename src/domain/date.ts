/** 日本時間（Asia/Tokyo）の暦日を YYYY-MM-DD で返す */
export function getJstDateString(base: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
}

/** JST の YYYY-MM-DD を日数分ずらす */
export function shiftJstDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  // 正午 UTC 付近でずらし、DST のない JST 日付を安定させる
  const utc = Date.UTC(y, m - 1, d, 3, 0, 0);
  const shifted = new Date(utc + deltaDays * 24 * 60 * 60 * 1000);
  return getJstDateString(shifted);
}

/** 表示用（例: 2026年7月25日（土）） */
export function formatJstDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(utc);
}
