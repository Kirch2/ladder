"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { formatPrice, formatSize } from "@/app/lib/format";
import type { Tick } from "@/app/components/types";

/** Three-column cell wrapper. Shares the `relative font-mono` defaults so
 * the call sites only specify what's actually different (color, weight,
 * alignment). */
function Cell({
  align = "left",
  className = "",
  children,
}: {
  align?: "left" | "right";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`relative font-mono ${align === "right" ? "text-right" : ""} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * One price level in the order book. Memo'd with flat primitive props so
 * unchanged rows skip render between WebSocket frames.
 *
 * Each row tracks its own hover state: while hovered, the displayed
 * `sz / total / cumulative-bar ratio` are pinned to a frozen snapshot so
 * the user can read a stable value. Live data keeps flowing in props and is
 * mirrored into refs (so the flash effect's prev-trackers stay current),
 * but the visual flash is suppressed during hover and the ▲/▼ tick is
 * hidden to avoid pairing a fresh arrow with a stale price.
 */
export const BookRow = memo(function BookRow({
  side,
  px,
  sz,
  total,
  maxTotal,
  sizeDecimals,
  emphasized = false,
  tick = null,
}: {
  side: "ask" | "bid";
  px: string;
  sz: string;
  total: number;
  maxTotal: number;
  sizeDecimals: number;
  emphasized?: boolean;
  tick?: Tick;
}) {
  const ratio = Math.max(0.04, total / maxTotal);
  const fill = side === "ask" ? "bg-ask-fill" : "bg-bid-fill";
  const flashBar = side === "ask" ? "bg-ask" : "bg-bid";
  const priceColor = side === "ask" ? "text-ask" : "text-bid";
  const weight = emphasized ? "font-medium" : "";

  const [isHovering, setIsHovering] = useState(false);
  const frozenRef = useRef<{ sz: string; total: number; ratio: number } | null>(
    null,
  );

  const showSz =
    isHovering && frozenRef.current ? frozenRef.current.sz : sz;
  const showTotal =
    isHovering && frozenRef.current ? frozenRef.current.total : total;
  const showRatio =
    isHovering && frozenRef.current ? frozenRef.current.ratio : ratio;
  const showTick = isHovering ? null : tick;

  const flashRef = useRef<HTMLSpanElement>(null);
  const prevSzRef = useRef<string>(sz);
  const prevTickTsRef = useRef<number | null>(tick?.ts ?? null);
  useEffect(() => {
    const szChanged = prevSzRef.current !== sz;
    const tickFired = tick !== null && prevTickTsRef.current !== tick.ts;
    prevSzRef.current = sz;
    prevTickTsRef.current = tick?.ts ?? null;
    if (!szChanged && !tickFired) return;
    // Track refs but don't visually flash while hovered.
    if (isHovering) return;
    const el = flashRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 420,
      easing: "ease-out",
      fill: "forwards",
    });
  }, [sz, tick, isHovering]);

  return (
    <div
      role="row"
      onMouseEnter={() => {
        // Snapshot BEFORE flipping isHovering so the next render reads the
        // pinned values rather than live props arriving from the next frame.
        frozenRef.current = { sz, total, ratio };
        setIsHovering(true);
      }}
      onMouseLeave={() => {
        frozenRef.current = null;
        setIsHovering(false);
      }}
      className="relative grid grid-cols-[1fr_1fr_1fr] items-center gap-2 px-3 h-[26px] text-[13px] hover:bg-white/[0.03] transition-colors"
    >
      {/* Cumulative-size bar (right-anchored). */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 right-0 ${fill}`}
        style={{ width: `${showRatio * 100}%` }}
      />
      {/* Update flash: 4px left-edge bar, opacity 1→0 on size/tick change. */}
      <span
        ref={flashRef}
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${flashBar} opacity-0 pointer-events-none`}
      />
      <Cell className={`${priceColor} ${weight} flex items-center gap-1`}>
        {formatPrice(px)}
        {showTick && (
          <span
            key={showTick.ts}
            aria-hidden="true"
            className={`text-[9px] leading-none ${showTick.dir === "up" ? "text-bid" : "text-ask"}`}
            style={{ animation: "tick-fade 1.5s forwards" }}
          >
            {showTick.dir === "up" ? "▲" : "▼"}
          </span>
        )}
      </Cell>
      <Cell align="right" className={`text-text ${weight}`}>
        {formatSize(showSz, sizeDecimals)}
      </Cell>
      <Cell align="right" className={`text-text ${weight}`}>
        {formatSize(showTotal, sizeDecimals)}
      </Cell>
    </div>
  );
});
