"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const [isCopied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={isCopied ? "Copied" : label}
      title={isCopied ? "Copied" : label}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2_000);
      }}
      className={`inline-flex size-7 items-center justify-center rounded-sm text-text-tertiary transition-colors duration-[80ms] hover:bg-raised hover:text-text-primary ${className}`}
    >
      {isCopied ? <Check size={14} className="text-live" /> : <Copy size={14} />}
    </button>
  );
}
