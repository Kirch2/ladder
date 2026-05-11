export const HYPERLIQUID_WS_URL = "wss://api.hyperliquid.xyz/ws";

export type Coin = "BTC" | "ETH";
export type NSigFigs = 2 | 3 | 4 | 5;
export type Mantissa = 1 | 2 | 5;

export const COINS: Coin[] = ["BTC", "ETH"];

/** Tick values shown in the precision dropdown, per coin — matches the lists
 * hyperliquid.xyz surfaces for each asset. Filtered at runtime to whatever the
 * API can actually serve at the current reference price. */
export const TICK_OPTIONS_BY_COIN: Record<Coin, readonly number[]> = {
  BTC: [1, 2, 5, 10, 100, 1000],
  ETH: [0.1, 0.2, 0.5, 1, 10, 100],
};

/** Display precision for the size column, per asset, matching hyperliquid.xyz. */
export const SIZE_DECIMALS: Record<Coin, number> = { BTC: 5, ETH: 4 };

export type RawLevel = {
  /** Price as a string. Hyperliquid returns numbers as strings to preserve precision. */
  px: string;
  /** Size as a string. */
  sz: string;
  /** Number of orders aggregated at this level. */
  n: number;
};

export type L2BookSubscription = {
  type: "l2Book";
  coin: Coin;
  nSigFigs: NSigFigs;
  /** Optional mantissa multiplier (default 1). Combined with nSigFigs to reach
   * non-power-of-10 ticks like 2, 5, 20, 50. Only sent when not 1. */
  mantissa?: Mantissa;
};

export type L2BookMessage = {
  channel: "l2Book";
  data: {
    coin: Coin;
    /** Tuple of [bids, asks], each sorted best-first. */
    levels: [RawLevel[], RawLevel[]];
    time: number;
  };
};

export type ConnectionState = "connecting" | "live" | "error";
