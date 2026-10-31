import { facePoints } from "../simulation/curve";
import type { SceneBounds, Vec3 } from "./camera";
import { compositionSize, type Stage3DScreen } from "./screens";
import { screenBottomM, type StageSettings } from "./settings";

/**
 * 3D Sahne's world, worked out from the screens and the stage values (metres; y up from the hall floor, x across
 * the stage with its middle at 0, +z towards the audience). The screens start side by side as on the Pixel Map, faces on
 * z = 0; a screen moved on 3D Sahne stands where it was put (its own x, z and turn). The podium's front edge is the
 * front gap in front of z = 0. Pure, so the drawing just follows it.
 */

/** Where a screen stands on the stage: its middle on x, its face's line on z, its turn seen from above (degrees). */
export interface ScreenPlacement {
  x: number;
  z: number;
  rotationDeg: number;
}

export interface PlacedScreen extends ScreenPlacement {
  screen: Stage3DScreen;
  /** Bottom edge above the floor. */
  bottom: number;
}

/** The placement as Simülasyon's curve geometry takes it (lib/simulation/curve.ts facePoints). */
export function facePlacement(p: ScreenPlacement) {
  return { x: p.x, z: p.z, rotationDeg: p.rotationDeg, elevationM: 0 };
}

/** The screen's face seen from above: its left edge, every joint, its right edge. */
export function faceOf(p: PlacedScreen) {
  return facePoints({ columnWidthsM: p.screen.columnWidthsM, jointAnglesDeg: p.screen.jointAnglesDeg, placement: facePlacement(p) });
}

export interface Segment {
  a: Vec3;
  b: Vec3;
}

export type DimensionKind = "width" | "height" | "bottom" | "stageWidth" | "stageDepth";

/** A measurement line with its end ticks and where its label goes; the label says `value` metres. */
export interface Dimension {
  kind: DimensionKind;
  value: number;
  lines: Segment[];
  label: Vec3;
}

export interface Podium {
  width: number;
  depth: number;
  height: number;
  /** Front and back edge on z. */
  front: number;
  back: number;
}

export interface SceneLayout {
  screens: PlacedScreen[];
  /** The first screen shown (the Pixel Map's order): the one measured. */
  mainId: string | null;
  podium: Podium;
  dimensions: Dimension[];
  /** "SEYİRCİ" on the floor, in front of the podium. */
  audience: Vec3;
  bounds: SceneBounds;
  /** Flown screens hanging lower than the podium's top. */
  belowStage: boolean;
}

/** How far a measurement stands off what it measures, and its end ticks' half length. */
const OFFSET = 0.4;
const TICK = 0.12;
/** The width measurement over a curved screen (above its joint angles). */
const CURVED_WIDTH_OFFSET = 0.8;

/** Whether a screen has a bent joint (its angles are written along its top edge). */
export const isBent = (screen: Pick<Stage3DScreen, "jointAnglesDeg">) => (screen.jointAnglesDeg ?? []).some((a) => a !== 0);

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** A measurement from a to b with ticks across it (`across` = the ticks' direction). */
function dimension(kind: DimensionKind, value: number, a: Vec3, b: Vec3, across: Vec3): Dimension {
  const tick = (p: Vec3): Segment => ({ a: v(p.x - across.x * TICK, p.y - across.y * TICK, p.z - across.z * TICK), b: v(p.x + across.x * TICK, p.y + across.y * TICK, p.z + across.z * TICK) });
  return { kind, value, lines: [{ a, b }, tick(a), tick(b)], label: v((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2) };
}

/** Where a screen starts: as on the Pixel Map, the composition centred on x = 0, its face on z = 0, not turned. */
export function startPlacement(screen: Stage3DScreen, screens: Stage3DScreen[]): ScreenPlacement {
  return { x: screen.xM - compositionSize(screens).widthM / 2 + screen.widthM / 2, z: 0, rotationDeg: 0 };
}

/** `placements`: the screens moved on 3D Sahne (by id); the others start as on the Pixel Map. */
export function sceneLayout(screens: Stage3DScreen[], s: StageSettings, placements: Record<string, ScreenPlacement> = {}): SceneLayout {
  const { heightM } = compositionSize(screens);
  const base = screenBottomM(s, heightM);
  const placed: PlacedScreen[] = screens.map((screen) => ({
    screen,
    ...(placements[screen.id] ?? startPlacement(screen, screens)),
    bottom: base + (heightM - (screen.yM + screen.heightM)),
  }));
  const podium: Podium = { width: s.stageWidthM, depth: s.stageDepthM, height: s.stageHeightM, front: s.frontGapM, back: s.frontGapM - s.stageDepthM };

  const dimensions: Dimension[] = [];
  const main = placed[0];
  if (main) {
    const face = faceOf(main);
    const leftEnd = face[0];
    const rightEnd = face[face.length - 1];
    const top = main.bottom + main.screen.heightM;
    // Along the face's chord, a little in front of it; the side measurements beside its ends.
    const len = Math.hypot(rightEnd.x - leftEnd.x, rightEnd.z - leftEnd.z) || 1;
    const along = { x: (rightEnd.x - leftEnd.x) / len, z: (rightEnd.z - leftEnd.z) / len };
    const front = { x: -along.z * 0.05, z: along.x * 0.05 };
    const end = (p: { x: number; z: number }, out: number, y: number) => v(p.x + along.x * out + front.x, y, p.z + along.z * out + front.z);
    // A curved screen's joint angles run along its top edge: its width goes higher, clear of them.
    const widthY = top + (isBent(main.screen) ? CURVED_WIDTH_OFFSET : OFFSET);
    const acrossX = v(along.x, 0, along.z);
    dimensions.push(dimension("width", main.screen.widthM, end(leftEnd, 0, widthY), end(rightEnd, 0, widthY), v(0, 1, 0)));
    dimensions.push(dimension("height", main.screen.heightM, end(leftEnd, -OFFSET, main.bottom), end(leftEnd, -OFFSET, top), acrossX));
    // Alt kot: from the podium's top up to the screen's bottom edge.
    if (main.bottom - s.stageHeightM > 0.005) {
      dimensions.push(dimension("bottom", main.bottom - s.stageHeightM, end(rightEnd, OFFSET, s.stageHeightM), end(rightEnd, OFFSET, main.bottom), acrossX));
    }
  }
  const floorY = 0.02;
  dimensions.push(dimension("stageWidth", podium.width, v(-podium.width / 2, floorY, podium.front + OFFSET), v(podium.width / 2, floorY, podium.front + OFFSET), v(0, 0, 1)));
  dimensions.push(dimension("stageDepth", podium.depth, v(-podium.width / 2 - OFFSET, floorY, podium.back), v(-podium.width / 2 - OFFSET, floorY, podium.front), v(1, 0, 0)));

  // Everything to keep in view: the podium, the screens, a truss above them.
  const faces = placed.flatMap(faceOf);
  const minX = Math.min(-podium.width / 2, ...faces.map((p) => p.x));
  const maxX = Math.max(podium.width / 2, ...faces.map((p) => p.x));
  const maxY = Math.max(podium.height, ...placed.map((p) => p.bottom + p.screen.heightM), s.mount === "Flown" ? s.trussHeightM : 0) + OFFSET;
  const minZ = Math.min(podium.back, -1, ...faces.map((p) => p.z - 1.5));
  const maxZ = Math.max(podium.front + 3, ...faces.map((p) => p.z + 1));
  const center = v((minX + maxX) / 2, maxY / 2, (minZ + maxZ) / 2);
  const radius = Math.hypot((maxX - minX) / 2, maxY / 2, (maxZ - minZ) / 2);

  return {
    screens: placed,
    mainId: main?.screen.id ?? null,
    podium,
    dimensions,
    audience: v(0, 0.01, podium.front + 2.4),
    bounds: { center, radius },
    belowStage: s.mount === "Flown" && placed.some((p) => p.bottom < s.stageHeightM - 0.005),
  };
}

/** A curve's angle written over one joint: which screen, which joint (0 = between columns 1 and 2), where. */
export interface JointMark {
  screenId: string;
  index: number;
  angleDeg: number;
  point: Vec3;
}

/** Above the top edge, under the width measurement: the joint labels sit this high over the screen. */
const JOINT_MARK_ABOVE_M = 0.14;

/**
 * Every bent joint's angle on the curved screens, placed just above the top edge at the joint (between two panels),
 * on the face's line — so the labels run along the top edge and never over the panels.
 */
export function jointMarks(layout: SceneLayout): JointMark[] {
  return layout.screens.flatMap((placed) => {
    const { screen, bottom } = placed;
    const angles = screen.jointAnglesDeg ?? [];
    if (!angles.some((a) => a !== 0)) return [];
    const face = faceOf(placed);
    const top = bottom + screen.heightM + JOINT_MARK_ABOVE_M;
    return angles.slice(0, Math.max(0, screen.columnWidthsM.length - 1)).flatMap((angleDeg, index) => {
      const p = face[index + 1];
      return angleDeg === 0 || !p ? [] : [{ screenId: screen.id, index, angleDeg, point: v(p.x, top, p.z) }];
    });
  });
}

/** A screen dragged near these lines snaps to them (x: edges and middles; z: face lines); with them the guides drawn. */
export interface SnapResult {
  x: number;
  z: number;
  guideX: number | null;
  guideZ: number | null;
}

/**
 * Snaps a screen being moved (its placement wanted) to the other screens and the stage's middle: its left edge,
 * middle or right edge to theirs (and x = 0), its face's line to theirs (and z = 0), within `threshold` metres.
 * `free` (Shift) does not snap. Seen as the screen's extent on x / its face's z, turned screens included.
 */
export function snapPlacement(layout: SceneLayout, id: string, wanted: ScreenPlacement, threshold: number, free = false): SnapResult {
  const moving = layout.screens.find((p) => p.screen.id === id);
  if (free || !moving) return { x: wanted.x, z: wanted.z, guideX: null, guideZ: null };
  const face = faceOf({ ...moving, ...wanted });
  const xs = face.map((p) => p.x);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const others = layout.screens.filter((p) => p.screen.id !== id);
  const targetsX = [0];
  const targetsZ = [0];
  for (const o of others) {
    const f = faceOf(o).map((p) => p.x);
    targetsX.push(Math.min(...f), Math.max(...f), o.x);
    targetsZ.push(o.z);
  }
  let best: { d: number; dx: number; line: number } | null = null;
  for (const own of [minX, wanted.x, maxX])
    for (const t of targetsX) {
      const d = Math.abs(t - own);
      if (d <= threshold && (!best || d < best.d)) best = { d, dx: t - own, line: t };
    }
  let bestZ: { d: number; z: number } | null = null;
  for (const t of targetsZ) {
    const d = Math.abs(t - wanted.z);
    if (d <= threshold && (!bestZ || d < bestZ.d)) bestZ = { d, z: t };
  }
  const mm = (n: number) => Math.round(n * 1000) / 1000;
  return { x: mm(wanted.x + (best?.dx ?? 0)), z: mm(bestZ?.z ?? wanted.z), guideX: best?.line ?? null, guideZ: bestZ?.z ?? null };
}
