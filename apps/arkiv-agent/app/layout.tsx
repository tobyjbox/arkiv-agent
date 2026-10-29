import { indexStatus, readFeed } from "@arkiv-agent/db";
import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { LiveProvider } from "../components/live/live-provider";
import { AboutInfo } from "../components/ui/about-info";
import { IndexNotBuilt } from "../components/shell/index-not-built";
import { TopBar } from "../components/shell/top-bar";
import { prisma } from "../lib/db";
import "./globals.css";

// Self-hosted from npm (no build-time fetch from Google): variable Inter and JetBrains Mono, Latin.
const inter = localFont({ src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", variable: "--font-inter", weight: "100 900", display: "swap" });
const mono = localFont({ src: "../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2", variable: "--font-jetbrains", weight: "100 800", display: "swap" });

export const metadata: Metadata = { title: "ArkivAgent", description: "Projects and datasets on Arkiv, live." };
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  // Without an index, say how to build one: reading it would create an empty file (T21 M2).
  const status = indexStatus();
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-sm focus:bg-overlay focus:px-3 focus:py-2">
          Skip to content
        </a>
        {status === "ready" ? <Live>{children}</Live> : <IndexNotBuilt status={status} />}
        <footer className="mx-auto max-w-[1280px] px-4 py-10 caption text-text-tertiary sm:px-6">
          ArkivAgent reads Arkiv&apos;s public testnet. Read-only. Not affiliated with Golem.{" "}
          <a href="https://data.arkiv.network/activity?chain=tiramisu" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">Data explorer</a>
          {" · "}
          <a href="https://tiramisu.explorer.arkiv.network/" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">Block explorer</a>{" "}
          <AboutInfo placement="above" />
          {" · "}
          <a href="https://github.com/tobyjbox/arkiv-agent" className="underline-offset-2 hover:underline">Source</a>
          <span className="mt-2 block">
            © 2026 Digital 7 Ltd ·{" "}
            <a href="https://github.com/tobyjbox/arkiv-agent/blob/main/LICENSE" className="underline-offset-2 hover:underline">MIT License</a>
          </span>
        </footer>
      </body>
    </html>
  );
}

/** The app shell, started from the index's change feed. */
async function Live({ children }: { children: ReactNode }) {
  const { changes: _, reset: __, ...initial } = await readFeed(prisma, null);
  return (
    <LiveProvider initial={initial}>
      <TopBar />
      <main id="main" className="hero-glow">{children}</main>
    </LiveProvider>
  );
}
