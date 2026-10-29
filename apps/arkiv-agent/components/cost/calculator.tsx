"use client";

import { estimate, type FeeModel } from "@arkiv-agent/cost/model";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import type { GlmPrice } from "@arkiv-agent/cost";
import { glm, usd } from "../../lib/glm";
import { CopyButton } from "../ui/copy-button";

const LIMITS = { writes: [1, 1_000_000], payload: [1, 100_000] } as const;
const UNIT_DAYS = { hours: 1 / 24, days: 1, months: 30 } as const;
type Unit = keyof typeof UNIT_DAYS;

/** Number field with a log-scale slider (design/06): sliders to explore, fields for exact values. */
function LogInput({ id, label, value, onChange, min, max, unit }: { id: string; label: string; value: number; onChange: (n: number) => void; min: number; max: number; unit: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const n = Number(text);
  const problem = Number.isInteger(n) && n >= min && n <= max ? null : `Enter a whole number from ${min.toLocaleString("en")} to ${max.toLocaleString("en")}.`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="label text-text-tertiary">{label}</label>
      <div className="flex items-center gap-3">
        <input id={id} value={text} inputMode="numeric" aria-invalid={problem !== null} aria-describedby={`${id}-err`}
          onChange={(e) => { setText(e.target.value); const v = Number(e.target.value); if (Number.isInteger(v) && v >= min && v <= max) onChange(v); }}
          className="h-9 w-32 rounded-sm border border-border-control bg-canvas px-2 mono-sm text-text-primary aria-[invalid=true]:border-danger" />
        <input type="range" aria-label={`${label} (slider)`} aria-valuetext={`${value.toLocaleString("en")} ${unit}`} min={0} max={1000}
          value={Math.round((Math.log(value / min) / Math.log(max / min)) * 1000)}
          onChange={(e) => onChange(Math.max(min, Math.round(min * (max / min) ** (Number(e.target.value) / 1000))))} className="min-w-0 flex-1 accent-[var(--color-accent)]" />
      </div>
      <p id={`${id}-err`} className={`caption ${problem ? "text-danger" : "text-text-tertiary"}`}>{problem ?? unit}</p>
    </div>
  );
}

export function Calculator({ model, fittedAt, initial, price }: { model: FeeModel; fittedAt: string; initial: { writes: number; payload: number; lifetime: number; unit: Unit }; price: GlmPrice | null }) {
  const [writes, setWrites] = useState(initial.writes);
  const [payload, setPayload] = useState(initial.payload);
  const [lifetime, setLifetime] = useState(initial.lifetime);
  const [unit, setUnit] = useState<Unit>(initial.unit);
  useEffect(() => {
    const t = setTimeout(() => window.history.replaceState(null, "", `/financials?writes=${writes}&payload=${payload}&lifetime=${lifetime}&unit=${unit}`), 60);
    return () => clearTimeout(t);
  }, [writes, payload, lifetime, unit]);
  const e = estimate(model, writes, payload, 30);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const $ = (x: number) => (price ? usd(x * price.usd) : null);
  const summary = `Arkiv cost estimate (Tiramisu testnet): ${writes.toLocaleString("en")} writes/day of ${payload.toLocaleString("en")} B, lifetime ${lifetime} ${unit}: ${glm(e.glm)} GLM per 30 days (range ${glm(e.low)} to ${glm(e.high)})${price ? `, about ${$(e.glm)} at $${price.usd.toPrecision(4)}/GLM (${price.source})` : ""}. Model fitted ${fittedAt.slice(0, 10)} from ${model.samples} receipts.`;
  return (
    <section aria-labelledby="calc" className="grid gap-6 rounded-md border border-border-subtle bg-surface p-5 lg:grid-cols-2">
      <div className="space-y-4">
        <h2 id="calc" className="text-[20px] font-semibold">What would my app cost?</h2>
        <LogInput id="writes" label="Writes per day" value={writes} onChange={setWrites} min={LIMITS.writes[0]} max={LIMITS.writes[1]} unit="writes per day" />
        <LogInput id="payload" label="Payload size" value={payload} onChange={setPayload} min={LIMITS.payload[0]} max={LIMITS.payload[1]} unit="bytes per record" />
        <div className="space-y-1.5">
          <label htmlFor="lifetime" className="label text-text-tertiary">Lifetime</label>
          <div className="flex gap-2">
            <input id="lifetime" type="number" min={1} value={lifetime} onChange={(ev) => setLifetime(Math.max(1, Number(ev.target.value) || 1))} className="h-9 w-24 rounded-sm border border-border-control bg-canvas px-2 mono-sm" />
            <select aria-label="Lifetime unit" value={unit} onChange={(ev) => setUnit(ev.target.value as Unit)} className="h-9 rounded-sm border border-border-control bg-canvas px-2">
              {Object.keys(UNIT_DAYS).map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <p className="caption text-text-tertiary">On today's Tiramisu, lifetime doesn't change the fee (see the finding below).</p>
        </div>
      </div>
      <div className="space-y-4" aria-live="polite">
        <div>
          <p className="caption text-text-tertiary">Estimated fees per 30 days</p>
          <p className="text-[36px] font-semibold leading-[44px]" style={{ fontVariantNumeric: "tabular-nums" }}>{glm(e.glm)} GLM</p>
          <p className="text-text-secondary">range {glm(e.low)} to {glm(e.high)} GLM · {glm(e.perWrite)} GLM per write</p>
          {price && <p className="text-text-secondary">≈ {$(e.glm)} (range {$(e.low)} to {$(e.high)}) · {$(e.perWrite)} per write</p>}
        </div>
        {e.outside && <p className="flex items-center gap-2 rounded-sm px-3 py-2 caption tint-warn"><AlertTriangle size={14} aria-hidden />Outside observed data (payloads seen: {model.observed.payloadBytes[0].toLocaleString("en")} to {model.observed.payloadBytes[1].toLocaleString("en")} B). The range is widened ×{e.widenedBy.toFixed(1)} each way as an extrapolation.</p>}
        <div>
          <p className="caption text-text-tertiary">What drives it</p>
          <div className="mt-1 flex h-3 overflow-hidden rounded-sm" aria-hidden>
            <span style={{ width: pct(e.breakdown.base), background: "var(--color-accent)" }} /><span style={{ width: pct(e.breakdown.encoding), background: "var(--color-info)" }} /><span style={{ width: pct(e.breakdown.payload), background: "var(--color-ai)" }} />
          </div>
          <p className="mt-1 caption text-text-secondary">Base transaction {pct(e.breakdown.base)} · encoding and attributes {pct(e.breakdown.encoding)} · payload {pct(e.breakdown.payload)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 caption">
          <span className="ml-auto flex items-center gap-1 text-text-secondary">Copy estimate <CopyButton value={summary} label="Copy estimate" /></span>
        </div>
        <p className="caption text-text-tertiary">{price ? `USD at the mainnet GLM price, $${price.usd.toPrecision(4)} from ${price.source}, refreshed every 10 minutes.` : "No GLM price yet; showing GLM only."} Model fitted {fittedAt.slice(0, 16).replace("T", " ")} UTC from {model.samples} sampled receipts.</p>
      </div>
    </section>
  );
}
