// Step 1 of interpret(): the question as tokens, and the words the parsers know (stop words,
// negations, comparators, time units, number words).
import type { AttrType } from "../query.ts";

export type Token = { raw: string; low: string; stem: string; quoted: boolean };

export const STOP = new Set(
  ("a an the of in on at for from with where which that who whose by to and or is are was were be been all any " +
    "show me find list get give what whats what's which how many much please only some there their its this these those " +
    "i my our your can do does records record entities entity entries entry data items rows results stuff " +
    "live public other none new true false yes no than more less over under above below has have had")
    .split(" "),
);
export const NEGATION = new Set(["not", "except", "excluding", "without", "isn't", "aren't", "non", "never", "exclude", "no", "don't", "doesn't", "didn't", "aren’t", "isn’t"]);
/** Words that ask for data without describing it: not reported as unused. */
export const FILLER = new Set(["show", "find", "list", "get", "give", "fetch", "search", "how", "many", "count", "number", "total", "please", "every", "each", "kind", "type", "sort", "like", "also", "just", "whose", "them", "they", "it", "made", "using", "having"]);
/** Field-name words that say where something is: "in Pune" fills one of these. */
export const PLACE_WORDS = /^(city|town|district|state|region|country|location|place|area|village|county|province|ward|lga|zone|locality|tehsil|taluk|centre|center)$/;
export const LABEL_NOISE = new Set(["v1", "v2", "v3", "test", "app", "open", "dev", "demo", "prod", "arkiv", "data"]);
export const ORDERED: ReadonlySet<AttrType> = new Set(["i32", "u64", "u256", "dec"]);
export const CONJUNCTION = /^(and|or|but|,|;)$/;
/** Words that describe Arkiv itself, not one project or kind of record. */
export const GENERIC = /^(arkiv|golem|chain|blockchain|network|testnet|mainnet|everything|anything|thing|things)$/;

export type Op = "gt" | "gte" | "lt" | "lte";
/** Comparator phrases, longest first so "more than" wins over "more". */
export const COMPARATORS: [string[], Op][] = (
  [
    ["greater than", "gt"], ["more than", "gt"], ["higher than", "gt"], ["longer than", "gt"], ["bigger than", "gt"],
    ["larger than", "gt"], ["older than", "gt"], ["at least", "gte"], ["no less than", "gte"], ["less than", "lt"],
    ["fewer than", "lt"], ["lower than", "lt"], ["shorter than", "lt"], ["smaller than", "lt"], ["at most", "lte"],
    ["no more than", "lte"], ["not more than", "lte"], ["not less than", "gte"], ["up to", "lte"], ["over", "gt"],
    ["above", "gt"], ["exceeding", "gt"], ["exceeds", "gt"], ["after", "gt"], ["since", "gte"], ["before", "lt"],
    ["until", "lte"], [">", "gt"], [">=", "gte"], ["≥", "gte"], ["under", "lt"], ["below", "lt"], ["<", "lt"],
    ["<=", "lte"], ["≤", "lte"],
  ] as [string, Op][]
)
  .map(([p, op]) => [p.split(" "), op] as [string[], Op])
  .sort((a, b) => b[0].length - a[0].length);
export const EQUALS = new Set(["is", "=", "==", "equals", "equal", ":"]);

/** Seconds per unit word. */
export const TIME_UNITS: Record<string, number> = {
  s: 1, sec: 1, secs: 1, second: 1, seconds: 1, min: 60, mins: 60, minute: 60, minutes: 60, h: 3600, hr: 3600,
  hrs: 3600, hour: 3600, hours: 3600, day: 86_400, days: 86_400, week: 604_800, weeks: 604_800, month: 2_592_000, months: 2_592_000,
};

export function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !/(ss|us)$/.test(w)) return w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ed") && !w.endsWith("eed")) return w.slice(0, -2); // "exceed" stays whole
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  return w;
}

/** The words of a name: `lenderType`, `lender_type` and `lender-type` are all "lender type". */
export const words = (name: string) =>
  name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[\s_\-./:*]+/).filter(Boolean);

/** Words and quoted phrases, with surrounding punctuation dropped. Quoted text is one token and isn't stemmed. */
export function tokenize(question: string): Token[] {
  const out: Token[] = [];
  for (const m of question.matchAll(/"([^"]+)"|“([^”]+)”|'([^'\s][^']*)'(?=\s|$|[?.,!])|(\S+)/g)) {
    const quoted = m[4] === undefined;
    const raw = quoted ? (m[1] ?? m[2] ?? m[3])! : m[4]!.replace(/^[(\[{"'“]+|[)\]}"'”?!,;…]+$|\.$/g, "");
    if (!raw) continue;
    const low = raw.toLowerCase();
    out.push({ raw, low, stem: quoted ? low : stem(low), quoted });
  }
  return out;
}

export const NUMBER_WORDS: Record<string, number> = Object.fromEntries(
  ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty")
    .split(" ").map((w, i) => [w, i] as [string, number])
    .concat([["thirty", 30], ["forty", 40], ["fifty", 50], ["hundred", 100], ["thousand", 1_000], ["million", 1_000_000]]),
);
export const isNumber = (t: string) => /^-?\d[\d,]*(\.\d+)?(k|m)?$/i.test(t) || t in NUMBER_WORDS;
export function parseNumber(t: string): number {
  if (t in NUMBER_WORDS) return NUMBER_WORDS[t]!;
  const m = /^(-?\d[\d,]*(?:\.\d+)?)(k|m)?$/i.exec(t)!;
  const n = Number(m[1]!.replace(/,/g, ""));
  return m[2]?.toLowerCase() === "k" ? n * 1e3 : m[2]?.toLowerCase() === "m" ? n * 1e6 : n;
}
