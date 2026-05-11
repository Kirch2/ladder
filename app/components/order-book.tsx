"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { SIZE_DECIMALS, type Coin, type NSigFigs } from "@/app/lib/hyperliquid";
import {
  buildRows,
  formatPrice,
  formatSize,
  formatSpreadPercent,
  sigFigsFromTick,
} from "@/app/lib/format";
import { useOrderBook } from "@/app/hooks/use-order-book";
import { ControlBar } from "@/app/components/control-bar";
import { SkeletonRow } from "@/app/components/skeleton-row";

const ROWS_PER_SIDE = 14;

type Tick = { dir: "up" | "down"; ts: number } | null;

export function OrderBook() {
  const [coin, setCoin] = useState<Coin>("BTC");
  const [nSigFigs, setNSigFigs] = useState<NSigFigs>(5);

  const { bids, asks, connectionState, lastMessageAt } = useOrderBook(
    coin,
    nSigFigs,
  );

  const askRows = useMemo(() => buildRows(asks, ROWS_PER_SIDE), [asks]);
  const bidRows = useMemo(() => buildRows(bids, ROWS_PER_SIDE), [bids]);

  const totalBid = bidRows.at(-1)?.total ?? 0;
  const totalAsk = askRows.at(-1)?.total ?? 0;
  const maxTotal = Math.max(totalAsk, totalBid, 1);
  // Imbalance: 0.5 = balanced, >0.5 = bids dominate visible depth.
  const bidShare =
    totalBid + totalAsk > 0 ? totalBid / (totalBid + totalAsk) : 0.5;

  const bestAsk = Number(asks[0]?.px ?? "0");
  const bestBid = Number(bids[0]?.px ?? "0");
  const mid = bestAsk > 0 && bestBid > 0 ? (bestAsk + bestBid) / 2 : 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
  const referencePrice = mid || bestAsk || bestBid;

  // Directional tick on each side: fires for ~1.5s when the inside price
  // moves, then auto-clears.
  const [bidTick, setBidTick] = useState<Tick>(null);
  const [askTick, setAskTick] = useState<Tick>(null);
  const prevBestBidRef = useRef(0);
  const prevBestAskRef = useRef(0);
  const bidTickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const askTickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevBestBidRef.current;
    prevBestBidRef.current = bestBid;
    if (prev <= 0 || bestBid <= 0 || prev === bestBid) return;
    setBidTick({ dir: bestBid > prev ? "up" : "down", ts: Date.now() });
    if (bidTickTimerRef.current) clearTimeout(bidTickTimerRef.current);
    bidTickTimerRef.current = setTimeout(() => setBidTick(null), 1500);
  }, [bestBid]);

  useEffect(() => {
    const prev = prevBestAskRef.current;
    prevBestAskRef.current = bestAsk;
    if (prev <= 0 || bestAsk <= 0 || prev === bestAsk) return;
    setAskTick({ dir: bestAsk > prev ? "up" : "down", ts: Date.now() });
    if (askTickTimerRef.current) clearTimeout(askTickTimerRef.current);
    askTickTimerRef.current = setTimeout(() => setAskTick(null), 1500);
  }, [bestAsk]);

  useEffect(() => {
    prevBestBidRef.current = 0;
    prevBestAskRef.current = 0;
    setBidTick(null);
    setAskTick(null);
  }, [coin]);

  // Keep a stable price across the empty-book gap during re-subscription, so
  // the precision dropdown doesn't flash to the first option while the new
  // feed warms up. Reset whenever the coin changes.
  const stablePriceRef = useRef<{ coin: Coin; price: number }>({
    coin,
    price: 0,
  });
  if (stablePriceRef.current.coin !== coin) {
    stablePriceRef.current = { coin, price: 0 };
  }
  if (referencePrice > 0) {
    stablePriceRef.current.price = referencePrice;
  }
  const stablePrice = stablePriceRef.current.price || referencePrice;

  const handleTickChange = (tick: number) => {
    const next = sigFigsFromTick(tick, stablePrice);
    if (next === null) return;
    setNSigFigs(next);
  };

  const askDisplay = [...askRows].reverse();
  const sizeDecimals = SIZE_DECIMALS[coin];

  return (
    <section
      aria-label={`${coin}-USD order book`}
      className="w-full max-w-[400px] rounded-md border border-line bg-panel overflow-hidden font-sans"
    >
      <ControlBar
        coin={coin}
        onCoinChange={setCoin}
        nSigFigs={nSigFigs}
        onTickChange={handleTickChange}
        referencePrice={stablePrice}
        connectionState={connectionState}
        lastMessageAt={lastMessageAt}
      />

      {connectionState !== "live" && (
        <div
          role="status"
          className="px-3 py-1 text-[11px] text-muted border-b border-line"
        >
          {connectionState === "error" ? "Reconnecting…" : "Connecting…"}
        </div>
      )}

      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-1.5 text-[13px] text-text">
        <span>Price</span>
        <span className="text-right">Size ({coin})</span>
        <span className="text-right">Total ({coin})</span>
      </div>

      <div role="rowgroup" aria-label="Asks" className="space-y-0.5">
        {askDisplay.length === 0
          ? Array.from({ length: ROWS_PER_SIDE }, (_, i) => (
              <SkeletonRow key={`ask-skel-${i}`} />
            ))
          : askDisplay.map((row, i) => {
              const isInside = i === askDisplay.length - 1;
              return (
                <BookRow
                  key={`ask-${row.px}`}
                  side="ask"
                  px={row.px}
                  sz={row.sz}
                  total={row.total}
                  maxTotal={maxTotal}
                  sizeDecimals={sizeDecimals}
                  emphasized={isInside}
                  tick={isInside ? askTick : null}
                />
              );
            })}
      </div>

      <SpreadRow spread={spread} mid={mid} bidShare={bidShare} />

      <div role="rowgroup" aria-label="Bids" className="space-y-0.5">
        {bidRows.length === 0
          ? Array.from({ length: ROWS_PER_SIDE }, (_, i) => (
              <SkeletonRow key={`bid-skel-${i}`} />
            ))
          : bidRows.map((row, i) => {
              const isInside = i === 0;
              return (
                <BookRow
                  key={`bid-${row.px}`}
                  side="bid"
                  px={row.px}
                  sz={row.sz}
                  total={row.total}
                  maxTotal={maxTotal}
                  sizeDecimals={sizeDecimals}
                  emphasized={isInside}
                  tick={isInside ? bidTick : null}
                />
              );
            })}
      </div>
    </section>
  );
}

// memo'd with flat primitive props so unchanged rows skip render between WS
// frames. Each row tracks its own hover state and, while hovered, freezes
// the displayed sz/total/ratio so the user can read a stable snapshot —
// live data keeps flowing in props but isn't shown until they move off the
// row.
const BookRow = memo(function BookRow({
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

  // Per-row hover + frozen snapshot. When hovering, display these instead of
  // the live props. Live props keep arriving and are mirrored into refs so
  // the flash effect tracks them; un-hover doesn't fire a spurious flash.
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
  // Suppress the tick arrow while frozen so a fresh ▲/▼ can't appear next
  // to a stale price.
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
      <span
        className={`relative ${priceColor} ${weight} font-mono flex items-center gap-1`}
      >
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
      </span>
      <span className={`relative text-right text-text ${weight} font-mono`}>
        {formatSize(showSz, sizeDecimals)}
      </span>
      <span className={`relative text-right text-text ${weight} font-mono`}>
        {formatSize(showTotal, sizeDecimals)}
      </span>
    </div>
  );
});

function SpreadRow({
  spread,
  mid,
  bidShare,
}: {
  spread: number;
  mid: number;
  bidShare: number;
}) {
  const pct = formatSpreadPercent(spread, mid);
  const BASE = 1;
  const PEAK = 1.4;
  const bidBrightness =
    BASE + (PEAK - BASE) * Math.max(0, (bidShare - 0.5) * 2);
  const askBrightness =
    BASE + (PEAK - BASE) * Math.max(0, (0.5 - bidShare) * 2);
  return (
    <div
      role="row"
      aria-label="Spread"
      className="relative grid grid-cols-[1fr_1fr_1fr] items-center gap-2 px-3 h-[30px] text-[13px] text-text border-t border-line"
    >
      <span className="text-center">Spread</span>
      <span className="text-right font-mono">
        {spread > 0 ? formatPrice(spread) : "—"}
      </span>
      <span className="text-right font-mono">{pct}</span>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1.5 flex opacity-90"
      >
        <span
          className="bg-bid transition-all duration-500"
          style={{
            width: `${bidShare * 100}%`,
            filter: `brightness(${bidBrightness})`,
          }}
        />
        <span
          className="bg-ask flex-1 transition-all duration-500"
          style={{ filter: `brightness(${askBrightness})` }}
        />
      </span>
    </div>
  );
}
