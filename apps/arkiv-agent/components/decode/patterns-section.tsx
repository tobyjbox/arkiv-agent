"use client";

import type { Decode } from "@arkiv-agent/decode";
import { middle } from "../../lib/format";

const label = (id: string) => { const l = id.slice(id.indexOf(":") + 1); return id.startsWith("creator:") ? middle(l) : l; };

/** What projects chose in common: attribute names and their types, and whole record shapes. */
export function PatternsSection({ decode, onSelect }: { decode: Decode; onSelect: (id: string) => void }) {
  const conflicts = decode.conventions.filter((c) => c.types.length > 1).length;
  return (
    <section aria-labelledby="patterns" className="space-y-3">
      <div>
        <h2 id="patterns" className="text-[20px] font-semibold">Patterns between projects</h2>
        <p className="text-text-secondary">Nobody set a standard, yet projects converge on the same attribute names. {conflicts} of the top {decode.conventions.length} names are typed differently by different projects, which breaks any query written across them.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface">
          <table className="w-full text-left">
            <caption className="label px-4 pt-3 text-left text-text-tertiary">Attribute names used by the most projects</caption>
            <thead className="caption text-text-tertiary"><tr className="border-b border-border-subtle"><th scope="col" className="px-4 py-2 font-medium">Attribute</th><th scope="col" className="px-3 py-2 text-right font-medium">Projects</th><th scope="col" className="px-3 py-2 font-medium">Typed as</th></tr></thead>
            <tbody>
              {decode.conventions.slice(0, 16).map((c) => (
                <tr key={c.name} className="border-b border-border-subtle last:border-0">
                  <td className="mono-sm px-4 py-1.5">{c.name}</td>
                  <td className="px-3 py-1.5 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{c.projects}</td>
                  <td className="px-3 py-1.5 caption">
                    {c.types.map((t) => <span key={t.type} className="mr-2 font-mono text-text-secondary">{t.type}<span className="text-text-tertiary"> ×{t.projects}</span></span>)}
                    {c.types.length > 1 && <span className="rounded-sm px-1.5 py-0.5 tint-warn">type conflict</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-md border border-border-subtle bg-surface p-4">
          <h3 className="label text-text-tertiary">Record shapes found under more than one project</h3>
          {decode.sharedShapes.length === 0 ? <p className="mt-2 text-text-secondary">None in the current catalogue.</p> : (
            <ul className="mt-2 space-y-3">
              {decode.sharedShapes.slice(0, 8).map((s) => (
                <li key={s.fields.join()}>
                  <div>{s.projects.map((p) => <button key={p} type="button" onClick={() => onSelect(p)} className="mono-sm mr-2 text-ai hover:underline">{label(p)}</button>)}</div>
                  <div className="caption font-mono text-text-tertiary">{s.fields.slice(0, 8).join("  ")}{s.fields.length > 8 ? `  +${s.fields.length - 8}` : ""}</div>
                </li>
              ))}
            </ul>
          )}
          <p className="caption mt-3 text-text-tertiary">The same shape under two labels usually means a shared template, a fork, or one team with a test and a live label.</p>
        </div>
      </div>
    </section>
  );
}
