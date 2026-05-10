"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  COINS,
  NATIVE_TICK,
  N_SIG_FIGS_OPTIONS,
  SIZE_DECIMALS,
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
  const tick = tickFromSigFigs(mid || bestAsk || bestBid, nSigFigs, NATIVE_TICK[coin]);

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
        onNSigFigsChange={setNSigFigs}
        tick={tick}
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

      <div role="rowgroup" aria-label="Asks" className="space-y-px">
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

      <div role="rowgroup" aria-label="Bids" className="space-y-px">
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
  onNSigFigsChange,
  tick,
  connectionState,
  lastMessageAt,
}: {
  coin: Coin;
  onCoinChange: (coin: Coin) => void;
  nSigFigs: NSigFigs;
  onNSigFigsChange: (value: NSigFigs) => void;
  tick: number;
  connectionState: ConnectionState;
  lastMessageAt: number | null;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-line">
      <PrecisionSelect value={nSigFigs} onChange={onNSigFigsChange} tick={tick} />
      <div className="flex items-center gap-2">
        <StatusDot state={connectionState} lastMessageAt={lastMessageAt} />
        <CoinSelect value={coin} onChange={onCoinChange} />
      </div>
    </div>
  );
}

function PrecisionSelect({
  value,
  onChange,
  tick,
}: {
  value: NSigFigs;
  onChange: (value: NSigFigs) => void;
  tick: number;
}) {
  return (
    <label className="relative inline-flex items-center text-[13px] text-text">
      <span className="sr-only">Price precision</span>
      <select
        value={value ?? "full"}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "full" ? null : (Number(v) as NSigFigs));
        }}
        className="appearance-none bg-transparent pr-4 cursor-pointer focus:outline-none font-mono"
      >
        {N_SIG_FIGS_OPTIONS.map((option) => (
          <option key={option ?? "full"} value={option ?? "full"} className="bg-panel font-mono">
            {option === null ? "Full" : labelForOption(option, tick, value)}
          </option>
        ))}
      </select>
      <Chevron />
    </label>
  );
}

/**
 * The dropdown shows the tick value for the *currently selected* option live,
 * but other options still need a stable label. We compute each option's tick
 * relative to the currently visible price level so the trailing options remain
 * meaningful even when scrolled.
 */
function labelForOption(option: NSigFigs, currentTick: number, currentValue: NSigFigs): string {
  if (option === currentValue) return formatTick(currentTick);
  if (option === null || currentValue === null) return option === null ? "Full" : `${option}`;
  // Each step of nSigFigs scales the tick by 10×.
  const scale = Math.pow(10, currentValue - option);
  return formatTick(currentTick * scale);
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
  const hasData = mid > 0;
  return (
    <div
      role="row"
      aria-label="Spread"
      className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 px-3 h-[32px] text-[12px] text-muted border-y border-line"
    >
      <span className="font-mono text-text text-[15px] font-medium">
        {hasData ? formatPrice(mid) : "—"}
      </span>
      <span className="text-right font-mono">
        {hasData && spread > 0 ? formatPrice(spread) : "—"}
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
