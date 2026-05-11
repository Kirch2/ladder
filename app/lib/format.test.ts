import { describe, expect, it } from "vitest";
import {
  buildRows,
  formatPrice,
  formatSpreadPercent,
  formatTick,
  sigFigsFromTick,
  tickFromSigFigs,
} from "./format";

describe("tickFromSigFigs", () => {
  it("5 sig figs at $42,000 → tick $1", () => {
    expect(tickFromSigFigs(42_000, 5)).toBe(1);
  });
  it("4 sig figs at $42,000 → tick $10", () => {
    expect(tickFromSigFigs(42_000, 4)).toBe(10);
  });
  it("5 sig figs at $4,200 → tick $0.1", () => {
    expect(tickFromSigFigs(4_200, 5)).toBeCloseTo(0.1);
  });
  it("returns 0 for invalid prices", () => {
    expect(tickFromSigFigs(0, 5)).toBe(0);
    expect(tickFromSigFigs(-1, 5)).toBe(0);
    expect(tickFromSigFigs(NaN, 5)).toBe(0);
  });
});

describe("sigFigsFromTick", () => {
  it("tick=1 at $42k → nSigFigs=5", () => {
    expect(sigFigsFromTick(1, 42_000)).toBe(5);
  });
  it("tick=100 at $42k → nSigFigs=3", () => {
    expect(sigFigsFromTick(100, 42_000)).toBe(3);
  });
  it("returns null when the tick isn't a reachable power of 10", () => {
    // tick=2 would need mantissa
    expect(sigFigsFromTick(2, 42_000)).toBeNull();
    // tick=10000 at $42k would need nSigFigs=1, below our supported range
    expect(sigFigsFromTick(10_000, 42_000)).toBeNull();
  });
  it("round-trips with tickFromSigFigs for every supported nSigFigs", () => {
    for (const price of [42_000, 4_200, 100_000, 999]) {
      for (const n of [2, 3, 4, 5] as const) {
        const tick = tickFromSigFigs(price, n);
        expect(sigFigsFromTick(tick, price)).toBe(n);
      }
    }
  });
  it("handles the $99,999 → $100,000 decade boundary correctly", () => {
    // Just below the decade: 5 sig figs of $99,999 → tick $1
    expect(tickFromSigFigs(99_999, 5)).toBe(1);
    expect(sigFigsFromTick(1, 99_999)).toBe(5);
    // At the decade: 5 sig figs of $100,000 → tick $10 (digits shift)
    expect(tickFromSigFigs(100_000, 5)).toBe(10);
    expect(sigFigsFromTick(10, 100_000)).toBe(5);
    // Tick=1 isn't reachable at $100,000 (would need nSigFigs=6, unsupported)
    expect(sigFigsFromTick(1, 100_000)).toBeNull();
  });
});

describe("formatPrice", () => {
  it("thousands have no decimals", () => {
    expect(formatPrice(105_533)).toBe("105,533");
  });
  it("hundreds get 1 decimal", () => {
    expect(formatPrice(500)).toBe("500.0");
  });
  it("sub-1 values get 5 decimals", () => {
    expect(formatPrice(0.5)).toBe("0.50000");
  });
  it("very small values get 6 decimals", () => {
    expect(formatPrice(0.00151)).toBe("0.001510");
  });
  it("accepts numeric strings", () => {
    expect(formatPrice("42000")).toBe("42,000");
  });
  it("renders an em-dash for non-finite input", () => {
    expect(formatPrice(NaN)).toBe("—");
    expect(formatPrice("nope")).toBe("—");
  });
});

describe("formatTick", () => {
  it("formats integer ticks with thousands separators", () => {
    expect(formatTick(1_000)).toBe("1,000");
  });
  it("strips trailing zeros from sub-unit ticks", () => {
    expect(formatTick(0.001)).toBe("0.001");
    expect(formatTick(0.1)).toBe("0.1");
  });
  it("returns em-dash for invalid ticks", () => {
    expect(formatTick(0)).toBe("—");
    expect(formatTick(NaN)).toBe("—");
  });
});

describe("formatSpreadPercent", () => {
  it("renders to 3 decimal places", () => {
    expect(formatSpreadPercent(1, 100_000)).toBe("0.001%");
  });
  it("returns em-dash when mid is zero or missing", () => {
    expect(formatSpreadPercent(0, 0)).toBe("—");
    expect(formatSpreadPercent(1, NaN)).toBe("—");
  });
});

describe("buildRows", () => {
  it("accumulates totals across rows", () => {
    const rows = buildRows(
      [
        { px: "100", sz: "1", n: 1 },
        { px: "101", sz: "2", n: 1 },
        { px: "102", sz: "3", n: 1 },
      ],
      10,
    );
    expect(rows).toEqual([
      { px: "100", sz: "1", total: 1 },
      { px: "101", sz: "2", total: 3 },
      { px: "102", sz: "3", total: 6 },
    ]);
  });
  it("slices to the requested row count", () => {
    const levels = Array.from({ length: 20 }, (_, i) => ({
      px: String(i),
      sz: "1",
      n: 1,
    }));
    expect(buildRows(levels, 5)).toHaveLength(5);
  });
  it("handles empty input", () => {
    expect(buildRows([], 10)).toEqual([]);
  });
  it("coerces non-numeric sz to 0 so totals don't go NaN", () => {
    const rows = buildRows(
      [
        { px: "1", sz: "garbage", n: 1 },
        { px: "2", sz: "3", n: 1 },
      ],
      10,
    );
    expect(rows[1]?.total).toBe(3);
  });
});
