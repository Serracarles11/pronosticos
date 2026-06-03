export type SpamSeverity = "low" | "medium" | "high";
export type ModerationStatus = "approved" | "pending_review" | "rejected" | "hidden";

const TRACKING_PARAMS = new Set(["utm_source", "utm_medium", "utm_campaign", "fbclid", "gclid"]);
const BLOCKED_PROTOCOLS = new Set(["javascript:", "data:", "file:"]);

export type NormalizedSpamUrl = {
  normalizedUrl: string;
  domain: string;
};

export type BlockedWord = {
  word: string;
  severity: SpamSeverity;
};

export type ModeratedItem = {
  user_id?: string | null;
  moderation_status?: ModerationStatus | null;
  is_shadowbanned?: boolean | null;
};

export function isRateLimited(currentCount: number, limit: number) {
  return currentCount >= limit;
}

export function isMaxPicksPerMatchExceeded(currentCount: number) {
  return isRateLimited(currentCount, 5);
}

export function isFollowLimitExceeded(currentCount: number) {
  return isRateLimited(currentCount, 50);
}

export function normalizeUrlForSpamCheck(rawUrl: string): NormalizedSpamUrl {
  const trimmed = rawUrl.trim();
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(candidate);

  if (BLOCKED_PROTOCOLS.has(url.protocol.toLowerCase())) {
    throw new Error("Enlace no permitido.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Los enlaces publicos deben usar HTTPS.");
  }

  url.hostname = url.hostname.toLowerCase();

  for (const param of Array.from(url.searchParams.keys())) {
    if (TRACKING_PARAMS.has(param.toLowerCase())) {
      url.searchParams.delete(param);
    }
  }

  const sortedParams = Array.from(url.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [key, value] of sortedParams) {
    url.searchParams.append(key, value);
  }

  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  const normalizedUrl = `${url.protocol}//${url.hostname}${url.pathname === "/" ? "" : url.pathname}${url.search}`;

  return {
    normalizedUrl,
    domain: url.hostname.replace(/^www\./, ""),
  };
}

export function extractUrlsFromText(text: string): NormalizedSpamUrl[] {
  const matches = text.match(/\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi) ?? [];
  const urls: NormalizedSpamUrl[] = [];

  for (const match of matches) {
    try {
      urls.push(normalizeUrlForSpamCheck(match));
    } catch {
      throw new Error("Enlace no permitido.");
    }
  }

  if (/\b(?:javascript|data|file):/i.test(text)) {
    throw new Error("Enlace no permitido.");
  }

  return urls;
}

export function buildEventKey(input: {
  eventId?: string | null;
  deporte?: string | null;
  competicion?: string | null;
  evento?: string | null;
  fechaEvento?: string | null;
}) {
  const eventId = input.eventId?.trim();
  if (eventId) return `event:${eventId.toLowerCase()}`;

  const normalizedEvento = normalizeToken(input.evento);
  if (normalizedEvento) return `event-name:${normalizedEvento}`;

  return [input.deporte, input.competicion, input.evento, input.fechaEvento]
    .map(normalizeToken)
    .filter(Boolean)
    .join("|");
}

function normalizeToken(value?: string | null) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function findBlockedWordsInText(text: string, words: BlockedWord[]) {
  const normalized = ` ${text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")} `;
  const matches = words.filter((item) => {
    const word = item.word.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!word) return false;
    return normalized.includes(` ${word} `) || normalized.includes(word);
  });

  const severityRank: Record<SpamSeverity, number> = { low: 1, medium: 2, high: 3 };
  const highest = matches.reduce<SpamSeverity | null>((current, item) => {
    if (!current || severityRank[item.severity] > severityRank[current]) return item.severity;
    return current;
  }, null);

  return { matches, highestSeverity: highest };
}

export function decideModerationStatus(input: {
  isNewUser: boolean;
  hasLink: boolean;
  blockedWordSeverity?: SpamSeverity | null;
  isShadowbanned?: boolean;
}): { blocked: boolean; status: ModerationStatus; reason?: string } {
  if (input.blockedWordSeverity === "high") {
    return { blocked: true, status: "rejected", reason: "blocked_word_high" };
  }

  if (input.isShadowbanned) {
    return { blocked: false, status: "approved", reason: "shadowbanned_user" };
  }

  if (input.blockedWordSeverity === "medium") {
    return { blocked: false, status: "pending_review", reason: "blocked_word_medium" };
  }

  if (input.blockedWordSeverity === "low" && input.isNewUser) {
    return { blocked: false, status: "pending_review", reason: "blocked_word_low_new_user" };
  }

  if (input.isNewUser && input.hasLink) {
    return { blocked: false, status: "pending_review", reason: "new_user_link" };
  }

  return { blocked: false, status: "approved" };
}

export function hasRepeatedLinkUse(
  recentLinks: Array<{ normalizedUrl?: string | null; domain?: string | null }>,
  incomingLinks: NormalizedSpamUrl[],
  maxUses = 3
) {
  return incomingLinks.some((incoming) => {
    const sameUrl = recentLinks.filter((item) => item.normalizedUrl === incoming.normalizedUrl).length;
    const sameDomain = recentLinks.filter((item) => item.domain === incoming.domain).length;
    return sameUrl >= maxUses || sameDomain >= maxUses;
  });
}

export function filterVisibleItemsForModeration<T extends ModeratedItem>(
  items: T[],
  currentUserId: string | null,
  mutedUserIds: Set<string>,
  isAdmin = false
) {
  return items.filter((item) => {
    const ownerId = item.user_id ?? null;
    const own = !!currentUserId && ownerId === currentUserId;
    if (ownerId && mutedUserIds.has(ownerId) && !own) return false;
    if (item.is_shadowbanned && !own && !isAdmin) return false;
    if ((item.moderation_status ?? "approved") !== "approved" && !own && !isAdmin) return false;
    return true;
  });
}
