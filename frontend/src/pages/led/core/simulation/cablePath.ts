/**
 * A cable drawn through its panels' centres: one unbroken path whose turns are rounded (a quadratic curve through
 * the corner, as far as `radius` along each side, never past half a side), and the places along it where the
 * direction marks go.
 */

export interface Point {
  x: number;
  y: number;
}

export function roundedPath(points: Point[], radius: number): string {
  const pts = points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
  if (pts.length === 0) return "";
  let d = `M${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    const inLen = Math.hypot(b.x - a.x, b.y - a.y);
    const outLen = Math.hypot(c.x - b.x, c.y - b.y);
    const straight = Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) < 1e-9 * inLen * outLen;
    if (straight) continue;
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const p1 = { x: b.x - ((b.x - a.x) / inLen) * r, y: b.y - ((b.y - a.y) / inLen) * r };
    const p2 = { x: b.x + ((c.x - b.x) / outLen) * r, y: b.y + ((c.y - b.y) / outLen) * r };
    d += `L${fmt(p1.x)} ${fmt(p1.y)}Q${fmt(b.x)} ${fmt(b.y)} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  if (pts.length > 1) d += `L${fmt(pts[pts.length - 1].x)} ${fmt(pts[pts.length - 1].y)}`;
  return d;
}

/**
 * Direction marks every `spacing` along the line (the first half a spacing in, none closer than half a spacing to the
 * end, where the start badge and the end dot are): position and the line's angle there, degrees.
 */
export function directionMarks(points: Point[], spacing: number): { x: number; y: number; angle: number }[] {
  if (!(spacing > 0) || points.length < 2) return [];
  const marks: { x: number; y: number; angle: number }[] = [];
  const total = points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
  let at = spacing / 2;
  let walked = 0;
  for (let i = 1; i < points.length && marks.length < 5000; i++) {
    const [a, b] = [points[i - 1], points[i]];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    while (len > 0 && at <= walked + len && at <= total - spacing / 2) {
      const t = (at - walked) / len;
      marks.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI });
      at += spacing;
    }
    walked += len;
  }
  return marks;
}

/** A tick step for a ruler: 1, 2 or 5 × 10ⁿ, the smallest at least `min` long. */
export function niceStep(min: number): number {
  if (!(min > 0)) return 1;
  const base = 10 ** Math.floor(Math.log10(min));
  for (const m of [1, 2, 5, 10]) if (base * m >= min) return base * m;
  return base * 10;
}

const fmt = (v: number) => Math.round(v * 100) / 100;
