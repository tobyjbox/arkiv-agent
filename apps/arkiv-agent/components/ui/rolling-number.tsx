"use client";

import { useEffect, useRef, useState } from "react";
import { formatCount } from "../../lib/format";

/**
 * Pattern 3: changed digits roll to the new value over 600 ms; a delta chip shows for 3 s.
 * Jumps over 10x (or the first value) crossfade instead. Reduced motion: the CSS turns rolls off.
 */
export function RollingNumber({ value, format = formatCount, showDelta = false, className = "" }: {
  value: number; format?: (n: number) => string; showDelta?: boolean; className?: string;
}) {
  const prev = useRef(value);
  const [delta, setDelta] = useState<number | null>(null);
  const [isJump, setJump] = useState(false);

  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (before === value) return;
    setJump(before === 0 || value / Math.max(1, before) > 10 || before / Math.max(1, value) > 10);
    setDelta(value - before);
    const t = setTimeout(() => setDelta(null), 3_000);
    return () => clearTimeout(t);
  }, [value]);

  const text = format(value);
  return (
    <span className={`inline-flex items-center gap-1.5 align-bottom tabular-nums ${className}`}>
      <span className="roll relative inline-flex h-[1lh] items-start overflow-hidden" aria-label={text}>
        {isJump ? (
          <span key={text} className="fade-in" aria-hidden>{text}</span>
        ) : (
          [...text].map((ch, i) => (/\d/.test(ch) ? <Digit key={text.length - i} digit={Number(ch)} /> : <span key={`s${text.length - i}`} aria-hidden>{ch}</span>))
        )}
      </span>
      {showDelta && delta !== null && delta !== 0 && (
        <span className={`caption rounded-sm px-1 ${delta > 0 ? "tint-live" : "text-text-secondary"}`}>
          {delta > 0 ? `+${formatCount(delta)}` : `−${formatCount(-delta)}`}
        </span>
      )}
    </span>
  );
}

function Digit({ digit }: { digit: number }) {
  return (
    <span className="relative inline-block h-[1lh] w-[1ch] overflow-hidden align-top" aria-hidden>
      <span
        className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-[600ms] ease-[var(--ease-emphasis)]"
        style={{ transform: `translateY(${-digit * 10}%)` }}
      >
        {Array.from({ length: 10 }, (_, d) => <span key={d} className="h-[1lh] leading-[inherit]">{d}</span>)}
      </span>
    </span>
  );
}
