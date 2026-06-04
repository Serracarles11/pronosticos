export const SOCIAL_PLATFORMS = [
  { id: "tiktok", label: "TikTok", hosts: ["tiktok.com"] },
  { id: "instagram", label: "Instagram", hosts: ["instagram.com"] },
  { id: "x", label: "X / Twitter", hosts: ["x.com", "twitter.com"] },
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]["id"];

export type SocialLink = {
  id?: string;
  platform: SocialPlatform;
  url: string;
  is_public: boolean;
  sort_order: number;
};

function matchesHost(hostname: string, allowedHost: string) {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
}

function cleanUsername(value: string) {
  return value.trim().replace(/^@+/, "").replace(/\/+$/, "");
}

function validateSocialUsername(platform: SocialPlatform, username: string) {
  const rules: Record<SocialPlatform, { pattern: RegExp; label: string }> = {
    tiktok: { pattern: /^[A-Za-z0-9._]{1,24}$/, label: "TikTok" },
    instagram: { pattern: /^[A-Za-z0-9._]{1,30}$/, label: "Instagram" },
    x: { pattern: /^[A-Za-z0-9_]{1,15}$/, label: "X" },
  };
  const rule = rules[platform];
  if (!rule.pattern.test(username) || username.includes("..")) {
    throw new Error(`Escribe un nombre de usuario valido para ${rule.label}.`);
  }
  return username;
}

function canonicalSocialUrl(platform: SocialPlatform, username: string) {
  const safeUsername = validateSocialUsername(platform, cleanUsername(username));
  if (platform === "instagram") return `https://www.instagram.com/${safeUsername}/`;
  if (platform === "x") return `https://x.com/${safeUsername}`;
  return `https://www.tiktok.com/${safeUsername}`;
}

function extractUsernameFromUrl(platform: SocialPlatform, parsed: URL) {
  const pathPart = decodeURIComponent(parsed.pathname).split("/").filter(Boolean)[0] ?? "";
  return cleanUsername(pathPart);
}

export function normalizeSocialUrl(platform: SocialPlatform, rawUrl: string) {
  const value = rawUrl.trim();
  if (!value) return null;

  if (!/^https?:\/\//i.test(value)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      throw new Error("Solo se permiten enlaces HTTPS seguros.");
    }
    return canonicalSocialUrl(platform, value);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Escribe un nombre de usuario o una URL HTTPS valida.");
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("Solo se permiten enlaces HTTPS seguros.");
  }

  const config = SOCIAL_PLATFORMS.find((item) => item.id === platform);
  if (!config) throw new Error("Red social no compatible.");

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || (config.hosts && !config.hosts.some((host) => matchesHost(hostname, host)))) {
    throw new Error(`El enlace no pertenece a ${config.label}.`);
  }

  return canonicalSocialUrl(platform, extractUsernameFromUrl(platform, parsed));
}

export function isSocialPlatform(value: string): value is SocialPlatform {
  return SOCIAL_PLATFORMS.some((platform) => platform.id === value);
}

export function socialPlatformLabel(value: SocialPlatform) {
  return SOCIAL_PLATFORMS.find((platform) => platform.id === value)?.label ?? value;
}

export function parseProfileSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Record<string, unknown>;
      const platform = String(candidate.platform ?? "");
      const url = String(candidate.url ?? "");
      if (!isSocialPlatform(platform) || !url) return null;

      try {
        const normalizedUrl = normalizeSocialUrl(platform, url);
        if (!normalizedUrl) return null;
        return {
          platform,
          url: normalizedUrl,
          is_public: candidate.is_public !== false,
          sort_order: Number.isFinite(Number(candidate.sort_order))
            ? Number(candidate.sort_order)
            : index,
        } satisfies SocialLink;
      } catch {
        return null;
      }
    })
    .filter((link): link is SocialLink => !!link);
}
