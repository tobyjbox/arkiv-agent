"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** A multi-select (or single-select) filter with counts, in a popover. */
export function FilterPopover({ label, options, selected, onChange, isSingle = false }: {
  label: string; options: [string, number | string][]; selected: string[]; onChange: (next: string[]) => void; isSingle?: boolean;
}) {
  const [isOpen, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [isOpen]);

  const toggle = (value: string) =>
    onChange(isSingle ? (selected[0] === value ? [] : [value]) : selected.includes(value) ? selected.filter((s) => s !== value) : [...selected, value]);

  return (
    <div ref={box} className="relative">
      <button type="button" aria-expanded={isOpen} onClick={() => setOpen((o) => !o)}
        className={`flex h-8 items-center gap-1 rounded-sm border px-3 ${selected.length ? "border-accent text-text-primary" : "border-border-control text-text-secondary"} hover:text-text-primary`}>
        {label}{selected.length ? ` · ${selected.length}` : ""} <ChevronDown size={14} aria-hidden />
      </button>
      {isOpen && (
        <div role="group" aria-label={label} className="absolute left-0 z-20 mt-1 max-h-72 w-64 overflow-auto rounded-md border border-border-default bg-overlay p-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
          {options.length === 0 && <div className="px-2 py-1.5 text-text-tertiary">Nothing to filter</div>}
          {options.map(([value, count]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-raised">
              <input type={isSingle ? "radio" : "checkbox"} checked={selected.includes(value)} onChange={() => toggle(value)} className="accent-[var(--color-accent)]" />
              <span className="min-w-0 flex-1 truncate">{value}</span>
              <span className="caption text-text-tertiary">{count}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
