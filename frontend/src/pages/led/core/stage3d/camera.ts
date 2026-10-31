/**
 * 3D Sahne camera: an orbit around a target point, as plain numbers (the page turns it into a three.js camera).
 * World: metres, y up, x left → right across the stage, +z towards the audience.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface OrbitView {
  target: Vec3;
  distance: number;
  /** Around the vertical axis, radians; 0 = looking from the audience (camera on +z). */
  azimuth: number;
  /** From straight above (0) to level (π / 2), radians. */
  polar: number;
}

export type CameraPreset = "perspective" | "front" | "top" | "side";
export const CAMERA_PRESETS: readonly CameraPreset[] = ["perspective", "front", "top", "side"];

/** Not quite straight above / level: the camera's "up" stays defined. */
const POLAR_MIN = 0.01;
const POLAR_MAX = Math.PI / 2 - 0.01;
export const DISTANCE_MIN = 1;
export const DISTANCE_MAX = 500;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** The camera's position for a view. */
export function cameraPosition(v: OrbitView): Vec3 {
  const s = Math.sin(v.polar);
  return {
    x: v.target.x + v.distance * s * Math.sin(v.azimuth),
    y: v.target.y + v.distance * Math.cos(v.polar),
    z: v.target.z + v.distance * s * Math.cos(v.azimuth),
  };
}

/** Drag: turn around the target (dx / dy in screen pixels). */
export function orbit(v: OrbitView, dx: number, dy: number): OrbitView {
  return { ...v, azimuth: v.azimuth - dx * 0.008, polar: clamp(v.polar - dy * 0.008, POLAR_MIN, POLAR_MAX) };
}

/** Wheel: closer / further (deltaY as the wheel event gives it). */
export function zoom(v: OrbitView, deltaY: number): OrbitView {
  return { ...v, distance: clamp(v.distance * Math.exp(deltaY * 0.0012), DISTANCE_MIN, DISTANCE_MAX) };
}

/**
 * Shift + drag: the target moves in the picture's plane, by as much as the pointer (dx / dy in pixels, `viewHeight`
 * the view's height in pixels, `fovDeg` the vertical field of view).
 */
export function pan(v: OrbitView, dx: number, dy: number, viewHeight: number, fovDeg: number): OrbitView {
  const perPixel = (2 * v.distance * Math.tan(((fovDeg / 2) * Math.PI) / 180)) / Math.max(1, viewHeight);
  // The picture's right and up directions.
  const right = { x: Math.cos(v.azimuth), y: 0, z: -Math.sin(v.azimuth) };
  const up = { x: -Math.cos(v.polar) * Math.sin(v.azimuth), y: Math.sin(v.polar), z: -Math.cos(v.polar) * Math.cos(v.azimuth) };
  const mx = -dx * perPixel;
  const my = dy * perPixel;
  return { ...v, target: { x: v.target.x + right.x * mx + up.x * my, y: v.target.y + right.y * mx + up.y * my, z: v.target.z + right.z * mx + up.z * my } };
}

/** What the presets look at: the screens and the stage (metres). */
export interface SceneBounds {
  center: Vec3;
  /** Radius of a sphere around everything. */
  radius: number;
}

/** A preset view of the whole scene: far enough to see everything with this field of view. */
export function presetView(preset: CameraPreset, bounds: SceneBounds, fovDeg: number, aspect = 16 / 9): OrbitView {
  const half = ((fovDeg / 2) * Math.PI) / 180;
  // The narrower of the two angles must hold the sphere.
  const fit = Math.min(half, Math.atan(Math.tan(half) * aspect));
  const distance = clamp((bounds.radius / Math.sin(fit)) * 1.05, DISTANCE_MIN, DISTANCE_MAX);
  const angles: Record<CameraPreset, [number, number]> = {
    perspective: [-Math.PI / 6, 1.15],
    front: [0, POLAR_MAX],
    top: [0, POLAR_MIN],
    side: [Math.PI / 2, POLAR_MAX],
  };
  const [azimuth, polar] = angles[preset];
  return { target: { ...bounds.center }, distance, azimuth, polar };
}

/** The view part of the way (t 0 → 1) from `a` to `b`, eased; the azimuth turns the short way round. */
export function lerpView(a: OrbitView, b: OrbitView, t: number): OrbitView {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const mix = (p: number, q: number) => p + (q - p) * k;
  let turn = (b.azimuth - a.azimuth) % (2 * Math.PI);
  if (turn > Math.PI) turn -= 2 * Math.PI;
  if (turn < -Math.PI) turn += 2 * Math.PI;
  return {
    target: { x: mix(a.target.x, b.target.x), y: mix(a.target.y, b.target.y), z: mix(a.target.z, b.target.z) },
    distance: mix(a.distance, b.distance),
    azimuth: a.azimuth + turn * k,
    polar: mix(a.polar, b.polar),
  };
}
