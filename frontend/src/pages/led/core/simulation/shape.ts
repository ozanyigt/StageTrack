import { parsePanelBoyut } from "../panel";
import type { Cutout, ScreenCorner, WallConfig } from "../types";

/**
 * A screen's shape on the client: cut-outs, corner columns. The server calculates with them
 * (POST /api/calc/evaluate) and rejects a shape that does not fit; these helpers keep what the user edits
 * inside the screen (a smaller screen must not break the whole calculation) and give the views the cells.
 * Cells: column 0 = left, row 0 = bottom; the column count includes the corner columns.
 */

export const MAX_CUTOUTS = 50;
export const MAX_CORNERS = 20;

const clampInt = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(v) ? v : min)));

/** A cut-out moved / shrunk to lie inside a columns × rows screen (at least 1 × 1). */
export function clampCutout(cut: Cutout, columns: number, rows: number): Cutout {
  const width = clampInt(cut.width, 1, Math.max(1, columns));
  const height = clampInt(cut.height, 1, Math.max(1, rows));
  return {
    width,
    height,
    left: clampInt(cut.left, 0, Math.max(0, columns - width)),
    bottom: clampInt(cut.bottom, 0, Math.max(0, rows - height)),
  };
}

/** The same cut-out, centred horizontally. */
export function centreCutout(cut: Cutout, columns: number): Cutout {
  return { ...cut, left: Math.max(0, Math.floor((columns - cut.width) / 2)) };
}

/** A new cut-out: 2 × 1 panels (or what fits) centred at the bottom — a podium-like gap. */
export function newCutout(columns: number, rows: number): Cutout {
  return centreCutout(clampCutout({ width: Math.min(2, columns), height: 1, left: 0, bottom: 0 }, columns, rows), columns);
}

/** used[column][row]: false where a cut-out lies (overlapping cut-outs count once). */
export function usedCells(columns: number, rows: number, cutouts: Cutout[]): boolean[][] {
  const used = Array.from({ length: Math.max(0, columns) }, () => Array<boolean>(Math.max(0, rows)).fill(true));
  for (const cut of cutouts)
    for (let c = cut.left; c < cut.left + cut.width && c < columns; c++)
      for (let r = cut.bottom; r < cut.bottom + cut.height && r < rows; r++) if (c >= 0 && r >= 0) used[c][r] = false;
  return used;
}

export function usedCount(columns: number, rows: number, cutouts: Cutout[]): number {
  return usedCells(columns, rows, cutouts).reduce((sum, col) => sum + col.filter(Boolean).length, 0);
}

/** A free place for a new corner column: the middle if free, else the nearest free one; null when none. */
export function freeCornerColumn(columns: number, corners: ScreenCorner[]): number | null {
  const taken = new Set(corners.map((c) => c.afterColumn));
  const middle = Math.floor(columns / 2);
  for (let d = 0; d < columns; d++)
    for (const a of [middle - d, middle + d]) if (a >= 1 && a <= columns - 1 && !taken.has(a)) return a;
  return null;
}

/**
 * The shape as it can be sent: cut-outs pulled inside the screen, corner columns between two columns (one per
 * place); cut-outs that would cover every panel are left out (the editor warns). Without the plan feature
 * (Demo) cut-outs and corners are not sent at all — the server would refuse the calculation.
 */
export function fitShape(wall: WallConfig, allowShape: boolean): { cutouts: Cutout[]; corners: ScreenCorner[] } {
  const columns = wall.widthPanels;
  const rows = wall.heightPanels;
  if (!allowShape || columns < 1 || rows < 1) return { cutouts: [], corners: [] };
  let cutouts = (wall.cutouts ?? []).slice(0, MAX_CUTOUTS).map((c) => clampCutout(c, columns, rows));
  if (cutouts.length > 0 && usedCount(columns, rows, cutouts) === 0) cutouts = [];
  const seen = new Set<number>();
  const corners = (wall.corners ?? []).slice(0, MAX_CORNERS).filter((c) => {
    const ok = c.afterColumn >= 1 && c.afterColumn <= columns - 1 && !seen.has(c.afterColumn);
    seen.add(c.afterColumn);
    return ok;
  });
  return { cutouts, corners };
}

/** Width of every column in metres: the corner model's width in a corner column, the panel's elsewhere. */
export function columnWidthsM(wall: WallConfig, corners: ScreenCorner[]): number[] {
  if (!wall.panel) return [];
  const main = parsePanelBoyut(wall.panel.Panel_Boyut).widthMm / 1000;
  const widths = Array<number>(Math.max(0, wall.widthPanels)).fill(main);
  for (const corner of corners) if (corner.afterColumn < widths.length) widths[corner.afterColumn] = parsePanelBoyut(corner.panel.Panel_Boyut).widthMm / 1000;
  return widths;
}
