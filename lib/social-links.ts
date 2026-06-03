export const SOCIAL_PLATFORMS = [
  { id: "instagram", label: "Instagram", hosts: ["instagram.com"] },
  { id: "tiktok", label: "TikTok", hosts: ["tiktok.com"] },
  { id: "x", label: "X / Twitter", hosts: ["x.com", "twitter.com"] },
  { id: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  { id: "twitch", label: "Twitch", hosts: ["twitch.tv"] },
  { id: "telegram", label: "Telegram", hosts: ["t.me", "telegram.me"] },
  { id: "discord", label: "Discord", hosts: ["discord.gg", "discord.com"] },
  { id: "whatsapp", label: "WhatsApp Channel", hosts: ["whatsapp.com", "wa.me"] },
  { id: "website", label: "Website", hosts: null },
  { id: "linktree", label: "Linktree", hosts: ["linktr.ee"] },
  { id: "kick", label: "Kick", hosts: ["kick.com"] },
  { id: "threads", label: "Threads", hosts: ["threads.net"] },
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

export function normalizeSocialUrl(platform: SocialPlatform, rawUrl: string) {
  const value = rawUrl.trim();
  if (!value) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Usa una URL completa que empiece por https://.");
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

  parsed.hash = "";
  return parsed.toString();
}

export function isSocialPlatform(value: string): value is SocialPlatform {
  return SOCIAL_PLATFORMS.some((platform) => platform.id === value);
}

export function socialPlatformLabel(value: SocialPlatform) {
  return SOCIAL_PLATFORMS.find((platform) => platform.id === value)?.label ?? value;
}
