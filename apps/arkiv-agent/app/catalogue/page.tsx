import { Suspense } from "react";
import { CatalogueView } from "../../components/catalogue/catalogue-view";
import { getCatalogueData } from "../../lib/catalogue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data catalogue · ArkivAgent" };

/** Server-rendered first paint (no skeleton); the client view keeps it live. */
export default function CataloguePage() {
  const data = getCatalogueData();
  return (
    <div className="mx-auto max-w-[1280px] space-y-8 px-4 pb-10 pt-10 sm:px-6">
      <header>
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.015em]">Data catalogue</h1>
        <p className="mt-1 text-text-secondary">What&apos;s stored on Arkiv, who writes it, and how fresh it is.</p>
      </header>
      {data.summary.indexedBlock === 0 ? (
        <div className="rounded-md bg-surface p-8">
          <h2 className="text-[20px] font-semibold">Building the index</h2>
          <p className="mt-2 text-text-secondary">ArkivAgent is reading Arkiv from its first block. Run <code className="font-mono">pnpm index</code>; this page fills in as datasets are found.</p>
        </div>
      ) : (
        <Suspense>
          <CatalogueView initial={data} />
        </Suspense>
      )}
    </div>
  );
}
