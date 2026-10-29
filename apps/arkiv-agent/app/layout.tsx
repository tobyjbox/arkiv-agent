import { readFeed } from "@arkiv-agent/db";
import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { LiveProvider } from "../components/live/live-provider";
import { TopBar } from "../components/shell/top-bar";
import { prisma } from "../lib/db";
import "./globals.css";

// Self-hosted from npm (no build-time fetch from Google): variable Inter and JetBrains Mono, Latin.
const inter = localFont({ src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", variable: "--font-inter", weight: "100 900", display: "swap" });
const mono = localFont({ src: "../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2", variable: "--font-jetbrains", weight: "100 800", display: "swap" });

export const metadata: Metadata = { title: "ArkivAgent", description: "Projects and datasets on Arkiv, live." };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { changes: _, reset: __, ...initial } = await readFeed(prisma, null);
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-sm focus:bg-overlay focus:px-3 focus:py-2">
          Skip to content
        </a>
        <LiveProvider initial={initial}>
          <TopBar />
          <main id="main" className="hero-glow">{children}</main>
        </LiveProvider>
        <footer className="mx-auto max-w-[1280px] px-4 py-10 caption text-text-tertiary sm:px-6">
          ArkivAgent reads Arkiv&apos;s public testnet. Read-only. Not affiliated with Golem.{" "}
          <a href="https://data.arkiv.network/activity?chain=tiramisu" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">Data explorer</a>
          {" · "}
          <a href="https://tiramisu.explorer.arkiv.network/" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">Block explorer</a>
          {" · "}
          <a href="https://github.com/tobyjbox/arkiv-agent" className="underline-offset-2 hover:underline">Source</a>
        </footer>
      </body>
    </html>
  );
}
