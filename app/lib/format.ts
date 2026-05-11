/**
 * Hyperliquid returns prices as strings with up to 5 sig figs of precision.
 * For display we want grouped thousands and trailing zeros that respect the
 * incoming precision (so 105533 reads as "105,533" but 0.00151 keeps the
 * 5-place tail).
 */
export function formatPrice(value: string | number): string {
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "—";

  const abs = Math.abs(num);
  const decimals =
    abs >= 1000
      ? 0
      : abs >= 100
        ? 1
        : abs >= 10
          ? 2
          : abs >= 1
            ? 3
            : abs >= 0.01
              ? 5
              : 6;

  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Size formatter — `decimals` defaults to 5 to match the BTC reference UI. */
export function formatSize(value: string | number, decimals = 5): string {
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

import type { Mantissa, NSigFigs } from "./hyperliquid";

/**
 * Reverse-derive (nSigFigs, mantissa) from a desired tick at a reference price.
 * Returns null if the tick isn't achievable.
 *
 * Hyperliquid constraint (verified empirically against the WS): `mantissa`
 * (2 or 5) is only accepted when `nSigFigs === 5`. Sending mantissa with any
 * other nSigFigs causes the server to close the connection with code 1006.
 * So mantissa ∈ {2, 5} is only paired with nSigFigs=5 here.
 */
export function tickToParams(
  tick: number,
  refPrice: number,
): { nSigFigs: NSigFigs; mantissa: Mantissa } | null {
  if (!Number.isFinite(refPrice) || refPrice <= 0) return null;
  const baseExp = Math.floor(Math.log10(refPrice));
  for (const nSigFigs of [5, 4, 3, 2] as const) {
    const baseTick = Math.pow(10, baseExp - nSigFigs + 1);
    for (const mantissa of [1, 2, 5] as const) {
      if (mantissa !== 1 && nSigFigs !== 5) continue;
      const candidate = mantissa * baseTick;
      if (Math.abs(candidate - tick) <= tick * 1e-9) {
        return { nSigFigs, mantissa };
      }
    }
  }
  return null;
}

/**
 * Forward: compute the tick produced by a given (nSigFigs, mantissa) at a price.
 */
export function tickFromParams(
  refPrice: number,
  nSigFigs: NSigFigs,
  mantissa: Mantissa,
): number {
  if (!Number.isFinite(refPrice) || refPrice <= 0) return mantissa;
  const baseExp = Math.floor(Math.log10(refPrice));
  return mantissa * Math.pow(10, baseExp - nSigFigs + 1);
}

export function formatTick(tick: number): string {
  if (!Number.isFinite(tick) || tick <= 0) return "—";
  if (tick >= 1) return tick.toLocaleString("en-US");
  // Strip trailing zeros from sub-unit ticks: 0.001 not 0.00100
  return tick.toString();
}

/**
 * Spread formatted as basis points relative to the mid price. Used for the
 * "3.35%" segment in the spread row — though it's actually a percentage, not
 * bps, in the reference design.
 */
export function formatSpreadPercent(spread: number, mid: number): string {
  if (!Number.isFinite(spread) || !Number.isFinite(mid) || mid <= 0) return "—";
  const pct = (spread / mid) * 100;
  return `${pct.toFixed(3)}%`;
}
