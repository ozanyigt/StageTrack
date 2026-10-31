import { parsePanelBoyut } from "../panel";
import { columnWidthsM, fitShape } from "./shape";
import { PIXEL_MAP_PALETTE } from "../pixelMap";
import type { Cutout, WallConfig } from "../types";

/**
 * Simülasyon: where each screen stands on the stage (seen from above), in metres. Pure functions only —
 * the page (pages/SimulationPage.tsx) and the views (components/simulation) build on these.
 *
 * Coordinates: x runs left → right across the stage, z from the back wall (0) to the front edge (depth),
 * where the audience is. A screen's position is its centre; rotation turns it around that centre, seen
 * from above (0° = facing the audience, positive = clockwise).
 */

export interface StagePlacement {
  /** Centre of the screen, metres from the stage's left edge. */
  x: number;
  /** Centre of the screen, metres from the back of the stage. */
  z: number;
  /** Degrees, -180 < r ≤ 180. */
  rotationDeg: number;
  /** Bottom edge above the stage floor, metres. */
  elevationM: number;
}

export interface StageState {
  /** Stage size in metres. */
  width: number;
  depth: number;
  /** By screen id. */
  placements: Record<string, StagePlacement>;
  /** Power feed points (distribution boxes) on the floor. */
  feeds: FeedPoint[];
  /** Where the processors stand (data cables start here); null = not placed. */
  processorPoint: { x: number; z: number } | null;
}

/** A distribution box (pano) on the stage floor and the screens it feeds (a screen is fed by one box at most). */
export interface FeedPoint {
  id: string;
  x: number;
  z: number;
  screenIds: string[];
}

/** A screen as the stage views draw it. */
export interface StageScreen {
  id: string;
  name: string;
  /** Face width / height in metres (columns × panel width, rows × panel height). */
  widthM: number;
  heightM: number;
  columns: number;
  rows: number;
  /** Width of each column (a corner column has its own panel's width), metres. */
  columnWidthsM: number[];
  /** Cut-out areas and corner columns as they are calculated. */
  cutouts: Cutout[];
  cornerColumns: number[];
  placement: StagePlacement;
  /** Curve (from the server): the angle at every joint between two columns, degrees; missing / empty = flat. */
  jointAnglesDeg?: number[];
  /** The panel can't make the curve asked for (its joints are drawn red). */
  curveMisfit?: boolean;
}

export const STAGE_MIN = 2;
export const STAGE_MAX = 200;
export const DEFAULT_STAGE: StageState = { width: 16, depth: 10, placements: {}, feeds: [], processorPoint: null };
export const MAX_FEEDS = 50;
/** A new feed point: this far from the back wall (behind the screens placed automatically). */
const FEED_Z_M = 0.5;
/** Snapping steps: positions on a 5 cm grid, rotation in 15° steps (Shift = free). */
export const POSITION_STEP_M = 0.05;
export const ROTATION_STEP_DEG = 15;
/** Depth of a screen drawn from above (an LED cabinet with its frame). */
export const SCREEN_DEPTH_M = 0.12;
/** Gap between screens placed automatically side by side. */
const AUTO_GAP_M = 0.5;
/** Where new screens go: this far from the back wall. */
const AUTO_Z_M = 1.5;
const MAX_ELEVATION_M = 50;
/** Placements kept for screens that are not in the list right now (removed, or not loaded yet). */
const MAX_PLACEMENTS = 200;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const finite = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const round = (v: number, step: number) => Math.round(v / step) * step;
/** Keeps 2 decimals (5 cm steps add float noise like 1.2500000000000002). */
const tidy = (v: number) => Math.round(v * 100) / 100;

/** Any angle → (-180, 180]. */
export function normalizeAngle(deg: number): number {
  const r = ((deg % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
}

/** Rotation from a drag: 15° steps unless free (Shift). */
export function snapRotation(deg: number, free = false): number {
  return normalizeAngle(free ? Math.round(deg) : round(deg, ROTATION_STEP_DEG));
}

/** A stage from localStorage or a share link: anything missing or broken falls back to the defaults. */
export function sanitizeStageState(raw: unknown): StageState {
  if (!raw || typeof raw !== "object") return DEFAULT_STAGE;
  const r = raw as Partial<Record<keyof StageState, unknown>>;
  const width = clamp(finite(r.width, DEFAULT_STAGE.width), STAGE_MIN, STAGE_MAX);
  const depth = clamp(finite(r.depth, DEFAULT_STAGE.depth), STAGE_MIN, STAGE_MAX);
  const placements: Record<string, StagePlacement> = {};
  if (r.placements && typeof r.placements === "object") {
    for (const [id, value] of Object.entries(r.placements as Record<string, unknown>).slice(-MAX_PLACEMENTS)) {
      if (!value || typeof value !== "object") continue;
      const p = value as Partial<Record<keyof StagePlacement, unknown>>;
      placements[id] = {
        x: tidy(clamp(finite(p.x, width / 2), 0, width)),
        z: tidy(clamp(finite(p.z, AUTO_Z_M), 0, depth)),
        rotationDeg: normalizeAngle(finite(p.rotationDeg, 0)),
        elevationM: tidy(clamp(finite(p.elevationM, 0), 0, MAX_ELEVATION_M)),
      };
    }
  }
  const p = r.processorPoint as Partial<Record<"x" | "z", unknown>> | null | undefined;
  const processorPoint =
    p && typeof p === "object" && typeof p.x === "number" && typeof p.z === "number"
      ? { x: tidy(clamp(finite(p.x, width / 2), 0, width)), z: tidy(clamp(finite(p.z, depth), 0, depth)) }
      : null;
  return { width, depth, placements, feeds: sanitizeFeeds(r.feeds, width, depth), processorPoint };
}

/** Feed points from storage / a link: valid ones only, each screen on the first box that names it. */
function sanitizeFeeds(raw: unknown, width: number, depth: number): FeedPoint[] {
  if (!Array.isArray(raw)) return [];
  const fed = new Set<string>();
  const ids = new Set<string>();
  return raw.slice(0, MAX_FEEDS).flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const f = value as Partial<Record<keyof FeedPoint, unknown>>;
    if (typeof f.id !== "string" || !f.id || ids.has(f.id)) return [];
    ids.add(f.id);
    const screenIds = (Array.isArray(f.screenIds) ? f.screenIds : [])
      .filter((id): id is string => typeof id === "string" && !fed.has(id))
      .slice(0, MAX_PLACEMENTS);
    screenIds.forEach((id) => fed.add(id));
    return [{ id: f.id, x: tidy(clamp(finite(f.x, width / 2), 0, width)), z: tidy(clamp(finite(f.z, FEED_Z_M), 0, depth)), screenIds }];
  });
}

/** Face size of a screen in metres (corner columns at their own width); null without a panel. */
export function screenSizeM(wall: WallConfig): { widthM: number; heightM: number } | null {
  if (!wall.panel) return null;
  const size = parsePanelBoyut(wall.panel.Panel_Boyut);
  const widths = columnWidthsM(wall, fitShape(wall, true).corners);
  return { widthM: widths.reduce((sum, w) => sum + w, 0), heightM: (size.heightMm * wall.heightPanels) / 1000 };
}

/**
 * Every screen with a panel gets a place: a placed one keeps it, a new one goes next to the others along the
 * back (left to right, centred on the stage while they fit). Placements are never dropped here: while the
 * inventory loads the screen list is still the default one, and a screen opened from a link comes back to its
 * place (sanitizeStageState keeps at most MAX_PLACEMENTS). Returns the same object when nothing changed (so it
 * can be stored from an effect without a loop).
 */
export function reconcileStage(state: StageState, screens: WallConfig[]): StageState {
  const sized = screens.flatMap((s) => {
    const size = screenSizeM(s);
    return size ? [{ id: s.id, ...size }] : [];
  });
  const missing = sized.filter((s) => !state.placements[s.id]);
  if (missing.length === 0) return state;

  const placements: Record<string, StagePlacement> = { ...state.placements };
  // Right edge of the screens on the stage now; new screens continue from there.
  let cursor = Math.max(
    0,
    ...sized.flatMap((s) => {
      const p = placements[s.id];
      return p ? [p.x + s.widthM / 2] : [];
    }),
  );
  const totalNew = missing.reduce((sum, s) => sum + s.widthM, 0) + AUTO_GAP_M * Math.max(0, missing.length - 1);
  if (cursor === 0 && totalNew < state.width) cursor = (state.width - totalNew) / 2;
  else if (cursor > 0) cursor += AUTO_GAP_M;
  for (const s of missing) {
    const x = clamp(cursor + s.widthM / 2, 0, state.width);
    placements[s.id] = { x: tidy(x), z: Math.min(AUTO_Z_M, state.depth / 2), rotationDeg: 0, elevationM: 0 };
    cursor += s.widthM + AUTO_GAP_M;
  }
  return { ...state, placements };
}

/** Colour of a screen on the stage, by its place among the screens on it. */
export const screenColor = (index: number) => PIXEL_MAP_PALETTE[index % PIXEL_MAP_PALETTE.length];

/** A moved screen: snapped to the 5 cm grid (unless free) and kept on the stage. */
export function movePlacement(state: StageState, id: string, x: number, z: number, free = false): StageState {
  const current = state.placements[id];
  if (!current) return state;
  const fix = (v: number, max: number) => tidy(clamp(free ? v : round(v, POSITION_STEP_M), 0, max));
  return { ...state, placements: { ...state.placements, [id]: { ...current, x: fix(x, state.width), z: fix(z, state.depth) } } };
}

export function updatePlacement(state: StageState, id: string, patch: Partial<StagePlacement>): StageState {
  const current = state.placements[id];
  if (!current) return state;
  const next = sanitizeStageState({ ...state, placements: { [id]: { ...current, ...patch } } }).placements[id];
  return { ...state, placements: { ...state.placements, [id]: next } };
}

/** New stage size; screens outside it are pulled back onto it. */
export function resizeStage(state: StageState, width: number, depth: number): StageState {
  return sanitizeStageState({ ...state, width, depth });
}

/** A new feed point at the back centre, feeding the given screens that no other box feeds yet. */
export function addFeed(state: StageState, screenIds: string[]): StageState {
  if (state.feeds.length >= MAX_FEEDS) return state;
  const fed = new Set(state.feeds.flatMap((f) => f.screenIds));
  let n = state.feeds.length + 1;
  while (state.feeds.some((f) => f.id === `feed-${n}`)) n++;
  const feed: FeedPoint = { id: `feed-${n}`, x: tidy(state.width / 2), z: Math.min(FEED_Z_M, state.depth / 2), screenIds: screenIds.filter((id) => !fed.has(id)) };
  return { ...state, feeds: [...state.feeds, feed] };
}

export function removeFeed(state: StageState, id: string): StageState {
  return { ...state, feeds: state.feeds.filter((f) => f.id !== id) };
}

/** A moved feed point: snapped like a screen and kept on the stage. */
export function moveFeed(state: StageState, id: string, x: number, z: number, free = false): StageState {
  const fix = (v: number, max: number) => tidy(clamp(free ? v : round(v, POSITION_STEP_M), 0, max));
  return { ...state, feeds: state.feeds.map((f) => (f.id === id ? { ...f, x: fix(x, state.width), z: fix(z, state.depth) } : f)) };
}

/** Feed a screen from this box (it leaves any other one), or stop feeding it. */
export function setFeedScreen(state: StageState, feedId: string, screenId: string, fed: boolean): StageState {
  return {
    ...state,
    feeds: state.feeds.map((f) => {
      const others = f.screenIds.filter((id) => id !== screenId);
      return { ...f, screenIds: f.id === feedId && fed ? [...others, screenId] : others };
    }),
  };
}

/** The processor point: placed at the front centre (front of house), moved like a screen, or taken away. */
export function placeProcessor(state: StageState, at: { x: number; z: number } | null, free = false): StageState {
  if (!at) return { ...state, processorPoint: null };
  const fix = (v: number, max: number) => tidy(clamp(free ? v : round(v, POSITION_STEP_M), 0, max));
  return { ...state, processorPoint: { x: fix(at.x, state.width), z: fix(at.z, state.depth) } };
}

/** The box feeding a screen, if any. */
export function feedOf(state: StageState, screenId: string): FeedPoint | undefined {
  return state.feeds.find((f) => f.screenIds.includes(screenId));
}

/** The four corners of a screen seen from above (back-left, back-right, front-right, front-left), metres. */
export function footprint(screen: Pick<StageScreen, "widthM" | "placement">, depthM = SCREEN_DEPTH_M): [number, number][] {
  const { x, z, rotationDeg } = screen.placement;
  const a = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const hw = screen.widthM / 2;
  const hd = depthM / 2;
  return (
    [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ] as [number, number][]
  ).map(([dx, dz]) => [x + dx * cos - dz * sin, z + dx * sin + dz * cos]);
}

/** The screen's face as the audience sees it (front view): left / right edge after rotation, metres. */
export function frontSpan(screen: Pick<StageScreen, "widthM" | "placement">): { left: number; right: number } {
  const half = (Math.abs(Math.cos((screen.placement.rotationDeg * Math.PI) / 180)) * screen.widthM) / 2;
  return { left: screen.placement.x - half, right: screen.placement.x + half };
}

/** Angle (degrees, our rotation convention) from the screen's centre towards a point — for the rotate handle. */
export function angleTowards(placement: Pick<StagePlacement, "x" | "z">, px: number, pz: number): number {
  return normalizeAngle((Math.atan2(pz - placement.z, px - placement.x) * 180) / Math.PI);
}

/** The screens the stage shows: those with a panel, in list order, with their placement. */
export function stageScreens(
  screens: WallConfig[],
  state: StageState,
  nameOf: (wall: WallConfig) => string,
  allowShape = true,
): StageScreen[] {
  return screens.flatMap((wall) => {
    const size = screenSizeM(wall);
    const placement = state.placements[wall.id];
    if (!size || !placement) return [];
    const shape = fitShape(wall, allowShape);
    return [
      {
        id: wall.id,
        name: nameOf(wall),
        ...size,
        columns: wall.widthPanels,
        rows: wall.heightPanels,
        columnWidthsM: columnWidthsM(wall, shape.corners),
        cutouts: shape.cutouts,
        cornerColumns: shape.corners.map((c) => c.afterColumn),
        placement,
      },
    ];
  });
}
