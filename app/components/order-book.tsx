"use client";

import { useMemo, useRef, useState } from "react";
import { SIZE_DECIMALS, type Coin, type NSigFigs } from "@/app/lib/hyperliquid";
import {
  buildRows,
  formatPrice,
  formatSpreadPercent,
  sigFigsFromTick,
} from "@/app/lib/format";
import { sideBrightness } from "@/app/lib/imbalance";
import { useOrderBook } from "@/app/hooks/use-order-book";
import { useInsideTick } from "@/app/hooks/use-inside-tick";
import { BookRow } from "@/app/components/book-row";
import { ControlBar } from "@/app/components/control-bar";
import { SkeletonRow } from "@/app/components/skeleton-row";

const ROWS_PER_SIDE = 14;

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

  // Directional ▲/▼ on each side: fires when the inside price moves and
  // auto-clears after 1.5s. Reset when the coin changes — prior snapshot is
  // meaningless once we're looking at a different instrument.
  const bidTick = useInsideTick(bestBid, coin);
  const askTick = useInsideTick(bestAsk, coin);

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
      className="w-full max-w-[440px] rounded-md border border-line bg-panel overflow-hidden font-sans"
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
  // −1 (ask dominates) … 0 (balanced) … +1 (bid dominates)
  const bidAmp = (bidShare - 0.5) * 2;
  const bidBrightness = sideBrightness(bidAmp);
  const askBrightness = sideBrightness(-bidAmp);
  return (
    <div
      role="row"
      aria-label="Spread"
      className="relative grid grid-cols-[1fr_1fr_1fr] items-center gap-2 px-3 h-[30px] text-[13px] text-text border-t border-line"
    >
      <span className="text-center">Spread</span>
      <span className="text-right font-mono font-semibold">
        {spread > 0 ? formatPrice(spread) : "—"}
      </span>
      <span className="text-right font-mono font-semibold">{pct}</span>
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
