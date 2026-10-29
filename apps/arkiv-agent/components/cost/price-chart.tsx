"use client";

import { useEffect, useState } from "react";
import type { GlmPrice } from "../../lib/glm-price";
import type { History, RangeDays } from "../../lib/glm-history";

const RANGE_OPTIONS: RangeDays[] = [7, 30, 90];
const W = 600;
const H = 140;

/** USD with 4 significant digits: GLM trades around $0.1. */
const price = (x: number) => `$${x.toPrecision(4)}`;
const day = (t: number, withTime: boolean) =>
  new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", timeZone: "UTC", ...(withTime && { hour: "2-digit", minute: "2-digit" }) }) + (withTime ? " UTC" : "");

/** Two to four clean ticks (1, 2 or 5 × 10^n apart) inside [lo, hi]. */
export function ticks(lo: number, hi: number): number[] {
  const raw = (hi - lo) / 4 || hi / 10 || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step / 1e6; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

/**
 * GLM in USD over 7, 30 or 90 days (T27). Loads after the page, from /api/glm-history; until then a
 * skeleton holds its final size. Hover or arrow keys move a crosshair with the date and price.
 */
export function PriceChart({ spot }: { spot: GlmPrice | null }) {
  const [days, setDays] = useState<RangeDays>(30);
  const [loaded, setLoaded] = useState<Partial<Record<RangeDays, History | "failed">>>({});
  const [focus, setFocus] = useState<number | null>(null);
  const data = loaded[days];

  useEffect(() => {
    if (loaded[days]) return;
    let isStale = false;
    void fetch(`/api/glm-history?days=${days}`, { cache: "no-store" })
      .then((r): Promise<History | "failed"> | "failed" => (r.ok ? r.json() : "failed"))
      .catch((): "failed" => "failed")
      .then((h) => { if (!isStale) setLoaded((l) => ({ ...l, [days]: h })); });
    return () => { isStale = true; };
  }, [days, loaded]);

  if (data === "failed") return <p className="caption text-text-tertiary">No GLM price history is available right now, so the price chart is hidden.</p>;

  const candles = data?.candles ?? [];
  const closes = candles.map((c) => c.close);
  const first = closes[0], last = closes.at(-1);
  const now = spot?.usd ?? last;
  const change = first && now ? (now - first) / first : null;
  const lo = Math.min(...closes), hi = Math.max(...closes);
  const pad = (hi - lo) * 0.1 || hi * 0.05;
  const [y0, y1] = [lo - pad, hi + pad];
  const x = (i: number) => (candles.length > 1 ? (i / (candles.length - 1)) * W : W / 2);
  const y = (v: number) => H - ((v - y0) / (y1 - y0)) * H;
  const line = candles.map((c, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(c.close).toFixed(1)}`).join(" ");
  const withTime = data?.interval === "4h";
  const lowAt = closes.indexOf(lo), highAt = closes.indexOf(hi);
  const summary = data && first && last
    ? `GLM in USD, last ${days} days: ${price(first)} to ${price(last)} (${change! >= 0 ? "up" : "down"} ${Math.abs(change! * 100).toFixed(1)}%), low ${price(lo)} on ${day(candles[lowAt]!.t, withTime)}, high ${price(hi)} on ${day(candles[highAt]!.t, withTime)}.`
    : "";
  const shown = focus === null ? null : candles[Math.min(focus, candles.length - 1)];

  const pick = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setFocus(Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (candles.length - 1)));
  };

  return (
    <section aria-labelledby="glm-usd" className="max-w-[720px] rounded-md border border-border-subtle bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="glm-usd" className="label text-text-secondary">GLM / USD</h2>
        {data && now !== undefined && (
          <span className="tabular-nums">
            <span className="font-semibold text-text-primary">{price(now)}</span>
            {change !== null && <span className="caption ml-2 text-text-secondary">{change >= 0 ? "▲" : "▼"} {Math.abs(change * 100).toFixed(1)}% over {days} d</span>}
          </span>
        )}
        <div role="group" aria-label="Price range" className="ml-auto flex rounded-md border border-border-default p-0.5">
          {RANGE_OPTIONS.map((d) => (
            <button key={d} type="button" aria-pressed={d === days} onClick={() => { setDays(d); setFocus(null); }}
              className={`rounded-sm px-3 py-1 caption ${d === days ? "bg-raised text-text-primary" : "text-text-secondary hover:text-text-primary"}`}>{d}d</button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="shimmer relative mt-3 ml-12 h-[140px] overflow-hidden rounded-sm bg-raised" aria-label="Loading the GLM price history" role="img" />
      ) : (
        <div className="mt-3 flex h-[140px]">
          {/* Y ticks in a gutter, so the line never runs through them. */}
          <div className="relative w-12 shrink-0" aria-hidden>
            {ticks(y0, y1).map((v) => (
              <span key={v} className="absolute left-0 -translate-y-1/2 text-[11px] leading-none text-text-tertiary tabular-nums" style={{ top: `${(y(v) / H) * 100}%` }}>{price(v)}</span>
            ))}
          </div>
          <div className="relative min-w-0 flex-1 touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-focus" tabIndex={0}
            role="img" aria-label={`${summary} Arrow keys move through the prices; the table below lists them.`}
            onPointerMove={(e) => pick(e.clientX, e.currentTarget)} onPointerDown={(e) => pick(e.clientX, e.currentTarget)} onPointerLeave={() => setFocus(null)}
            onFocus={() => setFocus(candles.length - 1)} onBlur={() => setFocus(null)}
            onKeyDown={(e) => {
              const step = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }[e.key];
              if (step === undefined) return;
              e.preventDefault();
              setFocus((f) => Math.min(candles.length - 1, Math.max(0, (f ?? candles.length - 1) + step)));
            }}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
              {ticks(y0, y1).map((v) => <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="var(--color-border-subtle)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
              <path d={`${line} L${x(candles.length - 1)},${H} L0,${H} Z`} fill="var(--color-accent)" fillOpacity={0.1} />
              <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            {shown && (() => {
              const i = candles.indexOf(shown);
              const left = (x(i) / W) * 100, top = (y(shown.close) / H) * 100;
              return (
                <>
                  <span className="pointer-events-none absolute inset-y-0 w-px bg-border-default" style={{ left: `${left}%` }} />
                  <span className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface" style={{ left: `${left}%`, top: `${top}%` }} />
                  <span className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-sm border border-border-default bg-overlay px-2 py-1 shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                    style={left > 60 ? { right: `${100 - left}%` } : { left: `${left}%` }}>
                    <span className="font-semibold text-text-primary tabular-nums">{price(shown.close)}</span>{" "}
                    <span className="caption text-text-tertiary">{day(shown.t, withTime)}</span>
                  </span>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap justify-between gap-x-3 caption text-text-tertiary">
        {data ? (
          <>
            <span className="pl-12">{day(candles[0]!.t, false)} – {day(candles.at(-1)!.t, false)}</span>
            <span>{data.source}, {data.interval === "4h" ? "4-hour" : "daily"} closes · {spot ? `now ${spot.source}, ${spot.at.slice(11, 16)} UTC` : `updated ${data.at.slice(11, 16)} UTC`}</span>
          </>
        ) : <span>Loading GLM/USDT history…</span>}
      </div>

      {data && (
        <table className="sr-only">
          <caption>GLM in USD, last {days} days</caption>
          <thead><tr><th scope="col">{withTime ? "Time" : "Day"}</th><th scope="col">Close (USD)</th></tr></thead>
          <tbody>{candles.map((c) => <tr key={c.t}><td>{day(c.t, withTime)}</td><td>{price(c.close)}</td></tr>)}</tbody>
        </table>
      )}
    </section>
  );
}
