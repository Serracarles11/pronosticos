export function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function normalizeOcrText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[|]/g, " | ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitOcrLines(value: string) {
  return normalizeOcrText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function cleanLine(value: string) {
  return value.replace(/\s{2,}/g, " ").trim();
}

export function titleCaseEs(value: string) {
  return cleanLine(value)
    .toLocaleLowerCase("es-ES")
    .replace(/\p{L}+/gu, (word) => word.charAt(0).toLocaleUpperCase("es-ES") + word.slice(1));
}

export function removeOddsFromLine(value: string) {
  return cleanLine(value.replace(/(?:@|cuota\s*)?\d{1,5}[.,]\d{1,4}\b/gi, ""));
}
