export function normalizeInternalSearchHref(href: string) {
  if (!href.startsWith("/") || href.startsWith("//")) {
    return "/feed";
  }

  if (!href.startsWith("/perfil?")) {
    return href;
  }

  const params = new URLSearchParams(href.slice(href.indexOf("?") + 1));
  const username = params.get("user")?.trim();

  return username ? `/u/${encodeURIComponent(username)}` : href;
}
