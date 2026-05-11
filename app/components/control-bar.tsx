"use client";

import type { Coin, ConnectionState, NSigFigs } from "@/app/lib/hyperliquid";
import { CoinSelect } from "@/app/components/coin-select";
import { PrecisionSelect } from "@/app/components/precision-select";
import { StatusDot } from "@/app/components/status-dot";

/**
 * Header strip for the order book — tick precision on the left, connection
 * status dot + symbol selector on the right.
 */
export function ControlBar({
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
