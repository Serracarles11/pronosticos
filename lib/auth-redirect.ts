export const DEFAULT_AUTH_REDIRECT = "/feed";

export function normalizeAuthRedirect(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT;
  }

  const url = new URL(value, "http://localhost");
  if (url.pathname === "/auth" || url.pathname.startsWith("/auth/")) {
    return DEFAULT_AUTH_REDIRECT;
  }

  return `${url.pathname}${url.search}`;
}
