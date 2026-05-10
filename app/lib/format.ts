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

/** Size formatter — keeps 5 fractional digits like the reference UI. */
export function formatSize(value: string | number): string {
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  });
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
