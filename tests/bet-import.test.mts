import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canPublishBetImport, canUserReadBetImport } from "../lib/bet-import/access.ts";
import {
  calculateTotalOdds,
  detectBookmaker,
  extractOdds,
  parseBetSlipText,
  parseWinamaxBetSlipText,
} from "../lib/bet-import/parser.ts";
import { BETSLIP_MAX_FILE_SIZE, validateBetSlipImage } from "../lib/bet-import/validators.ts";

test("validates supported betslip image types", () => {
  assert.equal(validateBetSlipImage({ name: "ticket.png", size: 1024, type: "image/png" }).ok, true);
  assert.equal(validateBetSlipImage({ name: "ticket.jpg", size: 1024, type: "image/jpeg" }).ok, true);
  assert.equal(validateBetSlipImage({ name: "ticket.webp", size: 1024, type: "image/webp" }).ok, true);
});

test("rejects oversized betslip images", () => {
  const result = validateBetSlipImage({
    name: "ticket.png",
    size: BETSLIP_MAX_FILE_SIZE + 1,
    type: "image/png",
  });

  assert.equal(result.ok, false);
});

test("rejects svg betslip uploads", () => {
  const result = validateBetSlipImage({
    name: "ticket.svg",
    size: 1024,
    type: "image/svg+xml",
  });

  assert.equal(result.ok, false);
});

test("extracts odds with decimal point and comma", () => {
  assert.deepEqual(extractOdds("Real Madrid @1.75\nBarcelona Cuota 2,10"), [1.75, 2.1]);
});

test("detects supported bookmakers", () => {
  assert.equal(detectBookmaker("Combinada Winamax cuota total 3.50"), "Winamax");
  assert.equal(detectBookmaker("BET365 Mi apuesta @1.80"), "Bet365");
});

test("detects combinada and calculates total odds", () => {
  const parsed = parseBetSlipText(`
    Spain vs Brazil Ambos marcan Si 1,75
    Mexico vs Germany Mas de 2.5 goles @1.80
    Cuota total 3.15
  `);

  assert.equal(parsed.kind, "combinada");
  assert.equal(parsed.selections.length, 2);
  assert.equal(calculateTotalOdds(parsed.selections), 3.15);
  assert.equal(parsed.detectedTotalOdds, 3.15);
});

test("parser tolerates imperfect OCR lines", () => {
  const parsed = parseBetSlipText(`
    betfair
    Manchestcr City v Arsenal
    Ganador local @1,62
    ganancias potenciales 12,44
  `);

  assert.equal(parsed.bookmaker, "Betfair");
  assert.equal(parsed.kind, "simple");
  assert.equal(parsed.selections[0].odds, 1.62);
  assert.equal(parsed.totalOdds, 1.62);
});

const winamaxSlip = `
  Winamax
  Importe 2 €
  CUOTA 65,49
  Ganancia potencial 136,13 €
  Combo booster 4,00%

  DINAMARCA - UCRANIA
  Ambos equipos marcan: Sí
  1,98

  CROACIA - ESLOVENIA
  Número total de goles marcados por Croacia: Más de 1,5
  1,62

  MARRUECOS - NORUEGA
  MYMATCH
  Resultado: Noruega
  Ambos equipos marcan: Sí
  4,00

  GRECIA - ITALIA
  MYMATCH
  Ambos equipos marcan: Sí
  Córners - Resultado: Italia
  4,40

  ECUADOR - GUATEMALA
  Resultado: Ecuador
  1,16
`;

test("winamax parser detects totals without creating a fake 65.49 selection", () => {
  const parsed = parseWinamaxBetSlipText(winamaxSlip);

  assert.equal(parsed.bookmaker, "winamax");
  assert.equal(parsed.kind, "combinada");
  assert.equal(parsed.stakeSimulated, 2);
  assert.equal(parsed.detectedTotalOdds, 65.49);
  assert.equal(parsed.potentialReturnDetected, 136.13);
  assert.equal(parsed.boosterPercent, 4);
  assert.equal(parsed.selections.length, 5);
  assert.equal(parsed.selections.some((selection) => selection.odds === 65.49), false);
});

test("winamax parser extracts real selections and MyMatch as composed picks", () => {
  const parsed = parseBetSlipText(winamaxSlip);

  assert.deepEqual(
    parsed.selections.map((selection) => ({
      eventName: selection.eventName,
      market: selection.market,
      selection: selection.selection,
      odds: selection.odds,
    })),
    [
      {
        eventName: "Dinamarca - Ucrania",
        market: "Ambos equipos marcan",
        selection: "Sí",
        odds: 1.98,
      },
      {
        eventName: "Croacia - Eslovenia",
        market: "Número total de goles marcados por Croacia",
        selection: "Más de 1,5",
        odds: 1.62,
      },
      {
        eventName: "Marruecos - Noruega",
        market: "MyMatch",
        selection: "Resultado: Noruega + Ambos equipos marcan: Sí",
        odds: 4,
      },
      {
        eventName: "Grecia - Italia",
        market: "MyMatch",
        selection: "Ambos equipos marcan: Sí + Córners - Resultado: Italia",
        odds: 4.4,
      },
      {
        eventName: "Ecuador - Guatemala",
        market: "Resultado",
        selection: "Ecuador",
        odds: 1.16,
      },
    ]
  );
  assert.equal(calculateTotalOdds(parsed.selections), 65.49);
  assert.equal(parsed.totalOddsMatch, true);
});

const imperfectWinamaxOcr = `
APUESTA DE NUTRIA.39738
DOMINGO, 7JUNID 2026
2â‚¬
CU
65,49
EN CURSO
DINAMARCA - UCRANIA
07/06/2026
Ambos equipos marcan: Si
1,98
CROACIA - ESLOVENIA
07/06/2026
NÃºmero total de goles marcados por Croacia: MÃ¡s de 15
1,62
MARRUECOS - NORUEGA
07/06/2026
MATCH
Resultado: Maruega
Ambos equipos marcan: Si
4,00
GRECA - ITALIA
07/06/2026
MATCH
Ambos equipos marcan: SÃ­
CÃ³meres - Resultado: Mala
4,40
ECUADOR - GUATEMALA
07/06/2026
Resultado: Emrador
1,16
`;

test("winamax parser handles imperfect OCR header and does not use title id as stake", () => {
  const parsed = parseBetSlipText(imperfectWinamaxOcr);

  assert.equal(parsed.bookmaker, "winamax");
  assert.equal(parsed.kind, "combinada");
  assert.equal(parsed.stakeSimulated, 2);
  assert.notEqual(parsed.stakeSimulated, 39738);
  assert.equal(parsed.detectedTotalOdds, 65.49);
  assert.equal(parsed.selections.some((selection) => selection.odds === 65.49), false);
  assert.equal(parsed.selections.some((selection) => selection.eventName === ""), false);
  assert.equal(parsed.selections.length, 5);
});

test("winamax parser corrects OCR errors by event context", () => {
  const parsed = parseBetSlipText(imperfectWinamaxOcr);

  assert.deepEqual(
    parsed.selections.map((selection) => ({
      eventName: selection.eventName,
      market: selection.market,
      selection: selection.selection,
      odds: selection.odds,
    })),
    [
      {
        eventName: "Dinamarca - Ucrania",
        market: "Ambos equipos marcan",
        selection: "Sí",
        odds: 1.98,
      },
      {
        eventName: "Croacia - Eslovenia",
        market: "Número total de goles marcados por Croacia",
        selection: "Más de 1,5",
        odds: 1.62,
      },
      {
        eventName: "Marruecos - Noruega",
        market: "MyMatch",
        selection: "Resultado: Noruega + Ambos equipos marcan: Sí",
        odds: 4,
      },
      {
        eventName: "Grecia - Italia",
        market: "MyMatch",
        selection: "Ambos equipos marcan: Sí + Córners - Resultado: Italia",
        odds: 4.4,
      },
      {
        eventName: "Ecuador - Guatemala",
        market: "Resultado",
        selection: "Ecuador",
        odds: 1.16,
      },
    ]
  );

  assert.equal(calculateTotalOdds(parsed.selections), 65.49);
  assert.equal(parsed.totalOddsMatch, true);
  assert.equal(parsed.detectedTotalOdds, 65.49);
  assert.notEqual(parsed.detectedTotalOdds, 4.4);
});

test("winamax parser exposes OCR correction warnings", () => {
  const parsed = parseBetSlipText(imperfectWinamaxOcr);

  assert.ok(parsed.warnings.some((warning) => warning.includes("GRECA") && warning.includes("Grecia")));
  assert.ok(parsed.warnings.some((warning) => warning.includes("Cómeres") && warning.includes("Córners")));
  assert.ok(parsed.warnings.some((warning) => warning.includes("Mala") && warning.includes("Italia")));
  assert.ok(parsed.warnings.some((warning) => warning.includes("Emrador") && warning.includes("Ecuador")));
  assert.ok(parsed.warnings.some((warning) => warning.includes("Maruega") && warning.includes("Noruega")));
  assert.ok(parsed.warnings.some((warning) => warning.includes("Más de 15") && warning.includes("Más de 1,5")));
});

test("winamax parser detects potential return and booster when OCR includes them", () => {
  const parsed = parseBetSlipText(`
    ${imperfectWinamaxOcr}
    Ganancia potencial 136,13 â‚¬
    Combo booster 4,00%
  `);

  assert.equal(parsed.potentialReturnDetected, 136.13);
  assert.equal(parsed.boosterPercent, 4);
  assert.equal(parsed.selections.some((selection) => selection.odds === 4 && selection.rawText.includes("booster")), false);
});

test("winamax parser flags mismatch without adding total odds as selection", () => {
  const parsed = parseWinamaxBetSlipText(winamaxSlip.replace("CUOTA 65,49", "CUOTA 70,00"));

  assert.equal(parsed.detectedTotalOdds, 70);
  assert.equal(calculateTotalOdds(parsed.selections), 65.49);
  assert.equal(parsed.totalOddsMatch, false);
  assert.equal(parsed.selections.some((selection) => selection.odds === 70), false);
});

test("parser does not create empty rows from orphan total odds", () => {
  const parsed = parseBetSlipText(`
    Winamax
    Importe 2 €
    Cuota total 65,49
    Ganancia potencial 136,13 €
    Combo booster 4,00%
  `);

  assert.equal(parsed.detectedTotalOdds, 65.49);
  assert.equal(parsed.stakeSimulated, 2);
  assert.equal(parsed.potentialReturnDetected, 136.13);
  assert.equal(parsed.boosterPercent, 4);
  assert.equal(parsed.selections.length, 0);
});

test("user cannot read another user's import unless admin", () => {
  const row = { user_id: "user-a" };
  assert.equal(canUserReadBetImport(row, "user-a"), true);
  assert.equal(canUserReadBetImport(row, "user-b"), false);
  assert.equal(canUserReadBetImport(row, "user-b", true), true);
});

test("imports are not publishable before user confirmation state", () => {
  assert.equal(canPublishBetImport("uploaded"), false);
  assert.equal(canPublishBetImport("processing"), false);
  assert.equal(canPublishBetImport("failed"), false);
  assert.equal(canPublishBetImport("processed"), true);
  assert.equal(canPublishBetImport("confirmed"), false);
});

test("migration does not create a public storage bucket", () => {
  const migration = readFileSync("supabase/17_import_betslip_ocr.sql", "utf8");
  assert.match(migration, /'bet-imports'/);
  assert.match(migration, /false,\s*\n\s*5242880/);
  assert.doesNotMatch(migration, /public\s*=\s*true/i);
});
