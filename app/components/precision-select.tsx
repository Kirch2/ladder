"use client";

import type { Coin, NSigFigs } from "@/app/lib/hyperliquid";
import { formatTick, tickFromSigFigs } from "@/app/lib/format";
import { availableTicksForCoin } from "@/app/lib/ticks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/app/components/ui/select";

/**
 * Tick-size selector. Owns the translation between displayed tick prices
 * and the `nSigFigs` value Hyperliquid actually accepts on the subscription.
 * The per-coin tick list is filtered to whatever the API can serve at the
 * current reference price.
 */
export function PrecisionSelect({
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
  const availableTicks = availableTicksForCoin(coin, referencePrice);

  const currentTick =
    referencePrice > 0 ? tickFromSigFigs(referencePrice, nSigFigs) : null;
  // Keep the Select controlled throughout its lifetime — before the first WS
  // frame arrives we don't have a real tick yet, so fall back to the first
  // available option so `value` is always a defined string.
  const selectValue = String(currentTick ?? availableTicks[0] ?? "");

  // Before the first WS frame arrives we can't translate a user's pick to
  // (nSigFigs) — `sigFigsFromTick` needs a real price. Disable the trigger
  // until we have one so a click in that window doesn't silently no-op.
  const disabled = referencePrice <= 0;

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => onTickChange(Number(v))}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label="Tick precision"
        className="select-none text-[15px] text-text font-mono disabled:opacity-50 disabled:cursor-not-allowed data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
      >
        <span className="text-[12px] uppercase tracking-wide text-text font-sans">
          Tick
        </span>
        <span>{currentTick !== null ? formatTick(currentTick) : "—"}</span>
        <span className="text-[12px] uppercase tracking-wide text-muted font-sans">
          USD
        </span>
      </SelectTrigger>
      <SelectContent>
        {availableTicks.map((tick) => (
          <SelectItem
            key={tick}
            value={String(tick)}
            className="font-mono text-[14px]"
          >
            <span className="inline-flex items-center gap-1">
              {formatTick(tick)}
              <span className="text-[11px] uppercase tracking-wide text-muted font-sans">
                USD
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
