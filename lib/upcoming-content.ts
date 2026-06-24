export const LIVE_PRONOSTICO_WINDOW_MS = 3 * 60 * 60 * 1000;

export function isUpcomingOrUndated(value?: string | null, now = new Date()) {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp >= now.getTime() - LIVE_PRONOSTICO_WINDOW_MS;
}

export function upcomingPronosticoFilter(now = new Date()) {
  const visibleFrom = new Date(now.getTime() - LIVE_PRONOSTICO_WINDOW_MS);
  return `fecha_evento.is.null,fecha_evento.gte.${visibleFrom.toISOString()}`;
}

export function futureIsoFloor(value?: string | null, now = new Date()) {
  if (!value) return now.toISOString();
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp < now.getTime()) return now.toISOString();
  return new Date(timestamp).toISOString();
}
