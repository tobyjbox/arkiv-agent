"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

/** (i) next to the explorer links: what ArkivAgent adds over the data and block explorers. Opens on hover, focus or tap. */
export function AboutInfo({ placement = "below" }: { placement?: "above" | "below" }) {
  const [isOpen, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [isOpen]);

  return (
    <span ref={box} className="relative inline-flex align-middle" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label="What ArkivAgent adds to the explorers" aria-expanded={isOpen} aria-controls={id}
        onClick={() => setOpen(true)} onFocus={() => setOpen(true)} onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-text-tertiary hover:text-text-primary focus-visible:text-text-primary">
        <Info size={14} aria-hidden />
      </button>
      {isOpen && (
        <span id={id} role="dialog" aria-label="What ArkivAgent adds"
          className={`absolute left-1/2 z-30 w-[min(340px,calc(100vw-32px))] -translate-x-1/2 rounded-md border border-border-default bg-overlay p-4 text-left text-[13px] leading-5 text-text-secondary shadow-[0_8px_24px_rgba(0,0,0,0.45)] ${placement === "above" ? "bottom-full mb-2" : "top-full mt-2"}`}>
          <span className="block font-medium text-text-primary">What ArkivAgent adds</span>
          <span className="mt-1 block">The data explorer shows raw entities and activity; the block explorer shows transactions and blocks. ArkivAgent reads the same chain and makes sense of it:</span>
          <span className="mt-2 block space-y-1">
            <span className="block"><b className="font-medium text-text-primary">Catalogue</b>: groups records into datasets by project and schema, with field types, examples and a ready SDK query.</span>
            <span className="block"><b className="font-medium text-text-primary">Ask Arkiv</b>: plain-English questions turned into a real Arkiv query you can see and copy.</span>
            <span className="block"><b className="font-medium text-text-primary">Insights</b>: which projects are active and which keep writing (retention).</span>
            <span className="block"><b className="font-medium text-text-primary">Financials</b>: what writing to Arkiv costs, from observed fees, in GLM and USD, with ranges.</span>
          </span>
        </span>
      )}
    </span>
  );
}
