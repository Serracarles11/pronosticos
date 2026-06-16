export function isUpcomingOrUndated(value?: string | null, now = new Date()) {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp >= now.getTime();
}

export function upcomingPronosticoFilter(now = new Date()) {
  return `fecha_evento.is.null,fecha_evento.gte.${now.toISOString()}`;
}

export function futureIsoFloor(value?: string | null, now = new Date()) {
  if (!value) return now.toISOString();
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp < now.getTime()) return now.toISOString();
  return new Date(timestamp).toISOString();
}
