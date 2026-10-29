"use client";

import { Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogueData } from "../../lib/catalogue";

/** ⌘K: jump to a dataset by name, project or attribute. (Ask Arkiv joins it in T05.) */
export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [rows, setRows] = useState<CatalogueData["rows"]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    input.current?.focus();
    void fetch("/api/catalogue").then((r) => r.json()).then((d: CatalogueData) => setRows(d.rows.filter((x) => !x.isLoadGenerator)));
  }, [isOpen]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = (r: CatalogueData["rows"][number]) => !q || r.name.toLowerCase().includes(q) || r.project.label.toLowerCase().includes(q) || r.fields.some((f) => f.name.toLowerCase().includes(q));
    return rows.filter(hit).slice(0, 8);
  }, [rows, query]);

  const go = (id: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/catalogue/${id}`);
  };
  /** The last option: send the text to Ask Arkiv as a question. */
  const askIndex = query.trim() ? matches.length : -1;
  const ask = () => {
    setOpen(false);
    setQuery("");
    router.push(`/ask?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="hidden h-8 items-center gap-2 rounded-sm border border-border-default px-2.5 caption text-text-tertiary hover:text-text-primary md:flex">
        <Search size={14} aria-hidden /> Search <kbd className="font-sans">⌘K</kbd>
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-canvas/70 pt-[12vh]" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal aria-label="Search datasets" className="w-full max-w-xl overflow-hidden rounded-lg border border-border-default bg-overlay shadow-[0_8px_24px_rgba(0,0,0,0.45)]" onClick={(e) => e.stopPropagation()}>
            <input
              ref={input}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, Math.max(matches.length - 1, askIndex)));
                if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
                if (e.key === "Enter" && active === askIndex) ask();
                else if (e.key === "Enter" && matches[active]) go(matches[active].id);
              }}
              placeholder="Search datasets, attributes, projects…"
              role="combobox"
              aria-expanded
              aria-controls="palette-results"
              className="w-full border-b border-border-subtle bg-transparent px-4 py-3 text-[16px] outline-none placeholder:text-text-tertiary"
            />
            <ul id="palette-results" role="listbox" className="max-h-80 overflow-auto py-1">
              {matches.map((r, i) => (
                <li key={r.id} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(r.id)}
                  className={`flex cursor-pointer items-center justify-between px-4 py-2 ${i === active ? "bg-raised" : ""}`}>
                  <span className="font-mono text-[13px]">{r.name}</span>
                  <span className="caption text-text-tertiary">{r.project.label}</span>
                </li>
              ))}
              {!matches.length && <li className="px-4 py-3 text-text-tertiary">No datasets match.</li>}
              {askIndex >= 0 && (
                <li role="option" aria-selected={active === askIndex} onMouseEnter={() => setActive(askIndex)} onClick={ask}
                  className={`flex cursor-pointer items-center gap-2 border-t border-border-subtle px-4 py-2 ${active === askIndex ? "bg-raised" : ""}`}>
                  <Sparkles size={14} className="shrink-0 text-ai" aria-hidden />
                  <span className="truncate">Ask Arkiv: “{query.trim()}”</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
