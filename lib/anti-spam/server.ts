import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildEventKey,
  decideModerationStatus as decideModerationStatusPure,
  extractUrlsFromText,
  findBlockedWordsInText,
  hasRepeatedLinkUse,
  isFollowLimitExceeded,
  isMaxPicksPerMatchExceeded,
  isRateLimited,
  type BlockedWord,
  type ModerationStatus,
  type SpamSeverity,
} from "./pure";

type SupabaseLike = Pick<SupabaseClient, "from">;

type AntiSpamResult = { allowed: true } | { allowed: false; error: string };

export function isMissingOptionalSchema(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    error?.message?.toLowerCase().includes("schema cache") === true ||
    error?.message?.toLowerCase().includes("does not exist") === true
  );
}

export async function logAntiSpamEvent(
  supabase: SupabaseLike,
  input: {
    userId: string;
    eventType: string;
    targetType?: string | null;
    targetId?: string | null;
    severity?: "info" | SpamSeverity;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("anti_spam_events").insert({
    user_id: input.userId,
    event_type: input.eventType,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    severity: input.severity ?? "low",
    reason: input.reason ?? null,
    metadata_json: input.metadata ?? {},
  });

  if (error && !isMissingOptionalSchema(error)) {
    console.error("anti_spam_event_error", error.message);
  }
}

export async function checkPickRateLimit(supabase: SupabaseLike, userId: string): Promise<AntiSpamResult> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("pronosticos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) return { allowed: true };
  if (!isRateLimited(count ?? 0, 5)) return { allowed: true };

  await logAntiSpamEvent(supabase, {
    userId,
    eventType: "pick_rate_limit",
    targetType: "pronostico",
    severity: "medium",
    reason: "5 picks per hour exceeded",
    metadata: { limit: 5, window: "1h" },
  });
  return { allowed: false, error: "Has alcanzado el limite de 5 pronosticos por hora. Intentalo mas tarde." };
}

export async function checkMaxPicksPerMatch(
  supabase: SupabaseLike,
  userId: string,
  eventKey: string
): Promise<AntiSpamResult> {
  if (!eventKey) return { allowed: true };
  const { count, error } = await supabase
    .from("pronosticos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_key", eventKey);

  if (isMissingOptionalSchema(error)) return { allowed: true };
  if (error) return { allowed: true };
  if (!isMaxPicksPerMatchExceeded(count ?? 0)) return { allowed: true };

  await logAntiSpamEvent(supabase, {
    userId,
    eventType: "max_picks_per_match",
    targetType: "pronostico",
    severity: "medium",
    reason: "5 picks for the same match exceeded",
    metadata: { event_key: eventKey, limit: 5 },
  });
  return { allowed: false, error: "Solo puedes crear un maximo de 5 pronosticos por partido." };
}

export async function checkCommentRateLimit(supabase: SupabaseLike, userId: string): Promise<AntiSpamResult> {
  const since = new Date(Date.now() - 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("comentarios")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) return { allowed: true };
  if (!isRateLimited(count ?? 0, 5)) return { allowed: true };

  await logAntiSpamEvent(supabase, {
    userId,
    eventType: "comment_rate_limit",
    targetType: "comentario",
    severity: "medium",
    reason: "5 comments per minute exceeded",
    metadata: { limit: 5, window: "1m" },
  });
  return { allowed: false, error: "Estas comentando demasiado rapido. Espera un momento." };
}

export async function checkFollowRateLimit(supabase: SupabaseLike, userId: string): Promise<AntiSpamResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count: followsCount, error: followsError }, { count: requestsCount, error: requestsError }] =
    await Promise.all([
      supabase
        .from("seguimientos")
        .select("follower_id", { count: "exact", head: true })
        .eq("follower_id", userId)
        .gte("created_at", since),
      supabase
        .from("seguimiento_solicitudes")
        .select("follower_id", { count: "exact", head: true })
        .eq("follower_id", userId)
        .gte("created_at", since),
    ]);

  const total = (followsError ? 0 : followsCount ?? 0) + (requestsError ? 0 : requestsCount ?? 0);
  if (!isFollowLimitExceeded(total)) return { allowed: true };

  await logAntiSpamEvent(supabase, {
    userId,
    eventType: "follow_rate_limit",
    targetType: "seguimiento",
    severity: "medium",
    reason: "50 follows per day exceeded",
    metadata: { limit: 50, window: "24h" },
  });
  return { allowed: false, error: "Has alcanzado el limite diario de seguimientos." };
}

export async function checkRepeatedLinks(
  supabase: SupabaseLike,
  userId: string,
  input: string
): Promise<AntiSpamResult & { hasLinks?: boolean; links?: ReturnType<typeof extractUrlsFromText> }> {
  let links: ReturnType<typeof extractUrlsFromText>;
  try {
    links = extractUrlsFromText(input);
  } catch {
    await logAntiSpamEvent(supabase, {
      userId,
      eventType: "repeated_link",
      severity: "medium",
      reason: "unsafe link protocol",
    });
    return { allowed: false, error: "Este enlace se ha usado demasiadas veces recientemente." };
  }

  if (links.length === 0) return { allowed: true, hasLinks: false, links };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("anti_spam_events")
    .select("metadata_json")
    .eq("user_id", userId)
    .eq("event_type", "link_seen")
    .gte("created_at", since)
    .limit(300);

  if (isMissingOptionalSchema(error)) return { allowed: true, hasLinks: true, links };
  if (error) return { allowed: true, hasLinks: true, links };

  const recentLinks = (data ?? []).map((event: { metadata_json?: Record<string, unknown> | null }) => ({
    normalizedUrl: String(event.metadata_json?.normalized_url ?? ""),
    domain: String(event.metadata_json?.domain ?? ""),
  }));

  if (!hasRepeatedLinkUse(recentLinks, links)) {
    return { allowed: true, hasLinks: true, links };
  }

  await logAntiSpamEvent(supabase, {
    userId,
    eventType: "repeated_link",
    severity: "medium",
    reason: "same url or domain used more than 3 times in 24h",
    metadata: { links },
  });
  return { allowed: false, error: "Este enlace se ha usado demasiadas veces recientemente.", hasLinks: true, links };
}

export async function recordLinkUsage(
  supabase: SupabaseLike,
  userId: string,
  links: Array<{ normalizedUrl: string; domain: string }> | undefined,
  targetType: string,
  targetId?: string | null
) {
  if (!links?.length) return;
  await Promise.all(
    links.map((link) =>
      logAntiSpamEvent(supabase, {
        userId,
        eventType: "link_seen",
        targetType,
        targetId,
        severity: "info",
        reason: "link usage recorded",
        metadata: { normalized_url: link.normalizedUrl, domain: link.domain },
      })
    )
  );
}

export async function checkBlockedWords(supabase: SupabaseLike, text: string) {
  const { data, error } = await supabase
    .from("blocked_words")
    .select("word, severity")
    .eq("is_active", true);

  if (isMissingOptionalSchema(error) || error) {
    return { matches: [], highestSeverity: null as SpamSeverity | null };
  }

  return findBlockedWordsInText(
    text,
    (data ?? []).map((word: { word: string; severity: SpamSeverity }) => ({
      word: word.word,
      severity: word.severity,
    })) satisfies BlockedWord[]
  );
}

export async function isNewUser(supabase: SupabaseLike, userId: string) {
  const { data: profile } = await supabase.from("profiles").select("created_at").eq("id", userId).maybeSingle();
  const createdAt = profile?.created_at ? new Date(profile.created_at).getTime() : Date.now();
  const youngerThan48h = Date.now() - createdAt < 48 * 60 * 60 * 1000;

  const { count, error } = await supabase
    .from("pronosticos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("moderation_status", "approved");

  if (isMissingOptionalSchema(error)) return youngerThan48h;
  return youngerThan48h || (count ?? 0) < 3;
}

export async function isUserShadowbanned(supabase: SupabaseLike, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_shadowbanned")
    .eq("id", userId)
    .maybeSingle();

  if (isMissingOptionalSchema(error) || error) return false;
  return !!data?.is_shadowbanned;
}

export function decideModerationStatus(input: Parameters<typeof decideModerationStatusPure>[0]) {
  return decideModerationStatusPure(input);
}

export async function getMutedUserIds(supabase: SupabaseLike, currentUserId?: string | null) {
  if (!currentUserId) return new Set<string>();
  const { data, error } = await supabase
    .from("user_mutes")
    .select("muted_user_id")
    .eq("muter_user_id", currentUserId);

  if (isMissingOptionalSchema(error) || error) return new Set<string>();
  return new Set((data ?? []).map((item: { muted_user_id: string }) => item.muted_user_id));
}

export function filterMutedUsersFromFeed<T extends { user_id?: string | null }>(
  currentUserId: string | null,
  mutedUserIds: Set<string>,
  items: T[]
) {
  return items.filter((item) => !item.user_id || item.user_id === currentUserId || !mutedUserIds.has(item.user_id));
}

export async function reviewContentForSpam(
  supabase: SupabaseLike,
  input: {
    userId: string;
    text: string;
    targetType: "pronostico" | "comentario" | "profile";
  }
): Promise<{
  allowed: boolean;
  error?: string;
  moderationStatus: ModerationStatus;
  hasLinks: boolean;
  links: Array<{ normalizedUrl: string; domain: string }>;
}> {
  const linksResult = await checkRepeatedLinks(supabase, input.userId, input.text);
  if (!linksResult.allowed) {
    return { allowed: false, error: linksResult.error, moderationStatus: "rejected", hasLinks: false, links: [] };
  }

  const blockedWords = await checkBlockedWords(supabase, input.text);
  const [newUser, shadowbanned] = await Promise.all([
    isNewUser(supabase, input.userId),
    isUserShadowbanned(supabase, input.userId),
  ]);

  const decision = decideModerationStatusPure({
    isNewUser: newUser,
    hasLink: !!linksResult.hasLinks,
    blockedWordSeverity: blockedWords.highestSeverity,
    isShadowbanned: shadowbanned,
  });

  if (blockedWords.highestSeverity) {
    await logAntiSpamEvent(supabase, {
      userId: input.userId,
      eventType: "blocked_word",
      targetType: input.targetType,
      severity: blockedWords.highestSeverity,
      reason: decision.reason ?? "blocked word matched",
      metadata: { words: blockedWords.matches.map((word) => word.word) },
    });
  }

  if (decision.reason === "new_user_link") {
    await logAntiSpamEvent(supabase, {
      userId: input.userId,
      eventType: "new_user_review",
      targetType: input.targetType,
      severity: "low",
      reason: "new user content with link",
    });
  }

  if (decision.blocked) {
    return {
      allowed: false,
      error: "El contenido incluye palabras bloqueadas.",
      moderationStatus: "rejected",
      hasLinks: !!linksResult.hasLinks,
      links: linksResult.links ?? [],
    };
  }

  return {
    allowed: true,
    moderationStatus: decision.status,
    hasLinks: !!linksResult.hasLinks,
    links: linksResult.links ?? [],
  };
}

export { buildEventKey };
