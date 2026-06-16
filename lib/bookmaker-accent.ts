export type BookmakerAccent = {
  className: string;
  label: string;
};

type BookmakerAccentDefinition = {
  id: string;
  label: string;
  aliases: string[];
};

const BOOKMAKER_ACCENTS: BookmakerAccentDefinition[] = [
  { id: "bet365", label: "bet365", aliases: ["bet365", "bet 365", "bet"] },
  { id: "winamax", label: "Winamax", aliases: ["winamax", "winamax.es"] },
  { id: "sportium", label: "Sportium", aliases: ["sportium", "dportium"] },
  { id: "betfair", label: "Betfair", aliases: ["betfair"] },
  { id: "betway", label: "Betway", aliases: ["betway"] },
  { id: "codere", label: "Codere", aliases: ["codere"] },
  { id: "luckia", label: "Luckia", aliases: ["luckia"] },
  { id: "bwin", label: "Bwin", aliases: ["bwin"] },
  { id: "betano", label: "Betano", aliases: ["betano"] },
  { id: "retabet", label: "Retabet", aliases: ["retabet", "reta"] },
  { id: "marathonbet", label: "Marathonbet", aliases: ["marathonbet", "marathon bet"] },
  { id: "williamhill", label: "William Hill", aliases: ["williamhill", "william hill"] },
  { id: "888sport", label: "888sport", aliases: ["888sport", "888 sport"] },
  { id: "kirolbet", label: "Kirolbet", aliases: ["kirolbet"] },
  { id: "paf", label: "PAF", aliases: ["paf"] },
];

function normalizeBookmaker(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function getBookmakerAccent(value: unknown): BookmakerAccent | null {
  const normalized = normalizeBookmaker(value);

  if (!normalized || normalized === "unknown" || normalized === "noindicar") return null;
  for (const bookmaker of BOOKMAKER_ACCENTS) {
    if (
      bookmaker.aliases.some((alias) => {
        const normalizedAlias = normalizeBookmaker(alias);
        return normalizedAlias === "bet" ? normalized === "bet" : normalized.includes(normalizedAlias);
      })
    ) {
      return { className: `pred--bookmaker-${bookmaker.id}`, label: bookmaker.label };
    }
  }

  return null;
}

export function getBookmakerAccentFromSources(...values: unknown[]): BookmakerAccent | null {
  for (const value of values) {
    const accent = getBookmakerAccent(value);
    if (accent) return accent;
  }

  return null;
}
