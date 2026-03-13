import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";
import { AppToaster } from "@/components/ui/sonner";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans"
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "EasyLaudo",
  description: "Operacao de laudos clinicos com modelos DOCX, planilhas e extracao reversa",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${plusJakarta.variable} ${plexMono.variable} font-[var(--font-sans)] text-zinc-950 antialiased`}>
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
