const MAX_COPY_LINK_LENGTH = 500;
const MAX_CATEGORIES = 8;
const MAX_CATEGORY_LENGTH = 28;

export function normalizeBetCopyLink(value: FormDataEntryValue | string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (raw.length > MAX_COPY_LINK_LENGTH) {
    throw new Error("El enlace para copiar la apuesta es demasiado largo.");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("El enlace para copiar la apuesta no es una URL valida.");
  }

  if (url.protocol !== "https:") {
    throw new Error("El enlace para copiar la apuesta debe usar HTTPS.");
  }

  if (url.username || url.password) {
    throw new Error("El enlace no puede incluir usuario o contrasena.");
  }

  return url.toString();
}

export function normalizePickCategory(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_CATEGORY_LENGTH);
}

export function normalizePickCategories(value: FormDataEntryValue | string | null) {
  const raw = String(value ?? "");
  const seen = new Set<string>();
  const categories: string[] = [];

  for (const item of raw.split(/[,;\n]/)) {
    const category = normalizePickCategory(item);
    if (!category || seen.has(category)) continue;

    seen.add(category);
    categories.push(category);
    if (categories.length >= MAX_CATEGORIES) break;
  }

  return categories;
}

export function formatPickCategory(category: string) {
  return category
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
