"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useLive } from "../live/live-provider";

/**
 * Rendered while the GLM price is still loading (T21 M3): re-renders /cost the next time the index
 * moves, by when the background lookup has usually finished. At most every 5 s; once the price is
 * there the server stops rendering this.
 */
export function RefreshForPrice() {
  const { version } = useLive();
  const router = useRouter();
  const seen = useRef(version);
  const last = useRef(0);
  useEffect(() => {
    if (version === seen.current || Date.now() - last.current < 5_000) return;
    seen.current = version;
    last.current = Date.now();
    router.refresh();
  }, [version, router]);
  return null;
}
