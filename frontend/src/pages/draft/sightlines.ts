/**
 * Can they see it from there? The question every client asks and no inventory answers. What decides it is
 * geometry we already have: where the screen stands and how big it is, what the panel's pitch is, what is
 * standing in the way, and how the floor rises.
 *
 * The rules of thumb are the trade's own, and are stated rather than hidden:
 *  - closer than about the pitch in metres (a 3.9 mm panel inside ~4 m) and the picture is grainy;
 *  - past roughly twelve screen heights the picture is too small to read;
 *  - more than 60 degrees off the screen's face and you are looking along it, not at it;
 *  - and anything tall enough standing between the seat and the screen blocks it outright.
 *
 * Pure arithmetic on a flat grid, in the same scene metres as the 3D stage: x across, z towards the audience.
 */

export type SightVerdict = 'Good' | 'TooClose' | 'TooFar' | 'TooSteep' | 'Blocked';

export interface SightScreen {
  id: string;
  /** Centre of the screen's face. */
  x: number;
  z: number;
  /** Which way the face points, degrees; 0 = towards the audience. */
  rotationDeg: number;
  widthM: number;
  heightM: number;
  /** Bottom edge above the floor. */
  bottomM: number;
  /** Panel pitch, millimetres; null when the screen has no panel picked yet. */
  pitchMm: number | null;
}

export interface SightObstacle {
  x: number;
  z: number;
  /** Footprint, metres. */
  widthM: number;
  depthM: number;
  /** How tall it stands on the floor; below eye height it blocks nothing. */
  heightM: number;
  /** Hung things do not stand in anybody's way. */
  flown: boolean;
}

export interface SightArea {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface SightCell {
  x: number;
  z: number;
  verdict: SightVerdict;
  /** Distance to the nearest screen's face, metres. */
  distanceM: number;
}

export interface SightResult {
  cells: SightCell[];
  cellM: number;
  counts: Record<SightVerdict, number>;
  /** Share of the audience area that sees a screen properly, 0..1. */
  goodShare: number;
}

export const MAX_OFF_AXIS_DEG = 60;
export const MAX_SCREEN_HEIGHTS = 12;

/** Eye height of a seated or standing viewer, metres; the rake lifts it further back. */
export const EYE_HEIGHT_M = 1.6;

export function analyseSightlines(
  area: SightArea,
  screens: SightScreen[],
  obstacles: SightObstacle[],
  options: { cellM?: number; rakeDeg?: number; eyeHeightM?: number } = {},
): SightResult {
  const cellM = options.cellM ?? 1;
  const rake = Math.tan(((options.rakeDeg ?? 0) * Math.PI) / 180);
  const eye = options.eyeHeightM ?? EYE_HEIGHT_M;
  const cells: SightCell[] = [];
  const counts: Record<SightVerdict, number> = { Good: 0, TooClose: 0, TooFar: 0, TooSteep: 0, Blocked: 0 };

  const standing = obstacles.filter((o) => !o.flown && o.heightM > 0.8);

  for (let z = area.minZ + cellM / 2; z < area.maxZ; z += cellM) {
    for (let x = area.minX + cellM / 2; x < area.maxX; x += cellM) {
      // The floor rises away from the stage, so a seat further back sits higher - that is what a rake buys.
      const eyeY = eye + Math.max(0, z) * rake;
      const best = bestScreen({ x, z, eyeY }, screens, standing);
      cells.push({ x, z, verdict: best.verdict, distanceM: best.distanceM });
      counts[best.verdict]++;
    }
  }

  const total = cells.length || 1;
  return { cells, cellM, counts, goodShare: counts.Good / total };
}

/** The kindest verdict any screen gives this seat: one good screen is enough to see the show. */
function bestScreen(
  seat: { x: number; z: number; eyeY: number },
  screens: SightScreen[],
  obstacles: SightObstacle[],
): { verdict: SightVerdict; distanceM: number } {
  const order: SightVerdict[] = ['Good', 'TooClose', 'TooFar', 'TooSteep', 'Blocked'];
  let best: { verdict: SightVerdict; distanceM: number } = { verdict: 'Blocked', distanceM: Infinity };

  for (const screen of screens) {
    const dx = seat.x - screen.x;
    const dz = seat.z - screen.z;
    const distance = Math.hypot(dx, dz);
    const verdict = verdictFor(seat, screen, distance, dx, dz, obstacles);
    if (order.indexOf(verdict) < order.indexOf(best.verdict) || (verdict === best.verdict && distance < best.distanceM)) {
      best = { verdict, distanceM: distance };
    }
  }

  return screens.length === 0 ? { verdict: 'Blocked', distanceM: 0 } : best;
}

function verdictFor(
  seat: { x: number; z: number; eyeY: number },
  screen: SightScreen,
  distance: number,
  dx: number,
  dz: number,
  obstacles: SightObstacle[],
): SightVerdict {
  // The face points along +z turned by its rotation; the angle between that and the seat is the off-axis angle.
  const facing = (screen.rotationDeg * Math.PI) / 180;
  const normal = { x: Math.sin(facing), z: Math.cos(facing) };
  const dot = (dx * normal.x + dz * normal.z) / (distance || 1);
  const offAxis = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
  if (offAxis > MAX_OFF_AXIS_DEG) return 'TooSteep';

  const minimum = screen.pitchMm ?? 0;
  if (distance < minimum) return 'TooClose';
  if (distance > screen.heightM * MAX_SCREEN_HEIGHTS) return 'TooFar';

  for (const obstacle of obstacles) {
    if (blocks(seat, screen, obstacle)) return 'Blocked';
  }

  return 'Good';
}

/**
 * Whether something standing on the floor cuts the line from the seat to the middle of the screen. Checked in
 * plan and then in height: a metre-high deck does not block a screen hanging six metres up.
 */
function blocks(seat: { x: number; z: number; eyeY: number }, screen: SightScreen, obstacle: SightObstacle): boolean {
  const target = { x: screen.x, z: screen.z };
  const half = { x: obstacle.widthM / 2, z: obstacle.depthM / 2 };
  const hit = segmentHitsBox(seat, target, obstacle, half);
  if (hit === null) return false;

  // Where the line of sight is in height at the obstacle, against how tall the obstacle is.
  const middleY = screen.bottomM + screen.heightM / 2;
  const lineY = seat.eyeY + (middleY - seat.eyeY) * hit;
  return obstacle.heightM > lineY;
}

/** How far along the seat-to-screen line the obstacle's footprint is first met, or null if it is not. */
function segmentHitsBox(
  from: { x: number; z: number },
  to: { x: number; z: number },
  box: { x: number; z: number },
  half: { x: number; z: number },
): number | null {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  let enter = 0;
  let exit = 1;

  for (const axis of ['x', 'z'] as const) {
    const start = axis === 'x' ? from.x : from.z;
    const delta = axis === 'x' ? dx : dz;
    const min = (axis === 'x' ? box.x : box.z) - (axis === 'x' ? half.x : half.z);
    const max = (axis === 'x' ? box.x : box.z) + (axis === 'x' ? half.x : half.z);

    if (Math.abs(delta) < 1e-9) {
      if (start < min || start > max) return null;
      continue;
    }

    const t1 = (min - start) / delta;
    const t2 = (max - start) / delta;
    enter = Math.max(enter, Math.min(t1, t2));
    exit = Math.min(exit, Math.max(t1, t2));
    if (enter > exit) return null;
  }

  return enter;
}
