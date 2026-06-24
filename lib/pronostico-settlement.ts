const ESTIMATED_FOOTBALL_MATCH_DURATION_MS = 2 * 60 * 60 * 1000;
const SETTLEMENT_DELAY_AFTER_MATCH_MS = 2 * 60 * 60 * 1000;

export function getPronosticoSettlementAvailableAt(fechaEvento: string | null) {
  if (!fechaEvento) return null;
  const eventTime = new Date(fechaEvento).getTime();
  if (!Number.isFinite(eventTime)) return null;

  return new Date(
    eventTime + ESTIMATED_FOOTBALL_MATCH_DURATION_MS + SETTLEMENT_DELAY_AFTER_MATCH_MS
  );
}

export function canSettlePronostico(fechaEvento: string | null, estado: string, now = new Date()) {
  void fechaEvento;
  void now;
  return estado === "pendiente";
}
