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
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
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
        url: "/logo.png",
        width: 1024,
        height: 1024,
        alt: "TodosGanamos",
      },
    ],
  },

  twitter: {
    card: "summary",
    title: "TodosGanamos | Pronósticos deportivos gratis",
    description:
      "Comunidad de pronósticos deportivos gratis para mayores de edad, sin dinero real.",
    images: ["/logo.png"],
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