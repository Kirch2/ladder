import { sigFigsFromTick } from "./format";
import { TICK_OPTIONS_BY_COIN, type Coin } from "./hyperliquid";

/**
 * Per-coin tick list filtered to ticks the Hyperliquid API can actually
 * serve at the current reference price. Falls back to the unfiltered list
 * when we don't have a price yet so the dropdown stays usable on cold load.
 */
export function availableTicksForCoin(
  coin: Coin,
  referencePrice: number,
): number[] {
  const wanted = TICK_OPTIONS_BY_COIN[coin];
  if (referencePrice <= 0) return [...wanted];
  return wanted.filter((t) => sigFigsFromTick(t, referencePrice) !== null);
}
