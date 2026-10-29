import { estimatedSpend, feeSummary, glmPriceOrClose } from "@arkiv-agent/cost";
import Link from "next/link";
import { Calculator } from "../../components/cost/calculator";
import { PriceChart } from "../../components/cost/price-chart";
import { FeeScatter } from "../../components/cost/fee-scatter";
import { SpendTable } from "../../components/cost/spend-table";
import { RefreshForPrice } from "../../components/cost/refresh-for-price";
import { glm, usd } from "../../lib/glm";
import { formatCount } from "../../lib/format";
import { isIndexReady } from "../../lib/db";
import { ResultsPending } from "../../components/ui/results-pending";

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
  const fees = feeSummary();
  if (!fees) return <ResultsPending title="Financials" />;
  const { model, fittedAt, receipts } = fees;
  const spend = estimatedSpend(30, includeLoad);
  const { price, status: priceStatus } = glmPriceOrClose();
  const $ = (x: number) => (price ? usd(x * price.usd) : null);
  const unit = (["hours", "days", "months"] as const).find((u) => u === q.unit) ?? "days";
  const initial = { writes: int(q.writes, 1, 1_000_000, 1_000), payload: int(q.payload, 1, 100_000, 200), lifetime: int(q.lifetime, 1, 100_000, 7), unit };

  return (
    <div className="mx-auto max-w-[1280px] space-y-10 px-4 pb-16 pt-8 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.015em]">Financials</h1>
        <p className="text-text-secondary">What writing to Arkiv costs, in GLM, from fees observed on Tiramisu. Every estimate shows its range.</p>
        <p className="caption text-text-tertiary">{price ? `USD amounts use the mainnet GLM price, $${price.usd.toPrecision(4)} (${price.source}, ${price.at.slice(11, 16)} UTC); Tiramisu testnet GLM itself has no value.` : PRICE_NOTE[priceStatus as Exclude<typeof priceStatus, "ok">]}</p>
        {priceStatus === "loading" && <RefreshForPrice />}
      </header>

      {priceStatus === "off" ? <p className="caption text-text-tertiary">The GLM price chart is off (GLM_PRICE=off).</p> : <PriceChart spot={price} />}

      {model ? <Calculator model={model} fittedAt={fittedAt} initial={initial} price={price} />
        : <p className="rounded-md border border-border-subtle bg-surface p-5 text-text-secondary">Not enough observed fees to estimate yet (have {receipts} receipts; need about 30). Run <code className="font-mono">pnpm fees</code>.</p>}

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
            <SpendTable spend={spend} price={price} />
            <p className="caption text-text-tertiary">Estimated: each create priced by the fee model from its payload size, each update at the median observed fee per update. Exact fees need one receipt per transaction; ArkivAgent has sampled {formatCount(spend.receipts)}.</p>
          </>
        ) : <p className="text-text-secondary">Needs the fee model (above).</p>}
      </section>

      {model && (
        <section aria-labelledby="model" className="space-y-3">
          <h2 id="model" className="text-[20px] font-semibold">The fee model</h2>
          <p className="rounded-md px-4 py-2 tint-info">Finding: on today's Tiramisu a record's lifetime doesn't change its fee. Across {model.lifetime.n} sampled creates with lifetimes of {Math.round(model.lifetime.spanDays[0])} to {Math.round(model.lifetime.spanDays[1])} days, lifetime explains {Math.round(model.lifetime.r2 * 100)}% of what's left after calldata. Arkiv plans storage rent, which would change this.</p>
          <FeeScatter fees={{ ...fees, model }} />
        </section>
      )}
    </div>
  );
}
