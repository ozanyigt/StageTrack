import type { ScreenPlacement } from "./scene";

/**
 * Where screens were moved on 3D Sahne, by screen id (kept in this browser). A screen without one stands where the
 * Pixel Map puts it; moving it here never changes the Pixel Map.
 */
export type Placements = Record<string, ScreenPlacement>;

/** Konum X / Z (m, the stage's middle and the screens' starting face line at 0) and Dönüş (°). */
export const PLACEMENT_LIMITS: Record<keyof ScreenPlacement, { min: number; max: number }> = {
  x: { min: -100, max: 100 },
  z: { min: -50, max: 50 },
  rotationDeg: { min: -180, max: 180 },
};

/** What the − / + buttons move by: 10 cm, 1°. */
export const PLACEMENT_STEPS: Record<keyof ScreenPlacement, number> = { x: 0.1, z: 0.1, rotationDeg: 1 };

const clamp = (v: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, v));

/** Stored placements made safe: numbers only, within bounds; anything else dropped. */
export function sanitizePlacements(raw: unknown): Placements {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Placements = {};
  for (const [id, p] of Object.entries(raw as Record<string, unknown>)) {
    const { x, z, rotationDeg } = (p ?? {}) as Record<string, unknown>;
    if ([x, z, rotationDeg].every((v) => typeof v === "number" && Number.isFinite(v)))
      out[id] = {
        x: clamp(x as number, PLACEMENT_LIMITS.x),
        z: clamp(z as number, PLACEMENT_LIMITS.z),
        rotationDeg: clamp(rotationDeg as number, PLACEMENT_LIMITS.rotationDeg),
      };
  }
  return out;
}
