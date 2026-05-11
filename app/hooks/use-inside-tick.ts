"use client";

import { useEffect, useRef, useState } from "react";
import type { Tick } from "@/app/components/types";

/**
 * Returns a directional ▲/▼ marker whenever `price` changes against the
 * previous non-zero value. The marker auto-clears after `holdMs`. When
 * `resetKey` changes (e.g. on a coin switch) the prior price snapshot is
 * discarded and any in-flight tick is cleared — the old market's last
 * price is meaningless once we're looking at a different instrument.
 */
export function useInsideTick(
  price: number,
  resetKey: unknown,
  holdMs = 1500,
): Tick {
  const [tick, setTick] = useState<Tick>(null);
  const prevRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset baseline on resetKey change. Runs first so the price-effect below
  // sees prevRef.current === 0 and skips firing a spurious tick. The
  // setTick(null) is intentional — clearing a stale tick from the prior
  // instrument is the whole point of this effect, not derivable.
  useEffect(() => {
    prevRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTick(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [resetKey]);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = price;
    if (prev <= 0 || price <= 0 || prev === price) return;
    setTick({ dir: price > prev ? "up" : "down", ts: Date.now() });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setTick(null), holdMs);
  }, [price, holdMs]);

  return tick;
}
