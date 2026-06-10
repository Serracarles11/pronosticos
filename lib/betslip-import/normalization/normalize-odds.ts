export function normalizeDecimal(value: string) {
  const cleaned = value
    .replace(/^@/, "")
    .replace(/\s+/g, "")
    .replace(",", ".")
    .trim();
  return Number(cleaned);
}

export function roundOdds(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizeOdds(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const numberValue = typeof value === "number" ? value : normalizeDecimal(value);
  if (!Number.isFinite(numberValue) || numberValue < 1.01 || numberValue > 100000) return null;
  return roundOdds(numberValue);
}

export function extractLineOdds(line: string, max = 100000) {
  const matches = [...line.matchAll(/(?:@|cuota\s*)?(\d{1,5}[.,]\d{1,4})\b/gi)];
  for (const match of matches.reverse()) {
    const value = normalizeOdds(match[1]);
    if (value && value <= max) return value;
  }
  return null;
}

export function extractStandaloneOdds(line: string, max = 100000) {
  const match = line.trim().match(/^@?\s*(\d{1,5}[.,]\d{1,4})$/);
  if (!match) return null;
  const value = normalizeOdds(match[1]);
  return value && value <= max ? value : null;
}

export function calculateTotalOdds(selections: Array<{ odds: number | null }>) {
  const values = selections
    .map((selection) => selection.odds)
    .filter((odds): odds is number => typeof odds === "number" && Number.isFinite(odds) && odds >= 1.01);

  if (values.length === 0) return null;
  return roundOdds(values.reduce((acc, odds) => acc * odds, 1));
}

export function oddsMatch(calculated: number | null, detected: number | null) {
  if (!calculated || !detected) return null;
  const diff = Math.abs(calculated - detected);
  return diff <= 0.1 || diff <= detected * 0.005;
}
