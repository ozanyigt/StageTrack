import type { ScreenEvaluationDto } from "../../../../api/ledTypes";
import { cutCells } from "../cutCells";
import { parsePanelBoyut } from "../panel";
import type { PixelMapState } from "../pixelMap";
import { facePoints } from "../simulation/curve";
import { columnWidthsM, fitShape } from "../simulation/shape";
import type { InventoryItem, WallConfig } from "../types";

/**
 * 3D Sahne: the Pixel Map's screens in metres. One way only — Pixel Map → 3D: the shared screens with a panel, in the
 * Pixel Map's order, at the Pixel Map's place (pixels turned into metres with each screen's own panel). Manual
 * screens are not here (no panel of ours). Curves, power and circuits come from the server's calculation.
 */

export interface Stage3DScreen {
  id: string;
  name: string;
  color: string;
  panel: InventoryItem;
  columns: number;
  rows: number;
  /** Width of every column (a corner column has its own panel's width), metres. */
  columnWidthsM: number[];
  panelHeightM: number;
  /** Panels taken out (cells: column × rows + row, row 0 = bottom); drawn empty. */
  cut: ReadonlySet<number>;
  widthM: number;
  heightM: number;
  /** Left edge from the composition's left, top edge from its top, metres (as on the Pixel Map). */
  xM: number;
  yM: number;
  resolution: { width: number; height: number };
  /** The angle at every joint between two columns (+ concave, − convex); missing = flat. */
  jointAnglesDeg?: number[];
  curveRadiusM?: number | null;
}

export interface Stage3DLayout {
  screens: Stage3DScreen[];
  /** Screens of different pitch overlapped in metres: they were laid side by side instead (the page says so). */
  sideBySide: boolean;
}

const panelMm = (panel: InventoryItem) => {
  try {
    return parsePanelBoyut(panel.Panel_Boyut);
  } catch {
    return null;
  }
};

/** Tolerance for "overlap" in metres: screens edge to edge must not count. */
const EPS = 1e-6;
const overlaps = (a: Stage3DScreen, b: Stage3DScreen) =>
  a.xM < b.xM + b.widthM - EPS && b.xM < a.xM + a.widthM - EPS && a.yM < b.yM + b.heightM - EPS && b.yM < a.yM + a.heightM - EPS;

/**
 * The shared screens on the Pixel Map as 3D screens. Positions: pixels ÷ the module's pixels × the panel's mm. Screens
 * that overlap in metres (different pitch) are laid side by side, tops aligned, in the order.
 */
export function stage3dScreens(
  walls: WallConfig[],
  map: PixelMapState,
  evaluation: ScreenEvaluationDto[] | undefined,
  nameOf: (wall: WallConfig) => string,
  /** ScreenShape.Use: cut-outs and corner columns count (as on every page). */
  allowShape: boolean,
): Stage3DLayout {
  const byId = new Map(walls.map((w) => [w.id, w]));
  const screens = map.order.flatMap((id): Stage3DScreen[] => {
    const wall = byId.get(id);
    const layout = map.layouts[id];
    if (!wall?.panel || !layout) return [];
    const mm = panelMm(wall.panel);
    if (!mm) return [];
    const { cutouts, corners } = fitShape(wall, allowShape);
    const widths = columnWidthsM(wall, corners);
    const panelWidthM = mm.widthMm / 1000;
    const panelHeightM = mm.heightMm / 1000;
    const curve = evaluation?.find((e) => e.id === id)?.curve;
    return [
      {
        id,
        name: nameOf(wall),
        color: layout.color,
        panel: wall.panel,
        columns: wall.widthPanels,
        rows: wall.heightPanels,
        columnWidthsM: widths,
        panelHeightM,
        cut: cutCells(wall.widthPanels, wall.heightPanels, cutouts),
        widthM: widths.reduce((sum, w) => sum + w, 0),
        heightM: wall.heightPanels * panelHeightM,
        xM: (layout.x / wall.panel.Piksel_G) * panelWidthM,
        yM: (layout.y / wall.panel.Piksel_Y) * panelHeightM,
        resolution: { width: wall.widthPanels * wall.panel.Piksel_G, height: wall.heightPanels * wall.panel.Piksel_Y },
        ...(curve && curve.jointAnglesDeg.some((a) => a !== 0) ? { jointAnglesDeg: curve.jointAnglesDeg, curveRadiusM: curve.achievedRadiusM } : {}),
      },
    ];
  });

  const sizes = new Set(screens.map((s) => `${s.panel.Piksel_G}/${s.columnWidthsM[0]}:${s.panel.Piksel_Y}/${s.panelHeightM}`));
  const clash = sizes.size > 1 && screens.some((a, i) => screens.slice(i + 1).some((b) => overlaps(a, b)));
  if (!clash) return { screens, sideBySide: false };
  let x = 0;
  return {
    screens: screens.map((s) => {
      const placed = { ...s, xM: x, yM: 0 };
      x += s.widthM;
      return placed;
    }),
    sideBySide: true,
  };
}

/** The composition in metres: its width and height (0 × 0 without screens). */
export function compositionSize(screens: Pick<Stage3DScreen, "xM" | "yM" | "widthM" | "heightM">[]): { widthM: number; heightM: number } {
  return {
    widthM: Math.max(0, ...screens.map((s) => s.xM + s.widthM)),
    heightM: Math.max(0, ...screens.map((s) => s.yM + s.heightM)),
  };
}

/** One panel as drawn: its centre in the world (metres; y up, +z towards the audience), its turn about y, its size. */
export interface PanelPlacement {
  cell: number;
  x: number;
  y: number;
  z: number;
  /** Radians about the vertical axis. */
  yaw: number;
  width: number;
  height: number;
}

/**
 * Every panel of a screen in the world (cut panels left out). `at`: the screen's middle on x, its face's line on z and
 * its turn; `bottom` its bottom edge's height. A curved screen turns at every joint as Simülasyon draws it from above
 * (the ends' midpoint on the screen's place).
 */
export function panelPlacements(screen: Stage3DScreen, at: { x: number; z: number; rotationDeg: number }, bottom: number): PanelPlacement[] {
  const points = facePoints({ columnWidthsM: screen.columnWidthsM, jointAnglesDeg: screen.jointAnglesDeg, placement: { ...at, elevationM: 0 } });
  const out: PanelPlacement[] = [];
  for (let col = 0; col < screen.columns; col++) {
    const a = points[col];
    const b = points[col + 1];
    if (!a || !b) break;
    const yaw = -Math.atan2(b.z - a.z, b.x - a.x);
    for (let row = 0; row < screen.rows; row++) {
      const cell = col * screen.rows + row;
      if (screen.cut.has(cell)) continue;
      out.push({
        cell,
        x: (a.x + b.x) / 2,
        y: bottom + (row + 0.5) * screen.panelHeightM,
        z: (a.z + b.z) / 2,
        yaw,
        width: screen.columnWidthsM[col],
        height: screen.panelHeightM,
      });
    }
  }
  return out;
}
