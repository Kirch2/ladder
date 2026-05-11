import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useInsideTick } from "./use-inside-tick";

describe("useInsideTick", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null until the price changes from a non-zero baseline", () => {
    const { result, rerender } = renderHook(
      ({ price, key }: { price: number; key: string }) =>
        useInsideTick(price, key),
      { initialProps: { price: 0, key: "BTC" } },
    );
    expect(result.current).toBeNull();

    // First non-zero price establishes a baseline but doesn't fire a tick.
    rerender({ price: 100, key: "BTC" });
    expect(result.current).toBeNull();
  });

  it("fires an 'up' tick when price increases", () => {
    const { result, rerender } = renderHook(
      ({ price }: { price: number }) => useInsideTick(price, "BTC"),
      { initialProps: { price: 100 } },
    );
    rerender({ price: 101 });
    expect(result.current?.dir).toBe("up");
  });

  it("fires a 'down' tick when price decreases", () => {
    const { result, rerender } = renderHook(
      ({ price }: { price: number }) => useInsideTick(price, "BTC"),
      { initialProps: { price: 100 } },
    );
    rerender({ price: 99 });
    expect(result.current?.dir).toBe("down");
  });

  it("auto-clears after holdMs", () => {
    const { result, rerender } = renderHook(
      ({ price }: { price: number }) => useInsideTick(price, "BTC", 1500),
      { initialProps: { price: 100 } },
    );
    rerender({ price: 101 });
    expect(result.current).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current).toBeNull();
  });

  it("clears the tick and discards the prior baseline when resetKey changes", () => {
    const { result, rerender } = renderHook(
      ({ price, key }: { price: number; key: string }) =>
        useInsideTick(price, key),
      { initialProps: { price: 100, key: "BTC" } },
    );
    rerender({ price: 101, key: "BTC" });
    expect(result.current).not.toBeNull();

    // Coin switch: tick clears, the new price (4000) establishes a fresh
    // baseline. No tick fires on the switch itself.
    rerender({ price: 4000, key: "ETH" });
    expect(result.current).toBeNull();

    // Next real change in the new market does fire — baseline is now 4000.
    rerender({ price: 4001, key: "ETH" });
    expect(result.current?.dir).toBe("up");

    // And critically, it's NOT comparing against the BTC baseline (101);
    // a hop from 4001→4000 should read as "down", not "up".
    rerender({ price: 4000, key: "ETH" });
    expect(result.current?.dir).toBe("down");
  });
});
