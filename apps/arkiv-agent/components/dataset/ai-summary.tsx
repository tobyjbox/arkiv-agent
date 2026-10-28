import { Sparkles } from "lucide-react";

/** AI summary card. Until descriptions are generated (needs ANTHROPIC_API_KEY), a neutral note. */
export function AiSummary({ text, caption }: { text: string | null; caption?: string }) {
  if (!text) {
    return (
      <div className="rounded-md border border-border-default bg-surface p-5 text-text-secondary">
        No AI summary yet. The schema below is read directly from Arkiv.
      </div>
    );
  }
  return (
    <div className="rounded-md p-5 tint-ai">
      <div className="label flex items-center gap-1.5"><Sparkles size={14} aria-hidden />AI summary</div>
      <p className="mt-2 text-text-primary">{text}</p>
      {caption && <p className="mt-3 caption text-text-tertiary">{caption}</p>}
    </div>
  );
}
