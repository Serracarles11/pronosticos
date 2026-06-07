export function normalizeOcrText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeDecimal(value: string) {
  return Number(value.replace(",", ".").replace(/^@/, ""));
}

export function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function roundOdds(value: number) {
  return Math.round(value * 100) / 100;
}
