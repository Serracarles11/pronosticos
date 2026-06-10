import { splitOcrLines } from "../normalization/normalize-text.ts";

export function extractOcrLines(text: string) {
  return splitOcrLines(text).map((line, index) => ({
    index,
    text: line,
  }));
}
