import type { MetadataRoute } from "next";
import { getPublicSiteOrigin } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getPublicSiteOrigin();
  const lastModified = new Date();

  return [
    {
      url: `${baseUrl}`,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/feed`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/partidos`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/ranking`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/terminos`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacidad`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/juego-seguro`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];
}