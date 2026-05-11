"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  COINS,
  SIZE_DECIMALS,
  TICK_OPTIONS_BY_COIN,
  type Coin,
  type ConnectionState,
  type NSigFigs,
} from "@/app/lib/hyperliquid";
import {
  buildRows,
  formatPrice,
  formatSize,
  formatSpreadPercent,
  formatTick,
  sigFigsFromTick,
  tickFromSigFigs,
} from "@/app/lib/format";
import { useOrderBook } from "@/app/hooks/use-order-book";

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
  // moves, then auto-clears. The inside BookRow shows a ▲/▼ glyph during that
  // window so a price tick is visible even when size at the new level didn't
  // change.
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

  // Reset ticks when the coin changes — prior price snapshot is meaningless.
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

  // Reverse asks so the best ask sits immediately above the spread row.
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

function ControlBar({
  coin,
  onCoinChange,
  nSigFigs,
  onTickChange,
  referencePrice,
  connectionState,
  lastMessageAt,
}: {
  coin: Coin;
  onCoinChange: (coin: Coin) => void;
  nSigFigs: NSigFigs;
  onTickChange: (tick: number) => void;
  referencePrice: number;
  connectionState: ConnectionState;
  lastMessageAt: number | null;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-line">
      <PrecisionSelect
        coin={coin}
        nSigFigs={nSigFigs}
        onTickChange={onTickChange}
        referencePrice={referencePrice}
      />
      <div className="flex items-center gap-2.5">
        <StatusDot state={connectionState} lastMessageAt={lastMessageAt} />
        <CoinSelect value={coin} onChange={onCoinChange} />
      </div>
    </div>
  );
}

function PrecisionSelect({
  coin,
  nSigFigs,
  onTickChange,
  referencePrice,
}: {
  coin: Coin;
  nSigFigs: NSigFigs;
  onTickChange: (tick: number) => void;
  referencePrice: number;
}) {
  // Fall back to the full list before the first frame lands so the dropdown
  // renders usable on cold load; it tightens once we have a price.
  const wanted = TICK_OPTIONS_BY_COIN[coin];
  const availableTicks =
    referencePrice > 0
      ? wanted.filter((t) => sigFigsFromTick(t, referencePrice) !== null)
      : wanted;

  const currentTick = referencePrice > 0
    ? tickFromSigFigs(referencePrice, nSigFigs)
    : null;

  return (
    <label className="relative inline-flex items-center text-[15px] text-text">
      <span className="sr-only">Price precision</span>
      <select
        value={currentTick ?? ""}
        onChange={(e) => onTickChange(Number(e.target.value))}
        className="appearance-none bg-transparent pr-6 cursor-pointer focus:outline-none font-mono"
      >
        {availableTicks.map((tick) => (
          <option key={tick} value={tick} className="bg-panel font-mono">
            {formatTick(tick)}
          </option>
        ))}
      </select>
      <Chevron />
    </label>
  );
}

function CoinSelect({
  value,
  onChange,
}: {
  value: Coin;
  onChange: (coin: Coin) => void;
}) {
  return (
    <label className="relative inline-flex items-center gap-2 text-[15px] text-text">
      <span className="text-[12px] uppercase tracking-wide text-text">
        Symbol
      </span>
      <CoinIcon coin={value} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Coin)}
        className="appearance-none bg-transparent pr-6 cursor-pointer focus:outline-none font-medium"
      >
        {COINS.map((c) => (
          <option key={c} value={c} className="bg-panel">
            {c}
          </option>
        ))}
      </select>
      <Chevron />
    </label>
  );
}

const COIN_ICON_URL: Record<Coin, string> = {
  BTC: "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png",
  ETH: "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/eth.png",
};

function CoinIcon({ coin }: { coin: Coin }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={COIN_ICON_URL[coin]}
      alt=""
      aria-hidden="true"
      width={18}
      height={18}
      className="w-[18px] h-[18px] shrink-0"
    />
  );
}

function StatusDot({
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

// memo'd with flat primitive props so unchanged rows skip render between WS
// frames. The parent's row object reference is new each frame, so passing
// `row={...}` would defeat shallow comparison.
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
  const priceColor = side === "ask" ? "text-ask" : "text-bid";
  const weight = emphasized ? "font-medium" : "";

  const cellRef = useRef<HTMLDivElement>(null);
  const prevSzRef = useRef<string>(sz);
  const prevTickTsRef = useRef<number | null>(tick?.ts ?? null);
  useEffect(() => {
    const szChanged = prevSzRef.current !== sz;
    const tickFired = tick !== null && prevTickTsRef.current !== tick.ts;
    prevSzRef.current = sz;
    prevTickTsRef.current = tick?.ts ?? null;
    if (!szChanged && !tickFired) return;
    const el = cellRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const flashColor =
      side === "ask" ? "rgba(237, 88, 116, 0.35)" : "rgba(77, 214, 184, 0.35)";
    el.animate(
      [{ backgroundColor: flashColor }, { backgroundColor: "rgba(0,0,0,0)" }],
      { duration: 420, easing: "ease-out" },
    );
  }, [sz, tick, side]);

  return (
    <div
      ref={cellRef}
      role="row"
      className="relative grid grid-cols-[1fr_1fr_1fr] items-center gap-2 px-3 h-[26px] text-[13px] hover:bg-white/[0.03] transition-colors"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 right-0 ${fill}`}
        style={{ width: `${ratio * 100}%` }}
      />
      <span className={`relative ${priceColor} ${weight} font-mono flex items-center gap-1`}>
        {formatPrice(px)}
        {tick && (
          <span
            key={tick.ts}
            aria-hidden="true"
            className={`text-[9px] leading-none ${tick.dir === "up" ? "text-bid" : "text-ask"}`}
            style={{ animation: "tick-fade 1.5s forwards" }}
          >
            {tick.dir === "up" ? "▲" : "▼"}
          </span>
        )}
      </span>
      <span className={`relative text-right text-text ${weight} font-mono`}>
        {formatSize(sz, sizeDecimals)}
      </span>
      <span className={`relative text-right text-text ${weight} font-mono`}>
        {formatSize(total, sizeDecimals)}
      </span>
    </div>
  );
});

const SkeletonRow = memo(function SkeletonRow() {
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
  // Brighter default colors (high baseline opacity) + a CSS `brightness`
  // filter that ramps the dominant side past 1.0 toward a washed-bright
  // tint. The opposite side holds at brightness(1) — never dimmed. Using a
  // filter (rather than further opacity) lets the visual scaling stay
  // perceptible even though the baseline is already bright.
  const BASE = 1;
  const PEAK = 1.4;
  const bidBrightness = BASE + (PEAK - BASE) * Math.max(0, (bidShare - 0.5) * 2);
  const askBrightness = BASE + (PEAK - BASE) * Math.max(0, (0.5 - bidShare) * 2);
  return (
    <div
      role="row"
      aria-label="Spread"
      className="relative grid grid-cols-[1fr_1fr_1fr] items-center gap-2 px-3 h-[28px] text-[12px] text-muted border-t border-line"
    >
      <span className="text-center">Spread</span>
      <span className="text-right font-mono">
        {spread > 0 ? formatPrice(spread) : "—"}
      </span>
      <span className="text-right font-mono">{pct}</span>
      {/* Imbalance: width of bid (left) vs ask (right) reflects depth balance
          across the visible levels. Replaces the bottom border. */}
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

function Chevron() {
  return (
    <ChevronDown
      aria-hidden="true"
      strokeWidth={1.75}
      className="absolute right-0 w-4 h-4 text-text pointer-events-none"
    />
  );
}

function useIsStale(lastMessageAt: number | null, thresholdMs: number): boolean {
  const [isStale, setIsStale] = useState(false);
  // Stash the latest timestamp in a ref so the interval doesn't churn on every
  // WS frame (lastMessageAt updates many times per second).
  const lastRef = useRef(lastMessageAt);
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
