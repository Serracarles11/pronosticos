import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { detectTicketPattern } from "../lib/betslip-import/detection/detect-ticket-pattern.ts";
import { splitOcrLines } from "../lib/betslip-import/normalization/normalize-text.ts";
import { parseBetSlipText, parseStructuredBetSlip } from "../lib/betslip-import/parse-betslip.ts";

test("new parser extracts a Bet365 combined slip without turning goal lines into odds", () => {
  const parsed = parseStructuredBetSlip(`
    Bet365
    Combinada
    Spain vs Brazil
    Both Teams To Score: Yes
    1.75
    Mexico vs Germany
    Over 2.5 Goals
    1.80
    Total Odds 3.15
  `);

  assert.equal(parsed.bookmaker, "bet365");
  assert.equal(parsed.type, "combined");
  assert.equal(parsed.selections.length, 2);
  assert.equal(parsed.selections[1].odds, 1.8);
  assert.match(parsed.selections[1].selection, /2\.5/);
  assert.equal(parsed.totalOddsMatch, true);
  assert.equal(parsed.orphanOdds.length, 0);
});

test("new parser detects bet builder style slips but keeps them in review", () => {
  const parsed = parseStructuredBetSlip(`
    Betfair
    Bet Builder
    Manchester City v Arsenal
    Over 1.5 goals + Both teams to score
    2.40
  `);

  assert.equal(parsed.bookmaker, "betfair");
  assert.equal(parsed.type, "single");
  assert.equal(parsed.selections.length, 1);
  assert.equal(parsed.selections[0].isBetBuilder, true);
  assert.equal(parsed.selections[0].market, "Bet builder");
  assert.equal(parsed.totalOdds, 2.4);
});

test("new parser reports mismatched total odds and does not create fake rows", () => {
  const parsed = parseStructuredBetSlip(`
    Bet365
    Spain vs Brazil
    Winner: Spain
    1.50
    Mexico vs Germany
    Winner: Mexico
    2.00
    Total Odds 9.99
  `);

  assert.equal(parsed.selections.length, 2);
  assert.equal(parsed.calculatedTotalOdds, 3);
  assert.equal(parsed.totalOddsDetected, 9.99);
  assert.equal(parsed.totalOddsMatch, false);
  assert.ok(parsed.warnings.some((warning) => warning.includes("cuota total")));
});

test("new parser keeps unknown OCR conservative and manual-review only", () => {
  const parsed = parseStructuredBetSlip(`
    Cuota total 9.99
    Stake 2 EUR
  `);

  assert.equal(parsed.bookmaker, "unknown");
  assert.equal(parsed.selections.length, 0);
  assert.equal(parsed.totalOddsDetected, 9.99);
  assert.ok(parsed.warnings.some((warning) => warning.includes("revision manual")));
});

test("legacy-compatible adapter includes confidence and debug metadata", () => {
  const parsed = parseBetSlipText(`
    Bet365
    Spain vs Brazil
    Winner: Spain
    1.50
  `);

  assert.equal(parsed.kind, "simple");
  assert.equal(parsed.selections.length, 1);
  assert.equal(typeof parsed.confidence, "number");
  assert.equal(parsed.debug?.parser, "partial-selection-list");
  assert.equal(parsed.ticketPattern, "single_selection_card");
});

const partialWinamaxText = readFileSync("tests/fixtures/winamax-partial-selection-list-01.txt", "utf8");
const noisyPartialWinamaxText = readFileSync("tests/fixtures/winamax-partial-selection-list-ocr-noisy-01.txt", "utf8");

test("detects partial selection list ticket pattern", () => {
  const pattern = detectTicketPattern(partialWinamaxText, splitOcrLines(partialWinamaxText));

  assert.equal(pattern.ticketPattern, "partial_selection_list");
  assert.equal(pattern.type, "combined");
});

test("parses Winamax partial selection list without stake or total odds", () => {
  const parsed = parseStructuredBetSlip(partialWinamaxText);

  assert.equal(parsed.bookmaker, "winamax");
  assert.equal(parsed.bookmakerConfidence, 0.6);
  assert.equal(parsed.ticketPattern, "partial_selection_list");
  assert.equal(parsed.type, "combined");
  assert.equal(parsed.stakeDetected, null);
  assert.equal(parsed.totalOddsDetected, null);
  assert.equal(parsed.potentialReturnDetected, null);
  assert.equal(parsed.selections.length, 8);
  assert.ok(parsed.warnings.some((warning) => warning.includes("Captura parcial")));
});

test("parses every expected selection from partial list", () => {
  const parsed = parseStructuredBetSlip(partialWinamaxText);
  const byEvent = new Map(parsed.selections.map((selection) => [selection.eventName, selection]));

  assert.equal(byEvent.get("México - Sudáfrica")?.market, "Resultado");
  assert.equal(byEvent.get("México - Sudáfrica")?.selection, "México");
  assert.equal(byEvent.get("México - Sudáfrica")?.odds, 1.42);

  assert.equal(byEvent.get("Corea del Sur - República Checa")?.market, "Número total de goles marcados por Corea del Sur");
  assert.equal(byEvent.get("Corea del Sur - República Checa")?.selection, "Más de 0,5");
  assert.equal(byEvent.get("Corea del Sur - República Checa")?.odds, 1.35);

  assert.equal(byEvent.get("Canadá - Bosnia y Herzegovina")?.market, "Ambos equipos marcan");
  assert.equal(byEvent.get("Canadá - Bosnia y Herzegovina")?.selection, "Sí");
  assert.equal(byEvent.get("Canadá - Bosnia y Herzegovina")?.odds, 2);

  assert.equal(byEvent.get("Estados Unidos - Paraguay")?.market, "MyMatch");
  assert.equal(
    byEvent.get("Estados Unidos - Paraguay")?.selection,
    "Doble oportunidad: Estados Unidos o empate + Número total de goles: Más de 0,5"
  );
  assert.equal(byEvent.get("Estados Unidos - Paraguay")?.odds, 1.43);
  assert.equal(byEvent.get("Estados Unidos - Paraguay")?.isBetBuilder, true);
  assert.equal(byEvent.get("Estados Unidos - Paraguay")?.builderType, "mymatch");

  assert.equal(byEvent.get("Catar - Suiza")?.market, "MyMatch");
  assert.equal(byEvent.get("Catar - Suiza")?.selection, "Resultado: Suiza + Doble oportunidad: Suiza o empate");
  assert.equal(byEvent.get("Catar - Suiza")?.odds, 1.21);

  assert.equal(byEvent.get("Brasil - Marruecos")?.market, "Hándicap");
  assert.equal(byEvent.get("Brasil - Marruecos")?.selection, "Brasil gana por al menos 3 goles de diferencia: No");
  assert.equal(byEvent.get("Brasil - Marruecos")?.odds, 1.13);

  assert.equal(byEvent.get("Haití - Escocia")?.market, "Número total de goles");
  assert.equal(byEvent.get("Haití - Escocia")?.selection, "Más de 0,5");
  assert.equal(byEvent.get("Haití - Escocia")?.odds, 1.03);

  assert.equal(byEvent.get("Australia - Turquía")?.market, "MyMatch");
  assert.equal(
    byEvent.get("Australia - Turquía")?.selection,
    "Número total de goles: Más de 0,5 + Doble oportunidad: Turquía o empate"
  );
  assert.equal(byEvent.get("Australia - Turquía")?.odds, 1.33);
});

test("partial parser does not confuse match times with odds and calculates total", () => {
  const parsed = parseStructuredBetSlip(partialWinamaxText);
  const expectedTotal = Number((1.42 * 1.35 * 2 * 1.43 * 1.21 * 1.13 * 1.03 * 1.33).toFixed(2));

  assert.equal(parsed.orphanOdds.length, 0);
  assert.equal(parsed.selections.some((selection) => selection.odds === 21), false);
  assert.equal(parsed.selections.some((selection) => selection.odds === 4), false);
  assert.equal(parsed.selections.some((selection) => selection.odds === 3), false);
  assert.equal(parsed.calculatedTotalOdds, expectedTotal);
});

test("parses the real noisy Winamax partial OCR case", () => {
  const parsed = parseStructuredBetSlip(noisyPartialWinamaxText);
  const byEvent = new Map(parsed.selections.map((selection) => [selection.eventName, selection]));
  const expectedTotal = Number((1.42 * 1.35 * 2 * 1.43 * 1.21 * 1.13 * 1.03 * 1.33).toFixed(2));

  assert.equal(parsed.ticketPattern, "partial_selection_list");
  assert.equal(parsed.selections.length, 8);
  assert.equal(parsed.totalOddsDetected, null);
  assert.equal(parsed.calculatedTotalOdds, expectedTotal);
  assert.equal(parsed.selections.some((selection) => selection.odds === 21), false);
  assert.equal(parsed.selections.some((selection) => selection.odds === 3), false);
  assert.equal(parsed.selections.some((selection) => selection.eventName === "Estados L"), false);
  assert.equal(parsed.selections.some((selection) => selection.market === "Sábado 3"), false);
  assert.equal(parsed.selections.some((selection) => selection.selection === "IOQ: MAT"), false);
  assert.ok(parsed.warnings.some((warning) => warning.includes("Captura parcial")));

  assert.equal(byEvent.get("México - Sudáfrica")?.market, "Resultado");
  assert.equal(byEvent.get("México - Sudáfrica")?.selection, "México");
  assert.equal(byEvent.get("México - Sudáfrica")?.odds, 1.42);
  assert.equal(byEvent.get("México - Sudáfrica")?.rawTime, "Jueves 21:00");

  assert.equal(byEvent.get("Corea del Sur - República Checa")?.market, "Número total de goles marcados por Corea del Sur");
  assert.equal(byEvent.get("Corea del Sur - República Checa")?.selection, "Más de 0,5");
  assert.equal(byEvent.get("Corea del Sur - República Checa")?.odds, 1.35);

  assert.equal(byEvent.get("Canadá - Bosnia y Herzegovina")?.market, "Ambos equipos marcan");
  assert.equal(byEvent.get("Canadá - Bosnia y Herzegovina")?.selection, "Sí");
  assert.equal(byEvent.get("Canadá - Bosnia y Herzegovina")?.odds, 2);

  assert.equal(byEvent.get("Estados Unidos - Paraguay")?.market, "MyMatch");
  assert.equal(
    byEvent.get("Estados Unidos - Paraguay")?.selection,
    "Doble oportunidad: Estados Unidos o empate + Número total de goles: Más de 0,5"
  );
  assert.equal(byEvent.get("Estados Unidos - Paraguay")?.odds, 1.43);
  assert.equal(byEvent.get("Estados Unidos - Paraguay")?.isBuilder, true);
  assert.equal(byEvent.get("Estados Unidos - Paraguay")?.builderType, "mymatch");
  assert.equal(byEvent.get("Estados Unidos - Paraguay")?.rawTime, "Sábado 3:00");

  assert.equal(byEvent.get("Catar - Suiza")?.market, "MyMatch");
  assert.equal(byEvent.get("Catar - Suiza")?.selection, "Resultado: Suiza + Doble oportunidad: Suiza o empate");
  assert.equal(byEvent.get("Catar - Suiza")?.odds, 1.21);
  assert.equal(byEvent.get("Catar - Suiza")?.rawTime, "Sábado 21:00");

  assert.equal(byEvent.get("Brasil - Marruecos")?.market, "Hándicap");
  assert.equal(byEvent.get("Brasil - Marruecos")?.selection, "Brasil gana por al menos 3 goles de diferencia: No");
  assert.equal(byEvent.get("Brasil - Marruecos")?.odds, 1.13);

  assert.equal(byEvent.get("Haití - Escocia")?.market, "Número total de goles");
  assert.equal(byEvent.get("Haití - Escocia")?.selection, "Más de 0,5");
  assert.equal(byEvent.get("Haití - Escocia")?.odds, 1.03);
  assert.equal(byEvent.get("Haití - Escocia")?.rawTime, "Domingo 3:00");

  assert.equal(byEvent.get("Australia - Turquía")?.market, "MyMatch");
  assert.equal(
    byEvent.get("Australia - Turquía")?.selection,
    "Número total de goles: Más de 0,5 + Doble oportunidad: Turquía o empate"
  );
  assert.equal(byEvent.get("Australia - Turquía")?.odds, 1.33);
});
