import type { FeeModel, FeeSummary } from "@arkiv-agent/cost";
import { formatCount } from "../../lib/format";

/**
 * Gas used against calldata size (log scales) for the sampled receipts, with the fitted line and its
 * 90% band, and the model in words underneath.
 */
export function FeeScatter({ fees }: { fees: FeeSummary & { model: FeeModel } }) {
  const { model, fittedAt, receipts, points: dots, maxCalldataBytes: maxX, maxGasUsed: maxY } = fees;
  const X = (v: number) => 40 + (Math.log10(Math.max(1, v)) / Math.log10(maxX)) * 540, Y = (v: number) => 190 - (Math.log10(Math.max(1, v)) / Math.log10(maxY)) * 180;
  return (
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
        {dots.length < receipts ? ` Showing ${formatCount(dots.length)} of ${formatCount(receipts)} transactions.` : ""} Fitted {fittedAt.slice(0, 16).replace("T", " ")} UTC.
      </figcaption>
    </figure>
  );
}
