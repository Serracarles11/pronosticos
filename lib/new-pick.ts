export type DraftPickSelection = {
  eventName?: string;
  mercado?: string;
  seleccion?: string;
  cuota?: string;
  kickoffAt?: string;
};

export type PickFieldErrors = Partial<Record<"eventName" | "mercado" | "seleccion" | "cuota", string>>;

export function normalizeOddsText(value: string) {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return "";
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return "";
  return Math.max(1.01, Math.round(parsed * 100) / 100).toFixed(2);
}

export function suggestedDecimalOdds(value: string) {
  const compact = value.trim().replace(",", ".");
  if (!/^\d{3,4}$/.test(compact)) return null;
  const parsed = Number(compact);
  if (!Number.isFinite(parsed)) return null;
  const suggested = parsed / 100;
  if (suggested < 1.01) return null;
  return suggested.toFixed(2);
}

export function parseOddsValue(value: string) {
  const normalized = normalizeOddsText(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function impliedProbability(value: string) {
  const odds = parseOddsValue(value);
  if (!odds) return null;
  return Math.round((100 / odds) * 10) / 10;
}

export function oddsWarning(value: string) {
  const odds = parseOddsValue(value);
  if (!odds) return null;
  if (odds < 1.01) return "La cuota minima es 1.01.";
  if (odds >= 10) return "Cuota muy alta: revisa que este bien escrita.";
  if (odds > 3) return "Cuota alta: revisa que el valor sea correcto.";
  if (odds < 1.4 || odds > 2.5) return "Rango informativo recomendado: 1.40 - 2.50.";
  return null;
}

export function pickKind(selectionCount: number) {
  return selectionCount > 1 ? "combinada" : "simple";
}

export function selectionMarketLabel(selection: DraftPickSelection) {
  const market = (selection.mercado ?? "").trim();
  const pick = (selection.seleccion ?? "").trim();
  if (market && pick) return `${market}: ${pick}`;
  return market || pick;
}

export function validateDraftSelections(selections: DraftPickSelection[]) {
  const errors = selections.map<PickFieldErrors>((selection) => {
    const odds = parseOddsValue(selection.cuota ?? "");
    const rowErrors: PickFieldErrors = {};
    if (!(selection.eventName ?? "").trim()) rowErrors.eventName = "Falta el evento.";
    if (!(selection.mercado ?? "").trim()) rowErrors.mercado = "Falta el mercado.";
    if (!(selection.seleccion ?? "").trim()) rowErrors.seleccion = "Falta la seleccion.";
    if (!odds || odds < 1.01) rowErrors.cuota = "Cuota minima 1.01.";
    return rowErrors;
  });

  return {
    valid: errors.every((row) => Object.keys(row).length === 0),
    errors,
  };
}
