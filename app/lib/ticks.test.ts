import { describe, expect, it } from "vitest";
import { availableTicksForCoin } from "./ticks";

describe("availableTicksForCoin", () => {
  it("returns the unfiltered list when no price is available yet", () => {
    expect(availableTicksForCoin("BTC", 0)).toEqual([1, 10, 100, 1000]);
    expect(availableTicksForCoin("ETH", 0)).toEqual([0.1, 1, 10, 100]);
  });
  it("returns the full BTC list at ~$42k", () => {
    expect(availableTicksForCoin("BTC", 42_000)).toEqual([1, 10, 100, 1000]);
  });
  it("drops unreachable ticks for BTC at $100k", () => {
    // tick=1 would need nSigFigs=6 at this price (unsupported), so it's gone.
    expect(availableTicksForCoin("BTC", 100_000)).toEqual([10, 100, 1000]);
  });
  it("returns the full ETH list at ~$4k", () => {
    expect(availableTicksForCoin("ETH", 4_000)).toEqual([0.1, 1, 10, 100]);
  });
  it("drops the largest ETH tick when price is too small", () => {
    // tick=100 at $400 would need nSigFigs=1 (unsupported).
    expect(availableTicksForCoin("ETH", 400)).toEqual([0.1, 1, 10]);
  });
});
