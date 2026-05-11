"use client";

import { memo } from "react";
import type { Coin } from "@/app/lib/hyperliquid";

/**
 * 18×18 mark for a supported coin. Inline SVG so the icons stay crisp at
 * any DPI and ship in-bundle (no external fetch).
 */
export function CoinIcon({ coin }: { coin: Coin }) {
  return coin === "BTC" ? <BtcIcon /> : <EthIcon />;
}

const BtcIcon = memo(function BtcIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="w-[18px] h-[18px] shrink-0"
    >
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <path
        fill="#fff"
        d="M22.638 14.001c.318-2.124-1.3-3.265-3.512-4.027l.717-2.876-1.751-.436-.698 2.8c-.46-.115-.933-.224-1.403-.331l.703-2.817-1.75-.436-.717 2.875c-.382-.087-.756-.173-1.12-.263l.002-.009-2.413-.603-.466 1.87s1.298.298 1.27.316c.708.177.836.645.815 1.017l-.815 3.27c.049.013.111.03.18.058l-.183-.045-1.142 4.581c-.087.215-.306.537-.8.416.018.026-1.272-.317-1.272-.317l-.869 2.005 2.277.568c.423.106.838.217 1.247.322l-.725 2.91 1.749.436.717-2.876c.477.13.94.249 1.394.362l-.715 2.864 1.751.436.725-2.905c2.987.566 5.232.338 6.177-2.365.762-2.176-.038-3.432-1.61-4.252 1.144-.264 2.005-1.017 2.235-2.572zM18.78 18.95c-.541 2.176-4.205.999-5.394.704l.961-3.853c1.189.297 4.999.886 4.433 3.149zM19.32 13.97c-.494 1.979-3.544.973-4.534.726l.871-3.495c.99.247 4.18.707 3.663 2.769z"
      />
    </svg>
  );
});

const EthIcon = memo(function EthIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="w-[18px] h-[18px] shrink-0"
    >
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <g fill="#fff" fillRule="evenodd">
        <path fillOpacity=".6" d="M16.498 4v8.87l7.497 3.35z" />
        <path d="M16.498 4L9 16.22l7.498-3.35z" />
        <path fillOpacity=".6" d="M16.498 21.968v6.027L24 17.616z" />
        <path d="M16.498 27.995v-6.028L9 17.616z" />
        <path fillOpacity=".2" d="M16.498 20.573l7.497-4.353-7.497-3.348z" />
        <path fillOpacity=".6" d="M9 16.22l7.498 4.353v-7.701z" />
      </g>
    </svg>
  );
});
