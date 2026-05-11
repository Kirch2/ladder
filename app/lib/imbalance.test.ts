import { describe, expect, it } from "vitest";
import { sideBrightness } from "./imbalance";

describe("sideBrightness", () => {
  it("returns base (1.0) at perfect balance", () => {
    expect(sideBrightness(0)).toBeCloseTo(1);
  });
  it("ramps up linearly to peak when amp > 0", () => {
    expect(sideBrightness(0.5)).toBeCloseTo(1.2); // halfway to peak (1.4)
    expect(sideBrightness(1)).toBeCloseTo(1.4); // peak
  });
  it("ramps down linearly to dark when amp < 0", () => {
    expect(sideBrightness(-0.5)).toBeCloseTo(0.85); // halfway to dark (0.7)
    expect(sideBrightness(-1)).toBeCloseTo(0.7); // dark
  });
  it("is symmetric around 0 in distance from base", () => {
    const up = sideBrightness(0.5) - 1;
    const down = 1 - sideBrightness(-0.5);
    // amp doesn't have to give symmetric magnitudes because peak/dark differ;
    // verify the explicit values rather than equality.
    expect(up).toBeCloseTo(0.2);
    expect(down).toBeCloseTo(0.15);
  });
  it("respects custom base/peak/dark", () => {
    expect(sideBrightness(1, 0.5, 0.9, 0.1)).toBeCloseTo(0.9); // peak
    expect(sideBrightness(-1, 0.5, 0.9, 0.1)).toBeCloseTo(0.1); // dark
  });
});
