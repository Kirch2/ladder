"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  COINS,
  SIZE_DECIMALS,
  TICK_OPTIONS,
  type Coin,
  type ConnectionState,
  type Mantissa,
  type NSigFigs,
  type RawLevel,
} from "@/app/lib/hyperliquid";
import {
  formatPrice,
  formatSize,
  formatSpreadPercent,
  formatTick,
  tickFromParams,
  tickToParams,
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
  const [mantissa, setMantissa] = useState<Mantissa>(1);

  const { bids, asks, connectionState, lastMessageAt } = useOrderBook(
    coin,
    nSigFigs,
    mantissa,
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

  const handleTickChange = (tick: number) => {
    const params = tickToParams(tick, referencePrice);
    if (!params) return;
    setNSigFigs(params.nSigFigs);
    setMantissa(params.mantissa);
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
        mantissa={mantissa}
        onTickChange={handleTickChange}
        referencePrice={referencePrice}
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

// ─── Control bar ───────────────────────────────────────────────────────

function ControlBar({
  coin,
  onCoinChange,
  nSigFigs,
  mantissa,
  onTickChange,
  referencePrice,
  connectionState,
  lastMessageAt,
}: {
  coin: Coin;
  onCoinChange: (coin: Coin) => void;
  nSigFigs: NSigFigs;
  mantissa: Mantissa;
  onTickChange: (tick: number) => void;
  referencePrice: number;
  connectionState: ConnectionState;
  lastMessageAt: number | null;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-line">
      <PrecisionSelect
        nSigFigs={nSigFigs}
        mantissa={mantissa}
        onTickChange={onTickChange}
        referencePrice={referencePrice}
      />
      <div className="flex items-center gap-2">
        <StatusDot state={connectionState} lastMessageAt={lastMessageAt} />
        <CoinSelect value={coin} onChange={onCoinChange} />
      </div>
    </div>
  );
}

function PrecisionSelect({
  nSigFigs,
  mantissa,
  onTickChange,
  referencePrice,
}: {
  nSigFigs: NSigFigs;
  mantissa: Mantissa;
  onTickChange: (tick: number) => void;
  referencePrice: number;
}) {
  // Filter the wanted ticks down to the ones the API can actually serve at the
  // current reference price. If we have no price yet, fall back to all of them
  // — the dropdown will start usable and re-render once the first frame lands.
  const availableTicks = useMemo(() => {
    if (referencePrice <= 0) return Array.from(TICK_OPTIONS);
    return TICK_OPTIONS.filter((t) => tickToParams(t, referencePrice) !== null);
  }, [referencePrice]);

  const currentTick = referencePrice > 0
    ? tickFromParams(referencePrice, nSigFigs, mantissa)
    : null;

  return (
    <label className="relative inline-flex items-center text-[13px] text-text">
      <span className="sr-only">Price precision</span>
      <select
        value={currentTick ?? ""}
        onChange={(e) => onTickChange(Number(e.target.value))}
        className="appearance-none bg-transparent pr-4 cursor-pointer focus:outline-none font-mono"
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
    <label className="relative inline-flex items-center text-[13px] text-text">
      <span className="sr-only">Symbol</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Coin)}
        className="appearance-none bg-transparent pr-4 cursor-pointer focus:outline-none font-medium"
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

// ─── Rows ──────────────────────────────────────────────────────────────

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

  // Flash when the size at this level changes.
  const cellRef = useRef<HTMLDivElement>(null);
  const prevSizeRef = useRef<string>(row.sz);
  useEffect(() => {
    if (prevSizeRef.current === row.sz) return;
    prevSizeRef.current = row.sz;
    const el = cellRef.current;
    if (!el) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
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

// ─── Bits ──────────────────────────────────────────────────────────────

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
