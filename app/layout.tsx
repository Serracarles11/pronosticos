import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import { AgeGate } from "./components/age-gate";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "TodosGanamos - Pronosticos deportivos sin dinero real",
    template: "%s - TodosGanamos",
  },
  description: "Comunidad de pronosticos deportivos para mayores de edad, sin dinero real.",
  applicationName: "TodosGanamos",
  keywords: [
    "pronosticos deportivos",
    "tipsters",
    "comunidad deportiva",
    "ranking tipsters",
    "sin dinero real",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "TodosGanamos",
    description: "Comunidad de pronosticos deportivos para mayores de edad, sin dinero real.",
    url: "/",
    siteName: "TodosGanamos",
    locale: "es_ES",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
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
