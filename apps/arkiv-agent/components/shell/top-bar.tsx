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
    <header className="sticky top-0 z-30 h-14 border-b border-border-subtle bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1280px] items-center gap-6 px-4 sm:px-6">
        <Link href="/catalogue" className="flex items-center gap-2 font-semibold text-text-primary">
          <Diamond size={18} className="text-accent" aria-hidden /> ArkivAgent
        </Link>
        <nav aria-label="Main" className="flex items-center gap-4">
          {NAV.map((item) => {
            const isCurrent = path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`relative py-4 font-medium ${isCurrent ? "text-text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent" : "text-text-secondary hover:text-text-primary"}`}
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
