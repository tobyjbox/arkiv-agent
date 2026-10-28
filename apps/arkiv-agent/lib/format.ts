/** Formatting shared by server and client components. Block time on Tiramisu is 2 s. */
export const BLOCK_SECONDS = 2;

export const formatCount = (n: number) => n.toLocaleString("en");

export function compact(n: number): string {
  if (n < 10_000) return formatCount(n);
  return n < 1_000_000 ? `${(n / 1_000).toFixed(n < 100_000 ? 1 : 0)}k` : `${(n / 1_000_000).toFixed(1)}M`;
}

/** "4 s ago", "12 min ago", "3 h ago", "2 d ago". */
export function ago(seconds: number): string {
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)} h ago`;
  return `${Math.floor(seconds / 86_400)} d ago`;
}

/** A block span as a human duration: "~7 d", "~30 min". */
export function duration(blocks: number | null): string {
  if (blocks === null) return "never expires";
  const s = blocks * BLOCK_SECONDS;
  if (s < 3_600) return `~${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86_400) return `~${Math.round(s / 3_600)} h`;
  return `~${Math.round(s / 86_400)} d`;
}

/** `0x3f9a…c21e`: the end is what people compare, so keep it. */
export const middle = (value: string, keep = 6) => (value.length <= keep * 2 + 1 ? value : `${value.slice(0, keep)}…${value.slice(-4)}`);

export const percent = (x: number) => `${Math.round(x * 100)}%`;
