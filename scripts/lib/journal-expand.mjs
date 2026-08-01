/** 成績日記の買い目展開（scripts / テスト用）。src/domain/journal.ts と同期すること。 */

function parseSelectionNumbers(selection) {
  return String(selection)
    .split(/[-–—/]/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function selectionLegCount(betType) {
  if (betType === "win" || betType === "place") return 1;
  if (betType === "trio" || betType === "trifecta") return 3;
  return 2;
}

function formatTicket(betType, nums) {
  const unordered = new Set(["quinella", "wide", "bracket_quinella", "trio"]);
  const legs = unordered.has(betType) ? [...nums].sort((a, b) => a - b) : nums;
  return legs.join("-");
}

export function expandSelectionTickets(betType, raw) {
  const normalized = raw
    .trim()
    .replace(/[＝=]/g, "-")
    .replace(/[－ー−]/g, "-")
    .replace(/[、]/g, ",");
  if (!normalized) return [];

  const parts = normalized
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];

  const legCount = selectionLegCount(betType);
  const parsedParts = parts.map((p) => parseSelectionNumbers(p));

  if (legCount === 1) {
    const nums = parsedParts.flat();
    return [...new Set(nums)].map(String);
  }

  if (parts.length >= 2 && parsedParts.every((n) => n.length >= legCount)) {
    const tickets = parsedParts.map((n) => formatTicket(betType, n.slice(0, legCount)));
    return [...new Set(tickets)];
  }

  if (
    legCount === 2 &&
    parts.length >= 2 &&
    parsedParts[0].length === 2 &&
    parsedParts.slice(1).every((n) => n.length === 1)
  ) {
    const [axis, firstPartner] = parsedParts[0];
    const partners = [firstPartner, ...parsedParts.slice(1).map((n) => n[0])];
    const tickets = partners
      .filter((p) => p !== axis)
      .map((p) => formatTicket(betType, [axis, p]));
    return [...new Set(tickets)];
  }

  if (
    legCount === 3 &&
    parts.length >= 2 &&
    parsedParts[0].length === 3 &&
    parsedParts.slice(1).every((n) => n.length === 1)
  ) {
    const [a, b, firstC] = parsedParts[0];
    const thirds = [firstC, ...parsedParts.slice(1).map((n) => n[0])];
    const tickets = thirds
      .filter((c) => c !== a && c !== b)
      .map((c) =>
        betType === "trifecta" ? `${a}-${b}-${c}` : formatTicket(betType, [a, b, c]),
      );
    return [...new Set(tickets)];
  }

  const nums = parseSelectionNumbers(normalized);
  if (nums.length === 0) return [normalized];
  if (nums.length < legCount) return [normalized];
  return [formatTicket(betType, nums.slice(0, legCount))];
}
