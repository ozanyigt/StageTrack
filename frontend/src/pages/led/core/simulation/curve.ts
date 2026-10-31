import type { ScreenCurve, WallConfig } from "../types";
import type { Point } from "./wiring";
import type { StageScreen } from "./stage";

/**
 * Simülasyon curve: what the user asks for (an arc in degrees or a radius in metres, concave or convex) and the
 * geometry of a curved screen. The server fits the angle to the panel's lock positions (Açı min / max / adım) and
 * returns one angle per joint between two columns (+ concave: the ends come towards the audience; − convex).
 */

export const MAX_ARC_DEG = 360;
export const MAX_RADIUS_M = 10_000;
/** Notes the server gives a curve (screen warnings). */
export const CURVE_WARNINGS = ["curve_not_supported", "curve_angle_out_of_range", "curve_angle_rounded", "curve_no_joints"] as const;
/** The panel can't make the curve asked for: those joints are drawn red. */
export const CURVE_MISFIT = new Set(["curve_not_supported", "curve_angle_out_of_range"]);

/** The curve as it can be sent: null when not set, or not a usable value. */
export function curveOf(wall: Pick<WallConfig, "curve">): ScreenCurve | null {
  const c = wall.curve;
  if (!c || (c.mode !== "Arc" && c.mode !== "Radius") || (c.direction !== "Concave" && c.direction !== "Convex")) return null;
  const max = c.mode === "Arc" ? MAX_ARC_DEG : MAX_RADIUS_M;
  if (typeof c.value !== "number" || !Number.isFinite(c.value) || c.value <= 0 || c.value > max) return null;
  return { mode: c.mode, value: c.value, direction: c.direction };
}

/**
 * The face of a screen seen from above, in stage metres: its left edge, every joint, its right edge. Each panel is
 * a straight piece; at each joint the next one turns by that joint's angle. The ends' midpoint stands at the
 * screen's place, so a flat screen is exactly its footprint's face.
 */
export function facePoints(screen: Pick<StageScreen, "columnWidthsM" | "placement" | "jointAnglesDeg">): Point[] {
  const angles = screen.jointAnglesDeg ?? [];
  const widths = screen.columnWidthsM;
  const total = angles.slice(0, Math.max(0, widths.length - 1)).reduce((sum, a) => sum + a, 0);
  let heading = (-total / 2) * (Math.PI / 180);
  const local: Point[] = [{ x: 0, z: 0 }];
  widths.forEach((w, i) => {
    const last = local[local.length - 1];
    local.push({ x: last.x + w * Math.cos(heading), z: last.z + w * Math.sin(heading) });
    if (i < widths.length - 1) heading += ((angles[i] ?? 0) * Math.PI) / 180;
  });
  const mid = { x: (local[0].x + local[local.length - 1].x) / 2, z: (local[0].z + local[local.length - 1].z) / 2 };
  const a = (screen.placement.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return local.map((p) => {
    const dx = p.x - mid.x;
    const dz = p.z - mid.z;
    return { x: screen.placement.x + dx * cos - dz * sin, z: screen.placement.z + dx * sin + dz * cos };
  });
}

/**
 * Where every column's edges fall in the front view (the audience's x, left to right): the face's points across
 * the stage, mirrored when the screen is turned away so its column 0 is still drawn on the audience's left.
 */
export function frontColumns(screen: Pick<StageScreen, "columnWidthsM" | "placement" | "jointAnglesDeg">): number[] {
  const xs = facePoints(screen).map((p) => p.x);
  if (xs.length < 2 || xs[xs.length - 1] >= xs[0]) return xs;
  const centre = xs[0] + xs[xs.length - 1];
  return xs.map((x) => centre - x);
}

export function isCurved(screen: Pick<StageScreen, "jointAnglesDeg">): boolean {
  return (screen.jointAnglesDeg ?? []).some((a) => a !== 0);
}
