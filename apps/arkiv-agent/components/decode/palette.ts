import type { ArchetypeId, GraphLink } from "@arkiv-agent/decode";

/** One colour per purpose; "unclear" is the quiet grey so decoded projects stand out. */
export const ARCHETYPE_COLOR: Record<ArchetypeId, string> = {
  marketplace: "#f5b544", social: "#ff8fc7", identity: "#a99bff", registry: "#6cb6ff", logistics: "#ff9d5c", health: "#ff7a7a",
  finance: "#ffd76a", game: "#4ade80", civic: "#3ddcc5", agents: "#c58bff", telemetry: "#7fd4ff", files: "#b8c4d9", test: "#7a8499", unclear: "#566175",
};

export const LINK_KINDS: { kind: Exclude<GraphLink["kind"], "member">; label: string; color: string; hint: string }[] = [
  { kind: "ref", label: "Record links", color: "#3ddcc5", hint: "Records in one dataset point at records in another" },
  { kind: "shape", label: "Same record shape", color: "#a99bff", hint: "Two projects store records with the same attributes" },
  { kind: "builder", label: "Shared wallet", color: "#6cb6ff", hint: "The same wallet writes for both projects" },
];
export const BROKEN_COLOR = "#ff7a7a";
export const MEMBER_COLOR = "#3a4a6b";

export const flagColor = (flags: number) => (flags === 0 ? "#3a4459" : flags === 1 ? "#f5b544" : "#ff7a7a");

/** On-chain text goes into the graph's HTML tooltip: escape it. */
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
