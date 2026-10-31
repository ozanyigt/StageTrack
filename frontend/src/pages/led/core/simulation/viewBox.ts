/** An SVG viewBox in drawing units (metres for the stage views). */
export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ClientRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Zoom limits: the smallest and largest viewBox width (drawing units). */
export interface ZoomLimits {
  min: number;
  max: number;
}

/** In metres: a viewBox side between 0.5 m and 400 m. */
export const METRE_LIMITS: ZoomLimits = { min: 0.5, max: 400 };

/**
 * Where a pointer is in drawing units, for an <svg> with preserveAspectRatio "xMidYMid meet" (the drawing is
 * scaled to fit and centred). Null when the element has no size (not laid out).
 */
export function clientToView(clientX: number, clientY: number, rect: ClientRect, box: ViewBox): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const scale = Math.min(rect.width / box.w, rect.height / box.h);
  const offsetX = (rect.width - box.w * scale) / 2;
  const offsetY = (rect.height - box.h * scale) / 2;
  return { x: box.x + (clientX - rect.left - offsetX) / scale, y: box.y + (clientY - rect.top - offsetY) / scale };
}

/** The box around a region with a margin on every side. */
export function fitBox(x: number, y: number, w: number, h: number, margin: number): ViewBox {
  return { x: x - margin, y: y - margin, w: w + 2 * margin, h: h + 2 * margin };
}

export interface Size {
  w: number;
  h: number;
}

/**
 * Pixel Map's plane (origin 0,0 at the top left, x right, y down): the box that shows 0…right × 0…bottom in a
 * drawing area of `size` px as large as it fits, the origin `pad` px in from the top-left corner and `margin` px
 * free on the right / bottom. The box has the area's shape (the drawing fills it).
 */
export function originFit(right: number, bottom: number, size: Size, pad: { x: number; y: number }, margin: number): ViewBox {
  const scale = Math.max(1e-9, Math.min((size.w - pad.x - margin) / Math.max(1, right), (size.h - pad.y - margin) / Math.max(1, bottom)));
  return { x: -pad.x / scale, y: -pad.y / scale, w: size.w / scale, h: size.h / scale };
}

/**
 * A box shaped to the drawing area (its zoom kept, anchored at its top left) and kept right of / below the origin:
 * at most `pad` px of the area shows left of x = 0 / above y = 0.
 */
export function originBound(box: ViewBox, size: Size, pad: { x: number; y: number }): ViewBox {
  const scale = Math.min(size.w / box.w, size.h / box.h);
  return { x: Math.max(-pad.x / scale, box.x), y: Math.max(-pad.y / scale, box.y), w: size.w / scale, h: size.h / scale };
}

/** Zoom by `factor` (< 1 = closer) keeping the point (px, py) where it is. */
export function zoomAt(box: ViewBox, factor: number, px: number, py: number, limits: ZoomLimits = METRE_LIMITS): ViewBox {
  const w = Math.min(limits.max, Math.max(limits.min, box.w * factor));
  const f = w / box.w;
  const h = box.h * f;
  return { x: px - (px - box.x) * f, y: py - (py - box.y) * f, w, h };
}

/** Zoom around the centre (buttons). */
export function zoomCentre(box: ViewBox, factor: number, limits: ZoomLimits = METRE_LIMITS): ViewBox {
  return zoomAt(box, factor, box.x + box.w / 2, box.y + box.h / 2, limits);
}

export const viewBoxAttr = (box: ViewBox) => `${box.x} ${box.y} ${box.w} ${box.h}`;
