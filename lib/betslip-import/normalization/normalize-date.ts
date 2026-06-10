export function extractDateIso(text: string) {
  const match = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const currentYear = new Date().getFullYear();
  const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : currentYear;
  const hour = match[4] ? Number(match[4]) : 12;
  const minute = match[5] ? Number(match[5]) : 0;
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
