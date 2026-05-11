"use client";

import { COINS, type Coin } from "@/app/lib/hyperliquid";
import { CoinIcon } from "@/app/components/coin-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/app/components/ui/select";

/**
 * Symbol selector. The trigger shows the coin icon + ticker; each option
 * in the dropdown shows the icon too so the list reads visually rather
 * than just alphabetically.
 */
export function CoinSelect({
  value,
  onChange,
}: {
  value: Coin;
  onChange: (coin: Coin) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Coin)}>
      <SelectTrigger
        aria-label="Symbol"
        className="text-[15px] text-text font-medium"
      >
        <CoinIcon coin={value} />
        <span>{value}</span>
      </SelectTrigger>
      <SelectContent>
        {COINS.map((c) => (
          <SelectItem key={c} value={c} className="text-[14px]">
            <span className="inline-flex items-center gap-2">
              <CoinIcon coin={c} />
              {c}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
