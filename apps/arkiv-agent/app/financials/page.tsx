import { estimatedSpend, feeModel } from "@arkiv-agent/cost";
import Link from "next/link";
import { Calculator } from "../../components/cost/calculator";
import { RefreshForPrice } from "../../components/cost/refresh-for-price";
import { glm } from "../../lib/glm";
import { glmPrice, usd } from "../../lib/glm-price";
import { formatCount } from "../../lib/format";
import { isIndexReady } from "../../lib/db";

export const dynamic = "force-dynamic";

const PRICE_NOTE = {
  loading: "Fetching the mainnet GLM price for USD amounts; until it arrives, amounts are in GLM only.",
  failed: "No GLM price source answered, so amounts are shown in GLM only.",
  off: "USD amounts are off (GLM_PRICE=off), so amounts are shown in GLM only.",
};
export const metadata = { title: "Financials · ArkivAgent" };

const int = (v: string | undefined, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

export default async function CostPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!isIndexReady()) return null;
  const q = await searchParams;
  const includeLoad = q.load === "1";
  const { rows, model, fittedAt } = feeModel();
  const spend = estimatedSpend(30, includeLoad);
  const { price, status: priceStatus } = glmPrice();
  const $ = (x: number) => (price ? usd(x * price.usd) : null);
  const unit = (["hours", "days", "months"] as const).find((u) => u === q.unit) ?? "days";
  const initial = { writes: int(q.writes, 1, 1_000_000, 1_000), payload: int(q.payload, 1, 100_000, 200), lifetime: int(q.lifetime, 1, 100_000, 7), unit };
  // Scatter: at most 2,000 points, evenly picked.
  const step = Math.max(1, Math.ceil(rows.length / 2_000));
  const dots = rows.filter((_, i) => i % step === 0);
  const maxX = Math.max(1, ...rows.map((r) => r.calldataBytes)), maxY = Math.max(1, ...rows.map((r) => r.gasUsed));
  const X = (v: number) => 40 + (Math.log10(Math.max(1, v)) / Math.log10(maxX)) * 540, Y = (v: number) => 190 - (Math.log10(Math.max(1, v)) / Math.log10(maxY)) * 180;

  return (
    <div className="mx-auto max-w-[1280px] space-y-10 px-4 pb-16 pt-8 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.015em]">Financials</h1>
        <p className="text-text-secondary">What writing to Arkiv costs, in GLM, from fees observed on Tiramisu. Every estimate shows its range.</p>
        <p className="caption text-text-tertiary">{price ? `USD amounts use the mainnet GLM price, $${price.usd.toPrecision(4)} (${price.source}, ${price.at.slice(11, 16)} UTC); Tiramisu testnet GLM itself has no value.` : PRICE_NOTE[priceStatus as Exclude<typeof priceStatus, "ok">]}</p>
        {priceStatus === "loading" && <RefreshForPrice />}
      </header>

      {model ? <Calculator model={model} fittedAt={fittedAt} initial={initial} price={price} />
        : <p className="rounded-md border border-border-subtle bg-surface p-5 text-text-secondary">Not enough observed fees to estimate yet (have {rows.length} receipts; need about 30). Run <code className="font-mono">pnpm fees</code>.</p>}

      <section aria-labelledby="spend" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="spend" className="text-[20px] font-semibold">Estimated spend, last 30 days</h2>
          <Link href={includeLoad ? "/financials" : "/financials?load=1"} className="caption text-text-secondary hover:text-text-primary">{includeLoad ? "Exclude load generators" : "Include load generators"}</Link>
        </div>
        {spend ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <div className="rounded-md bg-surface p-5"><div className="label text-text-tertiary">GLM spent (est.)</div><div className="stat mt-1">{glm(spend.glm)}</div><div className="caption text-text-secondary">{$(spend.glm) && <>≈ {$(spend.glm)} · </>}range {glm(spend.low)} to {glm(spend.high)}</div></div>
              <div className="rounded-md bg-surface p-5"><div className="label text-text-tertiary">Writes</div><div className="stat mt-1">{formatCount(spend.writes)}</div><div className="caption text-text-secondary">{includeLoad ? "load generators included" : "load generators excluded"}</div></div>
              <div className="rounded-md bg-surface p-5"><div className="label text-text-tertiary">GLM per write</div><div className="stat mt-1">{glm(spend.writes ? spend.glm / spend.writes : 0)}</div><div className="caption text-text-secondary">average{$(spend.writes ? spend.glm / spend.writes : 0) && <> · ≈ {$(spend.writes ? spend.glm / spend.writes : 0)}</>}</div></div>
            </div>
            <div className="overflow-x-auto rounded-md border border-border-subtle bg-surface">
              <table className="w-full text-left">
                <thead className="caption text-text-tertiary"><tr className="border-b border-border-subtle">
                  <th scope="col" className="px-4 py-2 font-medium">Project</th><th scope="col" className="px-3 py-2 text-right font-medium">GLM (est.)</th>{price && <th scope="col" className="px-3 py-2 text-right font-medium">USD (est.)</th>}
                  <th scope="col" className="px-3 py-2 font-medium">Share</th><th scope="col" className="px-3 py-2 text-right font-medium">Writes</th><th scope="col" className="px-3 py-2 text-right font-medium">GLM per write</th>
                </tr></thead>
                <tbody>{spend.projects.map((p) => (
                  <tr key={p.project} className="border-b border-border-subtle last:border-0">
                    <td className="max-w-[28ch] truncate px-4 py-2">{p.isLabel ? <a href={`/catalogue?q=${encodeURIComponent(p.project)}`} className="font-mono text-[13px] hover:underline">{p.project}</a> : <span className="font-mono text-[13px] text-text-secondary">{`${p.project.slice(0, 8)}…${p.project.slice(-4)}`}</span>}</td>
                    <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{glm(p.glm)}</td>
                    {price && <td className="px-3 py-2 text-right text-text-secondary" style={{ fontVariantNumeric: "tabular-nums" }}>{$(p.glm)}</td>}
                    <td className="px-3 py-2"><span className="block h-1.5 w-[60px] rounded-full bg-raised"><span className="block h-1.5 rounded-full bg-accent" style={{ width: `${Math.max(2, (p.glm / (spend.glm || 1)) * 100)}%` }} /></span></td>
                    <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCount(p.writes)}</td>
                    <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{glm(p.perWrite)}</td>
                  </tr>))}</tbody>
              </table>
            </div>
            <p className="caption text-text-tertiary">Estimated: each create priced by the fee model from its payload size, each update at the median observed fee per update. Exact fees need one receipt per transaction; ArkivAgent has sampled {formatCount(spend.receipts)}.</p>
          </>
        ) : <p className="text-text-secondary">Needs the fee model (above).</p>}
      </section>

      {model && (
        <section aria-labelledby="model" className="space-y-3">
          <h2 id="model" className="text-[20px] font-semibold">The fee model</h2>
          <p className="rounded-md px-4 py-2 tint-info">Finding: on today's Tiramisu a record's lifetime doesn't change its fee. Across {model.lifetime.n} sampled creates with lifetimes of {Math.round(model.lifetime.spanDays[0])} to {Math.round(model.lifetime.spanDays[1])} days, lifetime explains {Math.round(model.lifetime.r2 * 100)}% of what's left after calldata. Arkiv plans storage rent, which would change this.</p>
          <figure className="rounded-md border border-border-subtle bg-surface p-4">
            <svg viewBox="0 0 600 210" className="h-[240px] w-full" role="img" aria-label="Gas used against calldata size, log scales">
              <path d={`M${X(model.observed.calldataBytes[0])},${Y((model.gas.intercept + model.gas.slope * model.observed.calldataBytes[0]) * model.band.high)} ` +
                [model.observed.calldataBytes[0], model.observed.calldataBytes[1]].map((c) => `L${X(c)},${Y((model.gas.intercept + model.gas.slope * c) * model.band.high)}`).join(" ") + " " +
                [model.observed.calldataBytes[1], model.observed.calldataBytes[0]].map((c) => `L${X(c)},${Y((model.gas.intercept + model.gas.slope * c) * model.band.low)}`).join(" ") + " Z"}
                fill="color-mix(in srgb, var(--color-accent) 16%, transparent)" />
              {dots.map((r, i) => <circle key={i} cx={X(r.calldataBytes)} cy={Y(r.gasUsed)} r="2" fill="var(--color-text-tertiary)" opacity="0.4" />)}
              <line x1={X(model.observed.calldataBytes[0])} y1={Y(model.gas.intercept + model.gas.slope * model.observed.calldataBytes[0])} x2={X(model.observed.calldataBytes[1])} y2={Y(model.gas.intercept + model.gas.slope * model.observed.calldataBytes[1])} stroke="var(--color-accent)" strokeWidth="1.5" />
              <text x="40" y="205" className="fill-[var(--color-text-tertiary)] text-[10px]">calldata bytes (log)</text>
              <text x="4" y="12" className="fill-[var(--color-text-tertiary)] text-[10px]">gas (log)</text>
            </svg>
            <figcaption className="caption text-text-secondary">
              gas = {Math.round(model.gas.intercept).toLocaleString("en")} + {model.gas.slope.toFixed(2)} × calldata bytes (R² {model.gas.r2.toFixed(2)}, {model.gas.n} transactions); calldata = {Math.round(model.calldata.intercept).toLocaleString("en")} + {model.calldata.slope.toFixed(2)} × payload bytes (R² {model.calldata.r2.toFixed(2)}, {model.calldata.n} single-record creates); price {(model.gasPrice * 1e9).toPrecision(3)} gwei (median).
              {" "}Range: observed fees are {model.band.low.toFixed(2)}× to {model.band.high.toFixed(2)}× the estimate for 90% of fitted creates; on {model.coverage.of} held-out creates, {model.coverage.inside} ({Math.round((model.coverage.inside / Math.max(1, model.coverage.of)) * 100)}%) fell inside it.
              {dots.length < rows.length ? ` Showing ${formatCount(dots.length)} of ${formatCount(rows.length)} transactions.` : ""} Fitted {fittedAt.slice(0, 16).replace("T", " ")} UTC.
            </figcaption>
          </figure>
        </section>
      )}
    </div>
  );
}
