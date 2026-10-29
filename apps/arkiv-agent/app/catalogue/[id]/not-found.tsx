import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6">
      <div className="rounded-md bg-surface p-10 text-center">
        <h1 className="text-[20px] font-semibold">This dataset isn&apos;t in the catalogue</h1>
        <p className="mt-2 text-text-secondary">It may have expired, or the link is wrong. Press ⌘K to search.</p>
        <Link href="/catalogue" className="mt-4 inline-block text-accent hover:underline">Back to the catalogue</Link>
      </div>
    </div>
  );
}
