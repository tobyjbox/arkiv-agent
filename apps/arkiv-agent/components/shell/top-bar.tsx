"use client";

import { Diamond } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SyncIndicator } from "../live/sync-indicator";
import { CommandPalette } from "./command-palette";

/** Built pages only: unbuilt ones stay hidden, not disabled (design/03-catalogue.md, app shell). */
const NAV = [{ href: "/catalogue", label: "Catalogue" }, { href: "/ask", label: "Ask Arkiv" }, { href: "/pulse", label: "Pulse" }, { href: "/cost", label: "Cost" }];

export function TopBar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-canvas/90 backdrop-blur">
      {/* Below md the nav gets its own row, so its links never wrap and the sync state keeps its words. */}
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 px-4 sm:px-6 md:h-14 md:flex-nowrap">
        <Link href="/catalogue" className="flex h-12 items-center gap-2 font-semibold text-text-primary md:h-auto">
          <Diamond size={18} className="text-accent" aria-hidden /> ArkivAgent
        </Link>
        <nav aria-label="Main" className="order-last flex w-full items-center gap-5 overflow-x-auto md:order-none md:w-auto md:gap-4 md:overflow-visible">
          {NAV.map((item) => {
            const isCurrent = path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`relative shrink-0 whitespace-nowrap py-2.5 font-medium md:py-4 ${isCurrent ? "text-text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent" : "text-text-secondary hover:text-text-primary"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <CommandPalette />
          <SyncIndicator />
        </div>
      </div>
    </header>
  );
}
