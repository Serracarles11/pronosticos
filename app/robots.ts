import type { MetadataRoute } from "next";
import { getPublicSiteOrigin } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicSiteOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/u", "/partidos", "/terminos", "/privacidad", "/cookies", "/juego-seguro"],
        disallow: ["/feed", "/detalle", "/picks", "/ranking", "/perfil", "/cuenta", "/guardados", "/nuevo", "/admin"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
