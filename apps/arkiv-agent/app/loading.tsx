/**
 * Shown the moment a tab is clicked, while the server works the page out and streams it in. Without
 * it a click waits for the whole page (up to a second, and megabytes for the catalogue) before
 * anything changes. Next prefetches this shell with each top-bar link, so the switch is immediate.
 */
export default function Loading() {
  const bar = "relative overflow-hidden rounded-md bg-surface shimmer";
  return (
    <div className="mx-auto max-w-[1280px] space-y-8 px-4 pb-16 pt-8 sm:px-6" aria-busy="true" aria-label="Loading the page">
      <div className="space-y-2">
        <div className={`${bar} h-[34px] w-64`} />
        <div className={`${bar} h-5 w-[min(520px,80%)]`} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className={`${bar} h-[104px]`} />)}
      </div>
      <div className={`${bar} h-[420px]`} />
    </div>
  );
}
