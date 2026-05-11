"use client";

import type { Coin } from "@/app/lib/hyperliquid";

const COIN_ICON_URL: Record<Coin, string> = {
  BTC: "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png",
  ETH: "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/eth.png",
};

/**
 * 18×18 PNG mark for a supported coin, served from the public
 * spothq/cryptocurrency-icons set on GitHub. Uses a plain `<img>` rather
 * than `next/image` so we don't need a remote-image config.
 */
export function CoinIcon({ coin }: { coin: Coin }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={COIN_ICON_URL[coin]}
      alt=""
      aria-hidden="true"
      width={18}
      height={18}
      className="w-[18px] h-[18px] shrink-0"
    />
  );
}
