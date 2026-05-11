/** A directional inside-price change marker — direction and a timestamp so
 * consecutive ticks restart the fade animation via React keying. */
export type Tick = { dir: "up" | "down"; ts: number } | null;
