"use client";

import { useEffect, useState } from "react";
import { formatCount } from "../../lib/format";

export type IntroStep = { label: string; count: number; unit: string };

/** Counts up to `to` over about 0.8 s once `isRunning`. */
function CountUp({ to, isRunning }: { to: number; isRunning: boolean }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 800);
      setValue(Math.round(to * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, isRunning]);
  return <>{formatCount(value)}</>;
}

/**
 * The start-up sequence over the map: each step is the map really gaining that part (hubs, datasets,
 * links, colours), so the list tracks what is on screen. `stage` is how many steps are done.
 */
export function IntroHud({ steps, stage }: { steps: readonly IntroStep[]; stage: number }) {
  const isDone = stage >= steps.length;
  return (
    <div aria-live="polite" className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-700 ${isDone ? "opacity-0" : "opacity-100"}`}>
      <div className="w-[min(380px,calc(100%-32px))] rounded-lg border border-border-default bg-canvas/75 p-5 shadow-[0_0_60px_rgba(61,220,197,0.12)] backdrop-blur-md">
        <div className="label flex items-center justify-between text-accent">
          <span>Decoding Arkiv</span>
          <span className="font-mono text-text-tertiary">{Math.min(stage, steps.length)}/{steps.length}</span>
        </div>
        <div className="mt-3 h-0.5 overflow-hidden rounded bg-border-subtle">
          <div className="h-full bg-accent shadow-[0_0_12px_var(--color-accent)] transition-[width] duration-700 ease-out" style={{ width: `${(Math.min(stage, steps.length) / steps.length) * 100}%` }} />
        </div>
        <ol className="mt-4 space-y-2">
          {steps.map((s, i) => {
            const status = i < stage ? "done" : i === stage ? "active" : "pending";
            return (
              <li key={s.label} className={`flex items-center gap-3 transition-opacity duration-500 ${status === "pending" ? "opacity-35" : "opacity-100"}`}>
                <span className="relative flex h-2 w-2 shrink-0">
                  {status === "active" && <span className="live-ring absolute inset-0 rounded-full bg-accent" />}
                  <span className={`relative h-2 w-2 rounded-full ${status === "done" ? "bg-accent" : status === "active" ? "bg-accent" : "bg-border-control"}`} />
                </span>
                <span className={status === "pending" ? "text-text-tertiary" : "text-text-primary"}>{s.label}</span>
                <span className="mono-sm ml-auto text-text-secondary">{status === "pending" ? "" : <><CountUp to={s.count} isRunning /> <span className="text-text-tertiary">{s.unit}</span></>}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
