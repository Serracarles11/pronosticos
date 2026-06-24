import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPronosticoSelectionPick,
  parsePronosticoSelections,
} from "../lib/pronostico-selections.ts";

test("formats player prop selections without the market prefix", () => {
  assert.equal(
    formatPronosticoSelectionPick("Jugador - Remates: Harry Kane: 4+ remates"),
    "Harry Kane: 4+ remates"
  );
  assert.equal(
    formatPronosticoSelectionPick("Jugador- Tiros: Jude Bellingham: 2+ tiros"),
    "Jude Bellingham: 2+ tiros"
  );
});

test("keeps non-player-hyphen markets unchanged", () => {
  assert.equal(formatPronosticoSelectionPick("Resultado: Inglaterra"), "Resultado: Inglaterra");
  assert.equal(formatPronosticoSelectionPick("Jugador decisivo: Tajon Buchanan"), "Jugador decisivo: Tajon Buchanan");
});

test("parses combined picks before formatting each selection", () => {
  const selections = parsePronosticoSelections(
    "Inglaterra v Croacia: Jugador - Remates: Harry Kane: 4+ remates + Inglaterra v Croacia: Jugador - Remates: Jude Bellingham: 2+ remates"
  );

  assert.deepEqual(
    selections.map((selection) => formatPronosticoSelectionPick(selection.pick)),
    ["Harry Kane: 4+ remates", "Jude Bellingham: 2+ remates"]
  );
});
