import { type CohortView, Retention } from "../../components/pulse/retention";
import { ActivityChart } from "../../components/pulse/activity";
import { PulseControls } from "../../components/pulse/controls";
import { RefreshOnChange } from "../../components/pulse/refresh";
import { Sparkline } from "../../components/ui/sparkline";
import { dayLabel, getPulse, type Period, PERIODS, WINDOWS } from "@arkiv-agent/pulse";
import { formatCount } from "../../lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ecosystem pulse · ArkivAgent" };

const delta = (now: number, before: number | undefined, period: number) => {
  if (before === undefined) return "first period on Tiramisu";
  if (before === 0) return now ? `new vs previous ${period} d` : `same as previous ${period} d`;
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct > 0 ? "+" : ""}${pct}% vs previous ${period} d`;
};

export default async function PulsePage({ searchParams }: { searchParams: Promise<{ period?: string; load?: string }> }) {
  const params = await searchParams;
  const period = (PERIODS as readonly number[]).includes(Number(params.period)) ? (Number(params.period) as Period) : 30;
  const includeLoad = params.load === "1";
  const p = getPulse({ period, includeLoad });
  const days = p.days.map((d) => ({ ...d, day: dayLabel(d.day) }));
  const opensIn = (c: (typeof p.cohorts)[number]) =>
    Object.fromEntries((Object.keys(WINDOWS) as (keyof typeof WINDOWS)[]).map((k) => [k, c.retention[k].reached ? null : Math.max(1, Math.min(...c.projects.map((x) => x.day0 + WINDOWS[k][1] + 1 - p.today)))])) as CohortView["opensIn"];
  const cohorts: CohortView[] = [...p.events, ...p.cohorts].map((c) => ({ id: c.id, label: c.label, source: c.source, projects: c.projects, retention: c.retention, opensIn: opensIn(c) }));
  const tiles = [
    { label: "Active wallets", value: p.totals.wallets, before: p.previous?.wallets, series: p.days.map((d) => d.wallets), tooltip: "Wallets that created or updated a record in the period." },
    { label: "Active projects", value: p.totals.projects, before: p.previous?.projects, series: p.days.map((d) => d.projects), tooltip: "Projects with a project label (app, project…) that wrote in the period. Wallets without a label count under Active wallets only." },
    { label: "Writes", value: p.totals.writes, before: p.previous?.writes, series: p.days.map((d) => d.writes), tooltip: "Creates plus updates, from the ArkivAgent index." },
    { label: "New projects", value: p.totals.newProjects, before: p.previous?.newProjects, series: p.days.map((d) => d.newProjects), tooltip: "Labelled projects whose first write on Tiramisu fell in the period." },
  ];

  return (
    <div className="mx-auto max-w-[1280px] space-y-10 px-4 pb-16 pt-8 sm:px-6">
      <RefreshOnChange />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.015em]">Ecosystem pulse</h1>
          <p className="text-text-secondary">Who is building on Arkiv, and who keeps building.</p>
        </div>
        <PulseControls period={period} includeLoad={includeLoad} loadWallets={p.loadWallets} />
      </header>

      <p className="caption text-text-tertiary">No weekly summary yet.{process.env.ANTHROPIC_API_KEY ? "" : " (A weekly AI summary needs ANTHROPIC_API_KEY.)"}</p>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-md bg-surface p-5" title={t.tooltip}>
            <div className="label text-text-tertiary">{t.label}</div>
            <div className="stat mt-1">{formatCount(t.value)}</div>
            <div className={`caption mt-1 ${t.before !== undefined && t.value > t.before ? "text-live" : "text-text-secondary"}`}>{delta(t.value, t.before, period)}</div>
            <Sparkline points={t.series} height={28} className="mt-2 text-accent" />
          </div>
        ))}
      </section>
      {includeLoad && <p className="rounded-md px-4 py-2 caption tint-warn">Load generators included: {p.loadWallets} wallets that write thousands of records an hour dominate these totals.</p>}

      <section aria-labelledby="retention" className="space-y-3">
        <h2 id="retention" className="text-[20px] font-semibold">Retention</h2>
        <Retention cohorts={cohorts} hasEvents={p.events.length > 0} />
      </section>

      <section aria-labelledby="activity" className="space-y-3">
        <h2 id="activity" className="text-[20px] font-semibold">Activity over time</h2>
        <ActivityChart days={days} missingDays={p.missingDays} firstDay={dayLabel(p.firstDay)} />
      </section>

      <section aria-labelledby="active" className="space-y-3">
        <h2 id="active" className="text-[20px] font-semibold">Most active projects</h2>
        <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface">
          <table className="w-full text-left">
            <thead className="caption text-text-tertiary">
              <tr className="border-b border-border-subtle">
                <th scope="col" className="px-4 py-2 font-medium">Project</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Writes ({period} d)</th>
                <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">Daily</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Active days</th>
                <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Datasets</th>
                <th scope="col" className="px-3 py-2 font-medium">Last write</th>
              </tr>
            </thead>
            <tbody>
              {p.projects.map((a) => (
                <tr key={a.project} className="border-b border-border-subtle last:border-0">
                  <td className="max-w-[28ch] truncate px-4 py-2">
                    {a.isLabel ? <a href={`/catalogue?q=${encodeURIComponent(a.project)}`} className="font-mono text-[13px] hover:underline">{a.project}</a>
                      : <span className="font-mono text-[13px] text-text-secondary" title="A wallet without a project label">{`${a.project.slice(0, 8)}…${a.project.slice(-4)}`}</span>}
                  </td>
                  <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCount(a.writes)}</td>
                  <td className="hidden w-32 px-3 py-2 sm:table-cell"><Sparkline points={a.daily.slice(-Math.min(period, 30))} height={20} className="text-accent" /></td>
                  <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{a.activeDays}</td>
                  <td className="hidden px-3 py-2 text-right sm:table-cell">{p.datasetsByProject[a.project] ?? "—"}</td>
                  <td className="px-3 py-2 caption text-text-secondary">{dayLabel(a.lastDay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="caption text-text-tertiary">From the ArkivAgent index of Tiramisu since {dayLabel(p.firstDay)}, days in UTC. Projects are named by their records' project label; a wallet's records count for the label it uses most.</p>
    </div>
  );
}
