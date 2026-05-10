"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  COINS,
  N_SIG_FIGS_OPTIONS,
  type Coin,
  type ConnectionState,
  type NSigFigs,
  type RawLevel,
} from "@/app/lib/hyperliquid";
import { formatPrice, formatSize, formatSpreadPercent } from "@/app/lib/format";
import { useOrderBook } from "@/app/hooks/use-order-book";

const ROWS_PER_SIDE = 12;

type SizeUnit = "BTC" | "ETH" | "USD";

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
  const [sizeAsUsd, setSizeAsUsd] = useState(false);

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

  // Reverse asks so the best ask sits immediately above the spread row.
  const askDisplay = useMemo(() => [...askRows].reverse(), [askRows]);

  const baseUnit: SizeUnit = coin;
  const sizeUnit: SizeUnit = sizeAsUsd ? "USD" : baseUnit;

  return (
    <section
      aria-label={`${coin}-USD order book`}
      className="w-full max-w-[400px] rounded-2xl border border-line bg-panel overflow-hidden font-sans"
    >
      <Header
        coin={coin}
        onCoinChange={setCoin}
        connectionState={connectionState}
        lastMessageAt={lastMessageAt}
      />

      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted">
        <span>Price</span>
        <span className="text-right">Size ({sizeUnit})</span>
        <span className="text-right">Total ({sizeUnit})</span>
      </div>

      <div role="rowgroup" aria-label="Asks">
        {askDisplay.map((row) => (
          <BookRow
            key={`ask-${row.px}`}
            side="ask"
            row={row}
            maxTotal={maxTotal}
            mid={mid}
            sizeAsUsd={sizeAsUsd}
          />
        ))}
      </div>

      <SpreadRow
        spread={spread}
        mid={mid}
        sample={asks[0]?.sz ?? bids[0]?.sz ?? "—"}
      />

      <div role="rowgroup" aria-label="Bids">
        {bidRows.map((row) => (
          <BookRow
            key={`bid-${row.px}`}
            side="bid"
            row={row}
            maxTotal={maxTotal}
            mid={mid}
            sizeAsUsd={sizeAsUsd}
          />
        ))}
      </div>

      <BottomControls
        nSigFigs={nSigFigs}
        onNSigFigsChange={setNSigFigs}
        sizeAsUsd={sizeAsUsd}
        onSizeAsUsdChange={setSizeAsUsd}
        baseUnit={baseUnit}
      />
    </section>
  );
}

// ─── Header ────────────────────────────────────────────────────────────

function Header({
  coin,
  onCoinChange,
  connectionState,
  lastMessageAt,
}: {
  coin: Coin;
  onCoinChange: (coin: Coin) => void;
  connectionState: ConnectionState;
  lastMessageAt: number | null;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-3 border-b border-line">
      <CoinIcon coin={coin} />
      <div className="flex-1 min-w-0">
        <CoinSelect value={coin} onChange={onCoinChange} />
        <div className="text-[10px] text-muted leading-tight mt-0.5">Perpetual</div>
      </div>
      <ConnectionPill state={connectionState} lastMessageAt={lastMessageAt} />
    </div>
  );
}

function CoinIcon({ coin }: { coin: Coin }) {
  const palette =
    coin === "BTC"
      ? "bg-[radial-gradient(circle_at_30%_25%,#fbbf24,#f97316)]"
      : "bg-[radial-gradient(circle_at_30%_25%,#a5b4fc,#6366f1)]";
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center w-8 h-8 rounded-full text-[14px] font-bold text-white shadow-inner ${palette}`}
    >
      {coin === "BTC" ? "₿" : "Ξ"}
    </span>
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
    <label className="block">
      <span className="sr-only">Symbol</span>
      <div className="relative inline-flex items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as Coin)}
          className="appearance-none bg-transparent text-sm font-bold text-text pr-4 cursor-pointer focus:outline-none"
        >
          {COINS.map((c) => (
            <option key={c} value={c} className="bg-panel">
              {c}-USD
            </option>
          ))}
        </select>
        <Chevron />
      </div>
    </label>
  );
}

function ConnectionPill({
  state,
  lastMessageAt,
}: {
  state: ConnectionState;
  lastMessageAt: number | null;
}) {
  const isStale = useIsStale(lastMessageAt, 5000);
  const display: ConnectionState | "stale" =
    state === "live" && isStale ? "stale" : state;

  const styles: Record<typeof display, string> = {
    live: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
    connecting: "bg-amber-400/10 text-amber-300 border-amber-400/30",
    stale: "bg-amber-400/10 text-amber-300 border-amber-400/30",
    error: "bg-rose-400/10 text-rose-300 border-rose-400/30",
  };
  const label =
    display === "live"
      ? "Live"
      : display === "connecting"
        ? "Connecting"
        : display === "stale"
          ? "Stale"
          : "Error";

  return (
    <span
      className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full border text-[10px] font-bold uppercase tracking-wide ${styles[display]}`}
    >
      {display === "live" ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" /> : null}
      {label}
    </span>
  );
}

// ─── Rows ──────────────────────────────────────────────────────────────

function BookRow({
  side,
  row,
  maxTotal,
  mid,
  sizeAsUsd,
}: {
  side: "ask" | "bid";
  row: LevelRow;
  maxTotal: number;
  mid: number;
  sizeAsUsd: boolean;
}) {
  const ratio = Math.max(0.04, row.total / maxTotal);
  const fill = side === "ask" ? "bg-ask-fill" : "bg-bid-fill";
  const priceColor = side === "ask" ? "text-ask" : "text-bid";

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
    el.animate(
      [{ backgroundColor: side === "ask" ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.35)" }, { backgroundColor: "rgba(0,0,0,0)" }],
      { duration: 420, easing: "ease-out" },
    );
  }, [row.sz, side]);

  const sizeNum = Number(row.sz);
  const totalNum = row.total;
  const sizeDisplay = sizeAsUsd ? formatPrice(sizeNum * mid) : formatSize(sizeNum);
  const totalDisplay = sizeAsUsd ? formatPrice(totalNum * mid) : formatSize(totalNum);

  return (
    <div
      ref={cellRef}
      role="row"
      className="relative grid grid-cols-[1fr_1fr_1fr] items-center gap-2 px-3 h-[22px] text-[12px]"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 right-0 ${fill}`}
        style={{ width: `${ratio * 100}%` }}
      />
      <span className={`relative ${priceColor} font-mono`}>{formatPrice(row.px)}</span>
      <span className="relative text-right text-text/80 font-mono">{sizeDisplay}</span>
      <span className="relative text-right text-text/80 font-mono">{totalDisplay}</span>
    </div>
  );
}

function SpreadRow({
  spread,
  mid,
  sample,
}: {
  spread: number;
  mid: number;
  sample: string;
}) {
  const pct = formatSpreadPercent(spread, mid);
  return (
    <div
      role="row"
      aria-label="Spread"
      className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 px-3 h-[26px] text-[11px] text-muted border-y border-line bg-panel-2/40"
    >
      <span className="uppercase tracking-wide">Spread</span>
      <span className="text-right font-mono">{spread > 0 ? formatPrice(spread) : formatSize(sample)}</span>
      <span className="text-right font-mono">{pct}</span>
    </div>
  );
}

// ─── Bottom controls ───────────────────────────────────────────────────

function BottomControls({
  nSigFigs,
  onNSigFigsChange,
  sizeAsUsd,
  onSizeAsUsdChange,
  baseUnit,
}: {
  nSigFigs: NSigFigs;
  onNSigFigsChange: (value: NSigFigs) => void;
  sizeAsUsd: boolean;
  onSizeAsUsdChange: (value: boolean) => void;
  baseUnit: Coin;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-line">
      <label className="inline-flex items-center gap-1 text-[11px] text-muted">
        <span className="sr-only">Significant figures</span>
        <div className="relative inline-flex items-center">
          <select
            value={nSigFigs ?? "full"}
            onChange={(e) => {
              const v = e.target.value;
              onNSigFigsChange(v === "full" ? null : (Number(v) as NSigFigs));
            }}
            className="appearance-none bg-transparent pr-4 text-text cursor-pointer focus:outline-none"
            aria-label="Price precision"
          >
            {N_SIG_FIGS_OPTIONS.map((option) => (
              <option key={option ?? "full"} value={option ?? "full"} className="bg-panel">
                {option === null ? "Full" : option}
              </option>
            ))}
          </select>
          <Chevron />
        </div>
      </label>
      <SizeUnitToggle
        sizeAsUsd={sizeAsUsd}
        onChange={onSizeAsUsdChange}
        baseUnit={baseUnit}
      />
    </div>
  );
}

function SizeUnitToggle({
  sizeAsUsd,
  onChange,
  baseUnit,
}: {
  sizeAsUsd: boolean;
  onChange: (value: boolean) => void;
  baseUnit: Coin;
}) {
  const segment = "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide cursor-pointer";
  return (
    <div className="inline-flex items-center text-muted">
      <button
        type="button"
        aria-pressed={sizeAsUsd}
        className={`${segment} ${sizeAsUsd ? "bg-panel-2 text-text" : "hover:text-text/80"}`}
        onClick={() => onChange(true)}
      >
        USD
      </button>
      <button
        type="button"
        aria-pressed={!sizeAsUsd}
        className={`${segment} ${!sizeAsUsd ? "bg-panel-2 text-text" : "hover:text-text/80"}`}
        onClick={() => onChange(false)}
      >
        {baseUnit}
      </button>
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
