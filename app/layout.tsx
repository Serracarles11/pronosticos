import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import { AgeGate } from "./components/age-gate";
import { getPublicSiteOrigin } from "@/lib/site-url";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteOrigin()),

  title: {
    default: "TodosGanamos | Pronósticos deportivos gratis",
    template: "%s | TodosGanamos",
  },

  description:
    "TodosGanamos es una comunidad de pronósticos deportivos gratis para mayores de edad, sin dinero real. Consulta picks, cuotas informativas y rankings de tipsters.",

  applicationName: "TodosGanamos",

  icons: {
    icon: [{ url: "/logo.webp", type: "image/webp" }],
    shortcut: "/logo.webp",
  },

  keywords: [
    "pronósticos deportivos",
    "pronósticos gratis",
    "pronósticos fútbol",
    "pronósticos fútbol hoy",
    "apuestas deportivas gratis",
    "picks deportivos",
    "tipsters",
    "ranking tipsters",
    "comunidad deportiva",
    "sin dinero real",
    "TodosGanamos",
  ],

  openGraph: {
    title: "TodosGanamos | Pronósticos deportivos gratis",
    description:
      "Comunidad de pronósticos deportivos gratis para mayores de edad, sin dinero real. Consulta picks, cuotas informativas y rankings de tipsters.",
    url: "/",
    siteName: "TodosGanamos",
    locale: "es_ES",
    type: "website",
    images: [
      {
        url: "/logo.webp",
        width: 1254,
        height: 1254,
        alt: "TodosGanamos",
      },
    ],
  },

  twitter: {
    card: "summary",
    title: "TodosGanamos | Pronósticos deportivos gratis",
    description:
      "Comunidad de pronósticos deportivos gratis para mayores de edad, sin dinero real.",
    images: ["/logo.webp"],
  },

  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${manrope.variable} ${jetbrainsMono.variable}`}>
      <body>
        <AgeGate />
        {children}
      </body>
    </html>
  );
}