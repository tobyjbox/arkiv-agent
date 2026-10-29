"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useLive } from "../live/live-provider";

/** Re-renders the (server) pulse when the index moves, at most every 30 s: the pulse moves by the day. */
export function RefreshOnChange() {
  const { version } = useLive();
  const router = useRouter();
  const last = useRef(Date.now());
  useEffect(() => {
    if (Date.now() - last.current < 30_000) return;
    last.current = Date.now();
    router.refresh();
  }, [version, router]);
  return null;
}
