import type { NSigFigs, RawLevel } from "./hyperliquid";

export type LevelRow = {
  px: string;
  sz: string;
  /** Cumulative size from the best level through this one. */
  total: number;
};

/** Slice + accumulate sizes into a stable row shape for rendering. */
export function buildRows(levels: RawLevel[], rows: number): LevelRow[] {
  let total = 0;
  return levels.slice(0, rows).map((level) => {
    total += Number(level.sz) || 0;
    return { px: level.px, sz: level.sz, total };
  });
}

/**
 * Decimal places shrink as the magnitude grows, so $105,533 reads as "105,533"
 * and $0.00151 keeps its 5-place tail.
 */
export function formatPrice(value: string | number): string {
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "—";

  const abs = Math.abs(num);
  const decimals =
    abs >= 1000 ? 0
    : abs >= 100 ? 1
    : abs >= 10 ? 2
    : abs >= 1 ? 3
    : abs >= 0.01 ? 5
    : 6;

  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatSize(value: string | number, decimals: number): string {
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** 5 sig figs of $42,000 → tick $1; 4 sig figs → $10; and so on. */
export function tickFromSigFigs(refPrice: number, nSigFigs: NSigFigs): number {
  if (!Number.isFinite(refPrice) || refPrice <= 0) return 0;
  return Math.pow(10, Math.floor(Math.log10(refPrice)) - nSigFigs + 1);
}

/** Returns null if the tick isn't a power of 10 reachable within nSigFigs ∈ {2..5}. */
export function sigFigsFromTick(tick: number, refPrice: number): NSigFigs | null {
  if (!Number.isFinite(refPrice) || refPrice <= 0) return null;
  const baseExp = Math.floor(Math.log10(refPrice));
  for (const n of [5, 4, 3, 2] as const) {
    const candidate = Math.pow(10, baseExp - n + 1);
    if (Math.abs(candidate - tick) <= tick * 1e-9) return n;
  }
  return null;
}

export function formatTick(tick: number): string {
  if (!Number.isFinite(tick) || tick <= 0) return "—";
  if (tick >= 1) return tick.toLocaleString("en-US");
  // Strip trailing zeros from sub-unit ticks: 0.001 not 0.00100.
  return tick.toString();
}

export function formatSpreadPercent(spread: number, mid: number): string {
  if (!Number.isFinite(spread) || !Number.isFinite(mid) || mid <= 0) return "—";
  return `${((spread / mid) * 100).toFixed(3)}%`;
}
