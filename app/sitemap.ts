import type { MetadataRoute } from "next";
import { getPublicSiteOrigin } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getPublicSiteOrigin();
  const now = new Date();

  return [
    "",
    "/partidos",
    "/terminos",
    "/privacidad",
    "/cookies",
    "/juego-seguro",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.5,
  }));
}
