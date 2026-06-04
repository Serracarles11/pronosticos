export const PRODUCTION_SITE_ORIGIN = "https://todosganamos.es";

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function normalizeSiteOrigin(value?: string | null, { allowLocalhost = false } = {}) {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (!allowLocalhost && isLocalHostname(url.hostname)) return null;
    return url.origin.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function getHeaderHost(headersList: Headers) {
  const forwardedHost = headersList.get("x-forwarded-host")?.split(",")[0]?.trim();
  return forwardedHost || headersList.get("host")?.split(",")[0]?.trim() || "";
}

function getHeaderOrigin(headersList: Headers, allowLocalhost: boolean) {
  const host = getHeaderHost(headersList);
  if (!host) return null;
  const proto = headersList.get("x-forwarded-proto")?.split(",")[0]?.trim() || (host.includes("localhost") ? "http" : "https");
  return normalizeSiteOrigin(`${proto}://${host}`, { allowLocalhost });
}

function getVercelOrigin() {
  const vercelUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_BRANCH_URL ??
    process.env.VERCEL_URL;

  return normalizeSiteOrigin(vercelUrl);
}

export function getPublicSiteOrigin() {
  const allowLocalhost = process.env.NODE_ENV !== "production";
  return normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL, { allowLocalhost }) ?? PRODUCTION_SITE_ORIGIN;
}

export function getRequestSiteOrigin(headersList: Headers) {
  const host = getHeaderHost(headersList);
  const requestIsLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const configuredOrigin = normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL, {
    allowLocalhost: requestIsLocal,
  });

  return (
    configuredOrigin ??
    getHeaderOrigin(headersList, true) ??
    getVercelOrigin() ??
    PRODUCTION_SITE_ORIGIN
  );
}
