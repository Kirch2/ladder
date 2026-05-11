export const HYPERLIQUID_WS_URL = "wss://api.hyperliquid.xyz/ws";

export type Coin = "BTC" | "ETH";
export type NSigFigs = 2 | 3 | 4 | 5;

export const COINS: Coin[] = ["BTC", "ETH"];

/** Tick values shown in the precision dropdown, per coin. Each is a power of
 * 10 reachable via nSigFigs ∈ {2,3,4,5} at the asset's typical price range. */
export const TICK_OPTIONS_BY_COIN: Record<Coin, readonly number[]> = {
  BTC: [1, 10, 100, 1000],
  ETH: [0.1, 1, 10, 100],
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
