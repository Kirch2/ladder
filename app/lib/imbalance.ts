/**
 * One side's brightness multiplier for the imbalance bar. `amp` is the
 * side's relative imbalance, −1 (fully smaller) … 0 (balanced) … +1 (fully
 * dominant). Ramps up toward `peak` when dominant, down toward `dark` when
 * smaller; never dimmed below `dark` and never brighter than `peak`.
 */
export function sideBrightness(
  amp: number,
  base = 1,
  peak = 1.4,
  dark = 0.7,
): number {
  if (amp >= 0) return base + amp * (peak - base);
  return base + amp * (base - dark);
}
