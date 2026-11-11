/** What each stage of Ask Arkiv does, top to bottom, in plain words. `at` is the stage the latest question has reached. */
const STEPS = (engine: "claude" | "rules"): { title: string; text: string }[] => [
  { title: "You ask", text: "Type a question in plain English. Scope narrows it to one dataset if you already know which." },
  { title: "ArkivAgent reads it", text: engine === "claude"
    ? "Claude matches your words to a dataset and its attributes, and the answer is checked against the catalogue."
    : "Catalogue rules match your words to a dataset and to the attributes its records really have." },
  { title: "You check the reading", text: "The “Interpreted as” card shows the dataset and each condition it understood. Click a condition to change or remove it." },
  { title: "It becomes a query", text: "The reading is turned into an Arkiv query. The Query tab shows it, and the TypeScript tab gives code you can copy." },
  { title: "It runs live on Arkiv", text: "The query is sent to the Arkiv testnet. It only reads; nothing is written or paid for." },
  { title: "You get the records", text: "Matching records come back as a table, with the block they were read at. “Open in Data Explorer” lets you check them elsewhere." },
  { title: "You refine it", text: "Ask a follow-up, such as “only in Surat”, and it is added to the same question." },
];

export function AskSteps({ engine, at, hasFailed = false }: { engine: "claude" | "rules"; at: number; hasFailed?: boolean }) {
  return (
    <aside aria-label="How Ask Arkiv works" className="rounded-md border border-border-subtle bg-surface p-5">
      <h2 className="label text-text-tertiary">How it works</h2>
      <ol className="mt-3">
        {STEPS(engine).map((s, i) => {
          const n = i + 1;
          const isDone = n < at;
          const isNow = n === at;
          return (
            <li key={s.title} className="relative flex gap-3 pb-4 last:pb-0" aria-current={isNow ? "step" : undefined}>
              {/* The line that joins this number to the next one. */}
              {n < 7 && <span className={`absolute left-[11px] top-6 h-[calc(100%-24px)] w-px ${isDone ? "bg-accent/60" : "bg-border-default"}`} aria-hidden />}
              <span className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border caption font-semibold tabular-nums ${isNow ? (hasFailed ? "border-danger text-danger" : "border-accent bg-accent text-on-accent") : isDone ? "border-accent/60 text-accent" : "border-border-default text-text-tertiary"}`}>{n}</span>
              <div className="min-w-0">
                <p className={`font-medium ${isNow || isDone ? "text-text-primary" : "text-text-secondary"}`}>{s.title}{isNow && <span className={`caption ml-2 font-normal ${hasFailed ? "text-danger" : "text-accent"}`}>{hasFailed ? "stopped here" : "you are here"}</span>}</p>
                <p className="caption mt-0.5 text-text-secondary">{s.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
