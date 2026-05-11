"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  COINS,
  SIZE_DECIMALS,
  TICK_OPTIONS_BY_COIN,
  type Coin,
  type ConnectionState,
  type NSigFigs,
  type RawLevel,
} from "@/app/lib/hyperliquid";
import {
  formatPrice,
  formatSize,
  formatSpreadPercent,
  formatTick,
  sigFigsFromTick,
  tickFromSigFigs,
} from "@/app/lib/format";
import { useOrderBook } from "@/app/hooks/use-order-book";

const ROWS_PER_SIDE = 12;

type LevelRow = {
  px: string;
  sz: string;
  /** Cumulative size on this side from the best level through this one. */
  total: number;
};

function buildRows(levels: RawLevel[], rows: number): LevelRow[] {
  const slice = levels.slice(0, rows);
  let total = 0;
  return slice.map((level) => {
    total += Number(level.sz);
    return { px: level.px, sz: level.sz, total };
  });
}

export function OrderBook() {
  const [coin, setCoin] = useState<Coin>("BTC");
  const [nSigFigs, setNSigFigs] = useState<NSigFigs>(5);

  const { bids, asks, connectionState, lastMessageAt } = useOrderBook(
    coin,
    nSigFigs,
  );

  const askRows = useMemo(() => buildRows(asks, ROWS_PER_SIDE), [asks]);
  const bidRows = useMemo(() => buildRows(bids, ROWS_PER_SIDE), [bids]);

  const maxTotal = Math.max(
    askRows.at(-1)?.total ?? 0,
    bidRows.at(-1)?.total ?? 0,
    1,
  );

  const bestAsk = Number(asks[0]?.px ?? "0");
  const bestBid = Number(bids[0]?.px ?? "0");
  const mid = bestAsk > 0 && bestBid > 0 ? (bestAsk + bestBid) / 2 : 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
  const referencePrice = mid || bestAsk || bestBid;

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
  const askDisplay = useMemo(() => [...askRows].reverse(), [askRows]);

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

      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-1.5 text-[12px] text-muted-2">
        <span>Price</span>
        <span className="text-right">Size ({coin})</span>
        <span className="text-right">Total ({coin})</span>
      </div>

      <div role="rowgroup" aria-label="Asks" className="space-y-0.5">
        {askDisplay.length === 0
          ? Array.from({ length: ROWS_PER_SIDE }, (_, i) => (
              <SkeletonRow key={`ask-skel-${i}`} />
            ))
          : askDisplay.map((row, i) => (
              <BookRow
                key={`ask-${row.px}`}
                side="ask"
                row={row}
                maxTotal={maxTotal}
                sizeDecimals={sizeDecimals}
                emphasized={i === askDisplay.length - 1}
              />
            ))}
      </div>

      <SpreadRow spread={spread} mid={mid} />

      <div role="rowgroup" aria-label="Bids" className="space-y-0.5">
        {bidRows.length === 0
          ? Array.from({ length: ROWS_PER_SIDE }, (_, i) => (
              <SkeletonRow key={`bid-skel-${i}`} />
            ))
          : bidRows.map((row, i) => (
              <BookRow
                key={`bid-${row.px}`}
                side="bid"
                row={row}
                maxTotal={maxTotal}
                sizeDecimals={sizeDecimals}
                emphasized={i === 0}
              />
            ))}
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
    <div className="flex items-center justify-between px-4 py-3 border-b border-line">
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
  const availableTicks = useMemo(() => {
    if (referencePrice <= 0) return [...wanted];
    return wanted.filter((t) => sigFigsFromTick(t, referencePrice) !== null);
  }, [referencePrice, wanted]);

  const currentTick = referencePrice > 0
    ? tickFromSigFigs(referencePrice, nSigFigs)
    : null;

  return (
    <label className="relative inline-flex items-center text-[14px] text-text">
      <span className="sr-only">Price precision</span>
      <select
        value={currentTick ?? ""}
        onChange={(e) => onTickChange(Number(e.target.value))}
        className="appearance-none bg-transparent pr-5 cursor-pointer focus:outline-none font-mono"
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
    <label className="relative inline-flex items-center gap-2 text-[14px] text-text">
      <span className="sr-only">Symbol</span>
      <CoinIcon coin={value} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Coin)}
        className="appearance-none bg-transparent pr-5 cursor-pointer focus:outline-none font-medium"
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

function CoinIcon({ coin }: { coin: Coin }) {
  return coin === "BTC" ? <BtcIcon /> : <EthIcon />;
}

function BtcIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="w-[18px] h-[18px] shrink-0"
    >
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <path
        fill="#fff"
        d="M22.638 14.001c.318-2.124-1.3-3.265-3.512-4.027l.717-2.876-1.751-.436-.698 2.8c-.46-.115-.933-.224-1.403-.331l.703-2.817-1.75-.436-.717 2.875c-.382-.087-.756-.173-1.12-.263l.002-.009-2.413-.603-.466 1.87s1.298.298 1.27.316c.708.177.836.645.815 1.017l-.815 3.27c.049.013.111.03.18.058l-.183-.045-1.142 4.581c-.087.215-.306.537-.8.416.018.026-1.272-.317-1.272-.317l-.869 2.005 2.277.568c.423.106.838.217 1.247.322l-.725 2.91 1.749.436.717-2.876c.477.13.94.249 1.394.362l-.715 2.864 1.751.436.725-2.905c2.987.566 5.232.338 6.177-2.365.762-2.176-.038-3.432-1.61-4.252 1.144-.264 2.005-1.017 2.235-2.572zM18.78 18.95c-.541 2.176-4.205.999-5.394.704l.961-3.853c1.189.297 4.999.886 4.433 3.149zM19.32 13.97c-.494 1.979-3.544.973-4.534.726l.871-3.495c.99.247 4.18.707 3.663 2.769z"
      />
    </svg>
  );
}

function EthIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="w-[18px] h-[18px] shrink-0"
    >
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <g fill="#fff" fillRule="evenodd">
        <path fillOpacity=".6" d="M16.498 4v8.87l7.497 3.35z" />
        <path d="M16.498 4L9 16.22l7.498-3.35z" />
        <path fillOpacity=".6" d="M16.498 21.968v6.027L24 17.616z" />
        <path d="M16.498 27.995v-6.028L9 17.616z" />
        <path fillOpacity=".2" d="M16.498 20.573l7.497-4.353-7.497-3.348z" />
        <path fillOpacity=".6" d="M9 16.22l7.498 4.353v-7.701z" />
      </g>
    </svg>
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
      className={`w-1.5 h-1.5 rounded-full ${color[display]} ${display === "live" ? "animate-pulse" : ""}`}
    />
  );
}

function BookRow({
  side,
  row,
  maxTotal,
  sizeDecimals,
  emphasized = false,
}: {
  side: "ask" | "bid";
  row: LevelRow;
  maxTotal: number;
  sizeDecimals: number;
  emphasized?: boolean;
}) {
  const ratio = Math.max(0.04, row.total / maxTotal);
  const fill = side === "ask" ? "bg-ask-fill" : "bg-bid-fill";
  const priceColor = side === "ask" ? "text-ask" : "text-bid";
  const weight = emphasized ? "font-medium" : "";

  const cellRef = useRef<HTMLDivElement>(null);
  // Seed prev with the current size so the first effect run (mount) doesn't flash.
  const prevSizeRef = useRef<string>(row.sz);
  useEffect(() => {
    if (prevSizeRef.current === row.sz) return;
    prevSizeRef.current = row.sz;
    const el = cellRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const flashColor =
      side === "ask" ? "rgba(237, 88, 116, 0.35)" : "rgba(77, 214, 184, 0.35)";
    el.animate(
      [{ backgroundColor: flashColor }, { backgroundColor: "rgba(0,0,0,0)" }],
      { duration: 420, easing: "ease-out" },
    );
  }, [row.sz, side]);

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
      <span className={`relative ${priceColor} ${weight} font-mono`}>{formatPrice(row.px)}</span>
      <span className={`relative text-right text-text ${weight} font-mono`}>
        {formatSize(row.sz, sizeDecimals)}
      </span>
      <span className={`relative text-right text-text ${weight} font-mono`}>
        {formatSize(row.total, sizeDecimals)}
      </span>
    </div>
  );
}

function SkeletonRow() {
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
}

function SpreadRow({ spread, mid }: { spread: number; mid: number }) {
  const pct = formatSpreadPercent(spread, mid);
  return (
    <div
      role="row"
      aria-label="Spread"
      className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 px-3 h-[28px] text-[12px] text-muted border-y border-line"
    >
      <span className="text-center">Spread</span>
      <span className="text-right font-mono">
        {spread > 0 ? formatPrice(spread) : "—"}
      </span>
      <span className="text-right font-mono">{pct}</span>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      className="absolute right-0 w-3 h-3 text-muted pointer-events-none"
      viewBox="0 0 12 12"
      fill="none"
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useIsStale(lastMessageAt: number | null, thresholdMs: number): boolean {
  const [isStale, setIsStale] = useState(false);
  useEffect(() => {
    if (lastMessageAt === null) return;
    setIsStale(false);
    const id = setInterval(() => {
      setIsStale(Date.now() - lastMessageAt > thresholdMs);
    }, 1000);
    return () => clearInterval(id);
  }, [lastMessageAt, thresholdMs]);
  return isStale;
}
