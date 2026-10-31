import type { PixelMapState, Rect } from "./pixelMap";

/**
 * Pixel Map: screens added edge to edge ("+" on a selected screen's sides). Pure functions only — the page
 * (pages/PixelMapPage.tsx) builds on these.
 */

/** A side of a screen the "+" buttons add to. */
export type Side = "top" | "right" | "bottom" | "left";

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Where a screen of `size` goes on the `side` of `source`: edge to edge, aligned with the source's top (left / right)
 * or left (top / bottom). A place already taken moves it on by its own size, so pressing "+" again lines screens up.
 * May be negative (left of / above the origin) — the caller then moves the whole map.
 */
export function adjacentSlot(source: Rect, size: { width: number; height: number }, side: Side, others: Rect[]): { x: number; y: number } {
  const step = { top: [0, -size.height], bottom: [0, size.height], left: [-size.width, 0], right: [size.width, 0] }[side];
  let x = side === "right" ? source.x + source.width : side === "left" ? source.x - size.width : source.x;
  let y = side === "bottom" ? source.y + source.height : side === "top" ? source.y - size.height : source.y;
  // Bounded: a map holds far fewer screens than this.
  for (let i = 0; i < 10_000 && others.some((o) => overlaps({ x, y, width: size.width, height: size.height }, o)); i++) {
    x += step[0];
    y += step[1];
  }
  return { x, y };
}

/** Every screen moved by dx, dy — to make room left of / above the origin. */
export function shiftMap(state: PixelMapState, dx: number, dy: number): PixelMapState {
  if (dx === 0 && dy === 0) return state;
  const layouts = Object.fromEntries(Object.entries(state.layouts).map(([id, l]) => [id, { ...l, x: l.x + dx, y: l.y + dy }]));
  return { ...state, layouts };
}
