import { cleanLine } from "./normalize-text.ts";

const SELECTION_TRANSLATIONS: Array<[RegExp, string]> = [
  [/^yes$/i, "Si"],
  [/^no$/i, "No"],
  [/^over\s+(.+)$/i, "Mas de $1"],
  [/^under\s+(.+)$/i, "Menos de $1"],
  [/^draw$/i, "Empate"],
];

export function normalizeSelection(value: string) {
  const cleaned = cleanLine(value.replace(/^selecci[oó]n\s*:?\s*/i, ""));
  for (const [pattern, replacement] of SELECTION_TRANSLATIONS) {
    if (pattern.test(cleaned)) return cleaned.replace(pattern, replacement);
  }
  return cleaned;
}
