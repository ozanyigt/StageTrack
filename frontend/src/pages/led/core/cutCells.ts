import { clampCutout, MAX_CUTOUTS, usedCells } from "./simulation/shape";
import type { Cutout, WallConfig } from "./types";

/**
 * Panels taken out of a screen (a door, a window, a column in the wall), picked panel by panel on Pixel Map. They are
 * stored as the screen's cut-out rectangles — what the calculation counts with (panels, m², power, signal) — and
 * edited here as single panels. A cell is `column × rows + row` (column 0 = left, row 0 = bottom).
 */

/** Stored cut-out rectangles (a manual Pixel Map screen's, from localStorage / a link): whole numbers only, at most MAX_CUTOUTS. */
export function sanitizeCutouts(raw: unknown): Cutout[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Cutout => typeof c === "object" && c !== null && [c.width, c.height, c.left, c.bottom].every((v) => Number.isInteger(v)))
    .filter((c) => c.width > 0 && c.height > 0 && c.left >= 0 && c.bottom >= 0)
    .slice(0, MAX_CUTOUTS)
    .map(({ width, height, left, bottom }) => ({ width, height, left, bottom }));
}

/** The cut cells of a screen. */
export function cutCells(columns: number, rows: number, cutouts: Cutout[] | undefined): Set<number> {
  const used = usedCells(columns, rows, (cutouts ?? []).map((c) => clampCutout(c, columns, rows)));
  const cut = new Set<number>();
  for (let c = 0; c < columns; c++) for (let r = 0; r < rows; r++) if (!used[c][r]) cut.add(c * rows + r);
  return cut;
}

/** The cut cells as few rectangles as a simple sweep finds: each grows right, then up, over cells not yet taken. */
export function cutoutsFromCells(columns: number, rows: number, cut: Set<number>): Cutout[] {
  const taken = new Set<number>();
  const free = (c: number, r: number) => c < columns && r < rows && cut.has(c * rows + r) && !taken.has(c * rows + r);
  const out: Cutout[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      if (!free(c, r)) continue;
      let width = 1;
      while (free(c + width, r)) width++;
      let height = 1;
      while (Array.from({ length: width }, (_, i) => free(c + i, r + height)).every(Boolean)) height++;
      for (let i = 0; i < width; i++) for (let j = 0; j < height; j++) taken.add((c + i) * rows + r + j);
      out.push({ width, height, left: c, bottom: r });
    }
  return out;
}

export type CutResult = { cutouts: Cutout[] } | { error: "all" | "tooMany" };

/**
 * The chosen panels taken out, or put back when every one of them is out already (clicking a cut panel again brings
 * it back). Never every panel of the screen ("all"), never more rectangles than the calculation takes ("tooMany").
 */
export function toggleCut(wall: Pick<WallConfig, "widthPanels" | "heightPanels" | "cutouts">, cells: number[]): CutResult {
  const columns = wall.widthPanels;
  const rows = wall.heightPanels;
  const cut = cutCells(columns, rows, wall.cutouts);
  const valid = cells.filter((cell) => cell >= 0 && cell < columns * rows);
  const restore = valid.length > 0 && valid.every((cell) => cut.has(cell));
  for (const cell of valid) {
    if (restore) cut.delete(cell);
    else cut.add(cell);
  }
  if (cut.size >= columns * rows) return { error: "all" };
  const cutouts = cutoutsFromCells(columns, rows, cut);
  return cutouts.length > MAX_CUTOUTS ? { error: "tooMany" } : { cutouts };
}

/** The cells of a block of panels given by two corner panels (columns, rows from the bottom), both included. */
export function cellsBetween(a: { column: number; row: number }, b: { column: number; row: number }, rows: number): number[] {
  const cells: number[] = [];
  for (let c = Math.min(a.column, b.column); c <= Math.max(a.column, b.column); c++)
    for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) cells.push(c * rows + r);
  return cells;
}
