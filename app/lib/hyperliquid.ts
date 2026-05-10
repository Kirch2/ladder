export const HYPERLIQUID_WS_URL = "wss://api.hyperliquid.xyz/ws";

export type Coin = "BTC" | "ETH";
export type NSigFigs = 2 | 3 | 4 | 5 | null;

export const COINS: Coin[] = ["BTC", "ETH"];
export const N_SIG_FIGS_OPTIONS: NSigFigs[] = [null, 5, 4, 3, 2];

/** Display precision for the size column, per asset, matching hyperliquid.xyz. */
export const SIZE_DECIMALS: Record<Coin, number> = { BTC: 5, ETH: 4 };

/** Native tick used when nSigFigs is null ("Full" precision). */
export const NATIVE_TICK: Record<Coin, number> = { BTC: 1, ETH: 0.1 };

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
