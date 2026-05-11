"use client";

import { memo } from "react";

/**
 * Pulsing placeholder row used in place of a `BookRow` while the order book
 * has no live data — e.g. cold load or the brief gap after a coin/precision
 * switch.
 */
export const SkeletonRow = memo(function SkeletonRow() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 px-3 h-[26px]"
    >
      <span className="h-[8px] w-12 rounded bg-line-strong/60 animate-pulse" />
      <span className="h-[8px] w-10 rounded bg-line-strong/60 animate-pulse justify-self-end" />
      <span className="h-[8px] w-10 rounded bg-line-strong/60 animate-pulse justify-self-end" />
    </div>
  );
});
