"use client";

import { useEffect, useRef, useState } from "react";
import type { ConnectionState } from "@/app/lib/hyperliquid";

/**
 * Returns true when no message has arrived in `thresholdMs`. The latest
 * `lastMessageAt` is stashed in a ref so the interval doesn't tear down on
 * every WebSocket frame (which would churn many times per second).
 */
function useIsStale(lastMessageAt: number | null, thresholdMs: number): boolean {
  const [isStale, setIsStale] = useState(false);
  const lastRef = useRef(lastMessageAt);
  // Latest-value ref pattern: write during render so the 1s interval below
  // doesn't tear down on every WS frame (would churn many times per second).
  // eslint-disable-next-line react-hooks/refs
  lastRef.current = lastMessageAt;

  useEffect(() => {
    const id = setInterval(() => {
      const ts = lastRef.current;
      setIsStale(ts !== null && Date.now() - ts > thresholdMs);
    }, 1000);
    return () => clearInterval(id);
  }, [thresholdMs]);

  return isStale;
}

/**
 * Small dot reflecting the WebSocket connection state — green for live,
 * amber for connecting / stale, red for error. Pulses while live.
 */
export function StatusDot({
  state,
  lastMessageAt,
}: {
  state: ConnectionState;
  lastMessageAt: number | null;
}) {
  const isStale = useIsStale(lastMessageAt, 5000);
  const display: ConnectionState | "stale" =
    state === "live" && isStale ? "stale" : state;

  const color: Record<typeof display, string> = {
    live: "bg-bid",
    connecting: "bg-amber-400",
    stale: "bg-amber-400",
    error: "bg-ask",
  };
  const label: Record<typeof display, string> = {
    live: "Live",
    connecting: "Connecting",
    stale: "Stale",
    error: "Disconnected",
  };

  return (
    <span
      role="status"
      aria-label={`Connection: ${label[display]}`}
      title={label[display]}
      className={`w-2 h-2 rounded-full ${color[display]} ${display === "live" ? "animate-pulse" : ""}`}
    />
  );
}
