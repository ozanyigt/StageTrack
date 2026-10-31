import type { WiredCircuitDto } from "../../../../api/ledTypes";
import type { PowerLayout, SignalLayout, WallConfig } from "../types";
import { facePoints } from "./curve";
import { SCREEN_DEPTH_M, type FeedPoint, type StageScreen } from "./stage";

/**
 * Simülasyon power wiring: the screen's power layout (sent to the server, which wires the circuits) and the
 * geometry the views draw the circuit map and the cables with. The server's map lists each circuit's panels
 * in chain order; a panel is `column × rows + row` (column 0 = left as the audience sees it, row 0 = bottom).
 */

export const DEFAULT_POWER_LAYOUT: PowerLayout = { direction: "Columns", start: "BottomLeft", keepLinesWhole: false, serpentine: true };

export const DIRECTIONS: readonly PowerLayout["direction"][] = ["Columns", "Rows"];
export const STARTS: readonly PowerLayout["start"][] = ["BottomLeft", "BottomRight", "TopLeft", "TopRight"];

/** A screen's layout, anything unknown at its default. */
export function powerLayoutOf(wall: Pick<WallConfig, "powerLayout">): PowerLayout {
  const l = wall.powerLayout;
  return {
    direction: l && DIRECTIONS.includes(l.direction) ? l.direction : DEFAULT_POWER_LAYOUT.direction,
    start: l && STARTS.includes(l.start) ? l.start : DEFAULT_POWER_LAYOUT.start,
    keepLinesWhole: l?.keepLinesWhole === true,
    serpentine: l?.serpentine !== false,
  };
}

/** A screen's own signal layout, checked; null = none (the chains follow the power wiring). */
export function signalLayoutOf(wall: Pick<WallConfig, "signalLayout">): SignalLayout | null {
  const l = wall.signalLayout;
  if (!l || typeof l !== "object" || !DIRECTIONS.includes(l.direction) || !STARTS.includes(l.start)) return null;
  return { direction: l.direction, start: l.start, serpentine: l.serpentine !== false };
}

/** The signal layout as the request carries it: only when set, and only with maps. */
export function signalLayoutToSend(wall: Pick<WallConfig, "signalLayout">, allowMaps: boolean): SignalLayout | null {
  return allowMaps ? signalLayoutOf(wall) : null;
}

export function isDefaultLayout(layout: PowerLayout): boolean {
  return (
    layout.direction === DEFAULT_POWER_LAYOUT.direction &&
    layout.start === DEFAULT_POWER_LAYOUT.start &&
    layout.keepLinesWhole === DEFAULT_POWER_LAYOUT.keepLinesWhole &&
    layout.serpentine !== false
  );
}

/** The layout as the request carries it: only when not the default, and only with maps (the server refuses it otherwise). */
export function layoutToSend(wall: Pick<WallConfig, "powerLayout">, allowMaps: boolean): PowerLayout | null {
  if (!allowMaps) return null;
  const layout = powerLayoutOf(wall);
  return isDefaultLayout(layout) ? null : layout;
}

export function cellOf(cell: number, rows: number): { column: number; row: number } {
  return { column: Math.floor(cell / rows), row: cell % rows };
}

export interface Point {
  x: number;
  z: number;
}

/**
 * Where a cable reaches a column of a screen, seen from above: the column's centre on the back of the screen
 * (cables run behind it) — on a curved screen the back of that panel where it really stands.
 */
export function entryPoint(screen: Pick<StageScreen, "columnWidthsM" | "placement" | "jointAnglesDeg">, column: number): Point {
  const face = facePoints(screen);
  const a = face[Math.min(column, face.length - 1)];
  const b = face[Math.min(column + 1, face.length - 1)];
  const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  // The panel's back: its direction turned a quarter towards the back wall.
  const back = { x: (b.z - a.z) / length, z: -(b.x - a.x) / length };
  return { x: (a.x + b.x) / 2 + (back.x * SCREEN_DEPTH_M) / 2, z: (a.z + b.z) / 2 + (back.z * SCREEN_DEPTH_M) / 2 };
}

export interface CableRoute {
  circuit: number;
  /** Feed → (feed x, entry z) → entry, seen from above: along the depth first, then across. */
  points: Point[];
  /** Floor run plus the rise to the circuit's first panel, metres. */
  lengthM: number;
}

/**
 * The cable of each circuit from the feed point to the circuit's first panel, at right angles on the floor, then up
 * the screen to that panel (its elevation plus the rows below it). An estimate for planning, not a cut length.
 */
export function cableRoutes<T extends Pick<WiredCircuitDto, "index" | "cells">>(feed: Pick<FeedPoint, "x" | "z">, screen: StageScreen, circuits: T[]): CableRoute[] {
  const rowH = screen.heightM / Math.max(1, screen.rows);
  return circuits.flatMap((circuit) => {
    if (circuit.cells.length === 0) return [];
    const { column, row } = cellOf(circuit.cells[0], screen.rows);
    const entry = entryPoint(screen, column);
    const rise = screen.placement.elevationM + (row + 0.5) * rowH;
    return [
      {
        circuit: circuit.index,
        points: [{ x: feed.x, z: feed.z }, { x: feed.x, z: entry.z }, entry],
        lengthM: Math.abs(entry.z - feed.z) + Math.abs(entry.x - feed.x) + rise,
      },
    ];
  });
}
