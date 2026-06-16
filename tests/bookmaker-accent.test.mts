import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getBookmakerAccent } from "../lib/bookmaker-accent.ts";
import { detectBookmaker } from "../lib/betslip-import/detection/detect-bookmaker.ts";

test("bookmaker accents map supported bookmakers to their own classes", () => {
  const cases = [
    ["bet365", "pred--bookmaker-bet365"],
    ["Winamax", "pred--bookmaker-winamax"],
    ["dportium", "pred--bookmaker-sportium"],
    ["Betfair", "pred--bookmaker-betfair"],
    ["Betway", "pred--bookmaker-betway"],
    ["Codere", "pred--bookmaker-codere"],
    ["Luckia", "pred--bookmaker-luckia"],
    ["Bwin", "pred--bookmaker-bwin"],
    ["Betano", "pred--bookmaker-betano"],
    ["Retabet", "pred--bookmaker-retabet"],
    ["Marathonbet", "pred--bookmaker-marathonbet"],
    ["William Hill", "pred--bookmaker-williamhill"],
    ["888sport", "pred--bookmaker-888sport"],
    ["Kirolbet", "pred--bookmaker-kirolbet"],
    ["PAF", "pred--bookmaker-paf"],
  ] as const;

  for (const [value, className] of cases) {
    assert.equal(getBookmakerAccent(value)?.className, className);
  }
});

test("betfair is not matched as bet365 by the short bet alias", () => {
  assert.equal(getBookmakerAccent("https://www.betfair.es/")?.className, "pred--bookmaker-betfair");
});

test("all known bookmaker accent classes render the top color bar", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.pred\[class\*="pred--bookmaker-"\]::after/);
});

test("OCR bookmaker detection includes newly colored bookmakers", () => {
  assert.equal(detectBookmaker("BETANO cuota total").bookmaker, "betano");
  assert.equal(detectBookmaker("William Hill apuesta combinada").bookmaker, "williamhill");
  assert.equal(detectBookmaker("RETABET boleto").bookmaker, "retabet");
});
