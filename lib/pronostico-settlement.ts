export function canSettlePronostico(fechaEvento: string | null, estado: string, now = new Date()) {
  if (!fechaEvento || estado !== "pendiente") return false;
  const eventTime = new Date(fechaEvento).getTime();
  if (!Number.isFinite(eventTime)) return false;
  return now.getTime() >= eventTime;
}
