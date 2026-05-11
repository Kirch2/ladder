export const HYPERLIQUID_WS_URL = "wss://api.hyperliquid.xyz/ws";

export type Coin = "BTC" | "ETH";
export type NSigFigs = 2 | 3 | 4 | 5;

export const COINS: Coin[] = ["BTC", "ETH"];

/** Tick options surfaced per coin — powers of 10 reachable via nSigFigs ∈ {2..5}. */
export const TICK_OPTIONS_BY_COIN: Record<Coin, readonly number[]> = {
  BTC: [1, 10, 100, 1000],
  ETH: [0.1, 1, 10, 100],
};

export const SIZE_DECIMALS: Record<Coin, number> = { BTC: 5, ETH: 4 };

export type RawLevel = {
  /** Prices and sizes are strings to preserve precision across the wire. */
  px: string;
  sz: string;
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
