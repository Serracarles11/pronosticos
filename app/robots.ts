import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/u", "/terminos", "/privacidad", "/cookies", "/juego-seguro"],
        disallow: ["/feed", "/detalle", "/picks", "/ranking", "/perfil", "/cuenta", "/guardados", "/nuevo", "/admin"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
