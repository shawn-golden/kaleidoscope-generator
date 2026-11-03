import type { Pt, RippleSource } from "../engine/types";

/** Frame clock and pointer live outside React so the canvas can paint at 60fps. */
export const runtime = {
  time: 0,
  pointer: null as Pt | null,
  ripples: [] as RippleSource[],
  space: false,
};
