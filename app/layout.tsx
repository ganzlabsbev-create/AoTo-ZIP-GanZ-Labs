import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { LangProvider } from "@/lib/i18n-context";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "GanZ Ops",
  description: "GanZ Ops — ZIP → GitHub / Vercel, internal tool",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#050B14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-body min-h-screen bg-base-bg text-ink antialiased">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
