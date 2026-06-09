import type { MetadataRoute } from "next";
import { getPublicSiteOrigin } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicSiteOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/u",
          "/partidos",
          "/ranking",
          "/terminos",
          "/privacidad",
          "/cookies",
          "/juego-seguro",
        ],
        disallow: [
          "/feed",
          "/detalle",
          "/picks",
          "/perfil",
          "/cuenta",
          "/guardados",
          "/nuevo",
          "/admin",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}