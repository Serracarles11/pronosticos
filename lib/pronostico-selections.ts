export type PronosticoSelection = {
  eventName: string;
  pick: string;
};

const SELECTION_DELIMITER = /\s+\+\s+(?=[^+]{1,140}:)/g;

export function parsePronosticoSelections(value: string): PronosticoSelection[] {
  const raw = value.trim();
  if (!raw) return [];

  return raw
    .split(SELECTION_DELIMITER)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const colonIndex = segment.indexOf(":");
      if (colonIndex === -1) {
        return { eventName: "", pick: segment };
      }

      const eventName = segment.slice(0, colonIndex).trim();
      const pick = segment.slice(colonIndex + 1).trim();
      return { eventName, pick: pick || segment };
    });
}

export function isCombinedPronostico(market: string, eventName?: string | null) {
  if ((eventName ?? "").toLowerCase().includes("combinada")) return true;
  return parsePronosticoSelections(market).length > 1;
}
