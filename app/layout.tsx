import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AlkaStudy — Tiago Pereira de Medeiros",
  description:
    "Estudos, revisão espaçada e planejamento em um só aplicativo offline.",
  authors: [
    { name: "Tiago Pereira de Medeiros", url: "mailto:alkateyadev@gmail.com" },
  ],
  creator: "Tiago Pereira de Medeiros",
  publisher: "Tiago Pereira de Medeiros",
  applicationName: "AlkaStudy",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/brand/alkastudy-symbol.png",
    shortcut: "/brand/alkastudy-symbol.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
