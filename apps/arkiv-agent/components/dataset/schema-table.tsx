import type { SchemaField } from "@arkiv-agent/catalogue";
import { percent } from "../../lib/format";
import { CopyButton } from "../ui/copy-button";

/** Type chips stay prominent: Arkiv filters are type-strict, so the type is what a query needs. */
export function SchemaTable({ fields }: { fields: SchemaField[] }) {
  return (
    <div className="overflow-hidden rounded-md bg-surface">
      <table className="w-full border-collapse max-md:block">
        <thead className="max-md:hidden">
          <tr className="label border-b border-border-subtle text-left text-text-secondary">
            <th className="px-3 py-2.5">Attribute</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Examples</th><th className="px-3 py-2.5 text-right">Present</th>
          </tr>
        </thead>
        <tbody className="max-md:block">
          {fields.map((f) => (
            <tr key={`${f.name}:${f.type}`} className="group border-b border-border-subtle last:border-0 max-md:block max-md:px-3 max-md:py-2">
              <td className="px-3 py-2 max-md:inline max-md:p-0">
                <span className="font-mono text-[13px]">{f.name}</span>
                {!f.name.includes("*") && <CopyButton value={f.name} label={`Copy ${f.name}`} className="ml-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100" />}
              </td>
              <td className="px-3 py-2 max-md:ml-2 max-md:inline max-md:p-0">
                <span className="rounded-sm border border-border-default bg-raised px-1.5 font-mono text-[12px] text-text-secondary">{f.type}</span>
              </td>
              <td className="max-w-md truncate px-3 py-2 font-mono text-[13px] text-text-secondary max-md:block max-md:p-0">
                {f.examples.map((e) => (f.type === "str" ? JSON.stringify(e) : e)).join(", ")}
              </td>
              <td className="px-3 py-2 text-right tabular-nums max-md:hidden">{percent(f.presence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
