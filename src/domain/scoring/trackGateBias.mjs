/**
 * トラックバイアス仮ルール（芝=内枠有利 / ダート=外枠有利）。
 * fetcher と Scorer の単一ソース。
 *
 * 加点帯: 内枠 1〜3 / 外枠 6〜8（標準8枠の両端3枠）
 */
export function trackGateBiasScore(track, bracket) {
  if (bracket == null || !Number.isFinite(Number(bracket))) return 50;
  const b = Number(bracket);
  const favored =
    track === "ダート" ? b >= 6 : b <= 3;
  return favored ? 62 : 54;
}
