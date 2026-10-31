import { formatNumber } from "./format";
import { parsePanelBoyut } from "./panel";
import type { Cutout, Dil, PanelSize, WallConfig } from "./types";
import { panelsToMeters } from "./wallSize";

import { cutCells, sanitizeCutouts } from "./cutCells";
import { groupOf, groupStep, reconcileGroups, sanitizeGroups, type PixelGroup } from "./pixelGroups";

/**
 * Pixel Map: where each screen sits in the media-server composition (in
 * pixels). Pure functions only — the page (pages/PixelMapPage.tsx) and the
 * canvas drawing (lib/pixelMapDraw.ts) build on these.
 */

/** Position / colour / logo / panel codes of one screen on the map, keyed by screen id. */
export interface PixelLayout {
  x: number;
  y: number;
  color: string;
  logo: boolean;
  /** "Panel No": each module shows its code (row letter + column number: A1, A2, …; lib/panelCode.ts). Off on older saves. */
  panelNo: boolean;
  /** "Tip": every panel shows its type (Flat, Curve, …) in its top-right corner; shared screens only. Off on older saves. */
  tip: boolean;
}

/**
 * A screen that only exists on the Pixel Map (a panel we don't have) — never in the power / processor calculation.
 * Its size is in panels like a shared screen's; the panel size (mm) is optional and only gives the metres.
 * Stored before as `cols` / `rows` (read as the panel counts by sanitizePixelMapState).
 */
export interface ManualScreen {
  id: string;
  name: string;
  moduleW: number;
  moduleH: number;
  widthPanels: number;
  heightPanels: number;
  /** Panel width / height in mm; null = not entered (no metres). */
  panelWidthMm: number | null;
  panelHeightMm: number | null;
  /** Panels taken out (as on a shared screen: shown on the map and in Simülasyon); missing = none. */
  cutouts?: Cutout[];
}

/**
 * A new manual screen's panel size (mm), so its metres work right away. Only new screens get it: stored ones
 * without a panel size (localStorage, share links) stay blank.
 */
export const DEFAULT_MANUAL_PANEL_MM = 500;

export interface PixelMapView {
  showModuleBorders: boolean;
  showDiagonals: boolean;
  showCenterCross: boolean;
  /** 0.5 – 2.0 */
  labelScale: number;
  /** 0.5 – 2.0 */
  logoScale: number;
}

export interface PixelMapState {
  layouts: Record<string, PixelLayout>;
  manual: ManualScreen[];
  /** Screen ids in the order they first appeared on the map (the card order). */
  order: string[];
  view: PixelMapView;
  /** Merged screens ("Birleştir"); missing on older saves = none. */
  groups: PixelGroup[];
}

/** One screen as the map draws it. */
export interface PixelScreen {
  id: string;
  name: string;
  manual: boolean;
  moduleW: number;
  moduleH: number;
  /** Panels across / down (a module is one panel). */
  cols: number;
  rows: number;
  /** The panel's size, for the metres; null when unknown (a manual screen without one). */
  panelSize: PanelSize | null;
  /** Lines added under the label's position line (pixels, metres), in the page's language. */
  info?: string[];
  /** The panel's type ("Flat", "Curve", …); null on a manual screen (no panel of ours). */
  panelType: string | null;
  /** Panels taken out (cells: column × rows + row, row 0 = bottom); missing = none. */
  cut?: ReadonlySet<number>;
  /** cols × moduleW, rows × moduleH */
  width: number;
  height: number;
  x: number;
  y: number;
  color: string;
  logo: boolean;
  panelNo: boolean;
  tip: boolean;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Ten colours that stay apart from each other on black. */
export const PIXEL_MAP_PALETTE = [
  "#e6194b",
  "#3cb44b",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#ffe119",
  "#f032e6",
  "#469990",
  "#bfef45",
  "#9a6324",
] as const;

export const DEFAULT_PIXEL_MAP_VIEW: PixelMapView = {
  showModuleBorders: true,
  showDiagonals: true,
  showCenterCross: true,
  labelScale: 1,
  logoScale: 1,
};

export const DEFAULT_PIXEL_MAP_STATE: PixelMapState = { layouts: {}, manual: [], order: [], view: DEFAULT_PIXEL_MAP_VIEW, groups: [] };

export const SCALE_MIN = 0.5;
export const SCALE_MAX = 2;
/** Upper bounds for typed values, so a typo can't build a million-module screen. */
export const MAX_MODULE_PX = 8192;
export const MAX_MODULE_COUNT = 1000;
/** Largest panel side a manual screen may be given, mm. */
export const MAX_PANEL_MM = 10_000;
export const MAX_POSITION = 1_000_000;
/** Snap distance in screen pixels (divided by the zoom, so it feels the same at any zoom). */
export const SNAP_SCREEN_PX = 10;

/** Largest tile side when a map too large for one canvas is exported in pieces. */
export const EXPORT_TILE_MAX = 8192;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Position on the map: whole pixels, never below 0. */
export function clampPosition(x: number, y: number): { x: number; y: number } {
  const fix = (v: number) => (Number.isFinite(v) ? clamp(Math.round(v), 0, MAX_POSITION) : 0);
  return { x: fix(x), y: fix(y) };
}

/**
 * A screen moved to x, y (whole pixels, ≥ 0); a member of a merged screen moves its whole group by as much, the
 * group kept at x, y ≥ 0. Pixel Map and Simülasyon both move screens with it. Same object when nothing moves.
 */
export function moveOnMap(state: PixelMapState, id: string, x: number, y: number): PixelMapState {
  const layout = state.layouts[id];
  if (!layout) return state;
  const to = clampPosition(x, y);
  const group = groupOf(state.groups ?? [], id);
  if (!group) return to.x === layout.x && to.y === layout.y ? state : { ...state, layouts: { ...state.layouts, [id]: { ...layout, ...to } } };
  const members = group.members.flatMap((m) => (state.layouts[m] ? [{ id: m, ...state.layouts[m], width: 0, height: 0 }] : []));
  const { dx, dy } = groupStep(members, layout, to);
  if (dx === 0 && dy === 0) return state;
  const layouts = { ...state.layouts };
  for (const m of members) layouts[m.id] = { ...layouts[m.id], ...clampPosition(m.x + dx, m.y + dy) };
  return { ...state, layouts };
}

/** A screen's panels taken out, when it has any (they are drawn empty). */
function cutOf(s: Pick<WallConfig, "widthPanels" | "heightPanels" | "cutouts">): { cut?: ReadonlySet<number> } {
  const cut = cutCells(s.widthPanels, s.heightPanels, s.cutouts);
  return cut.size > 0 ? { cut } : {};
}

/** Shared screens with a panel, as map sources (screens without a panel are not on the map). */
export function sharedSources(screens: WallConfig[], nameOf: (wall: WallConfig) => string) {
  return screens
    .filter((s) => s.panel)
    .map((s) => ({
      id: s.id,
      name: nameOf(s),
      manual: false,
      moduleW: s.panel!.Piksel_G,
      moduleH: s.panel!.Piksel_Y,
      cols: s.widthPanels,
      rows: s.heightPanels,
      ...cutOf(s),
      panelSize: panelSizeOf(s.panel!.Panel_Boyut) as PanelSize | null,
      panelType: s.panel!.Tip as string | null,
    }));
}

function panelSizeOf(boyut: string): PanelSize | null {
  try {
    return parsePanelBoyut(boyut);
  } catch {
    return null;
  }
}

/** A manual screen's panel size, when both sides are entered. */
export function manualPanelSize(m: Pick<ManualScreen, "panelWidthMm" | "panelHeightMm">): PanelSize | null {
  return m.panelWidthMm && m.panelHeightMm ? { widthMm: m.panelWidthMm, heightMm: m.panelHeightMm } : null;
}

export type PixelSource = ReturnType<typeof sharedSources>[number];

export function manualSources(manual: ManualScreen[]): PixelSource[] {
  return manual.map((m) => ({
    id: m.id,
    name: m.name,
    manual: true,
    moduleW: m.moduleW,
    moduleH: m.moduleH,
    cols: m.widthPanels,
    rows: m.heightPanels,
    panelSize: manualPanelSize(m),
    panelType: null,
    ...cutOf(m),
  }));
}

/**
 * "0,50 m × 1,00 m" (TR) / "0.50 m × 1.00 m" (EN): the screen's metres, 2 decimals in the language's format;
 * null when there is no panel size to count with.
 */
export function metrajText(screen: Pick<PixelScreen, "cols" | "rows" | "panelSize">, lang: Dil): string | null {
  if (!screen.panelSize) return null;
  const m = (panels: number, mm: number) => `${formatNumber(panelsToMeters(panels, mm), lang, 2)} m`;
  return `${m(screen.cols, screen.panelSize.widthMm)} × ${m(screen.rows, screen.panelSize.heightMm)}`;
}

/**
 * The label lines under the position line: "Piksel: 256 × 512", "Metraj: 0,50 m × 1,00 m" (or "Metraj: –"). The
 * panel type ("Tip") is written on the panels themselves, not here.
 */
export function labelInfo(
  screen: Pick<PixelScreen, "width" | "height" | "cols" | "rows" | "panelSize">,
  t: (key: string, vars?: Record<string, string | number>) => string,
  lang: Dil,
): string[] {
  const size = metrajText(screen, lang);
  return [
    t("pixel.label.pixels", { w: screen.width, h: screen.height }),
    size ? t("pixel.label.size", { size }) : t("pixel.label.sizeUnknown"),
  ];
}

/**
 * Brings the map state up to date with the screens that exist now:
 * a screen seen for the first time is appended to the order and placed right
 * of everything already on the map, at y = 0 with no gap; it gets the first
 * palette colour not in use, and the logo only when it is the first screen
 * in the list. Screens already placed keep their position (only their size
 * follows cols / rows). Layouts of screens that no longer exist at all
 * (`knownIds`) are dropped. Returns `state` itself when nothing changed.
 */
export function reconcilePixelMap(state: PixelMapState, sources: Pick<PixelSource, "id" | "moduleW" | "moduleH" | "cols" | "rows">[], knownIds: string[]): PixelMapState {
  const known = new Set([...knownIds, ...sources.map((s) => s.id)]);
  let changed = false;
  const layouts: Record<string, PixelLayout> = {};
  for (const [id, layout] of Object.entries(state.layouts)) {
    if (known.has(id)) layouts[id] = layout;
    else changed = true;
  }
  let order = state.order.filter((id) => known.has(id));
  if (order.length !== state.order.length) changed = true;

  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const visible = () => order.filter((id) => sourceById.has(id) && layouts[id]);

  for (const source of sources) {
    if (layouts[source.id]) {
      if (!order.includes(source.id)) {
        order = [...order, source.id];
        changed = true;
      }
      continue;
    }
    const onMap = visible();
    const right = Math.max(
      0,
      ...onMap.map((id) => {
        const s = sourceById.get(id)!;
        return layouts[id].x + s.cols * s.moduleW;
      }),
    );
    const used = new Set(onMap.map((id) => layouts[id].color));
    const color = PIXEL_MAP_PALETTE.find((c) => !used.has(c)) ?? PIXEL_MAP_PALETTE[onMap.length % PIXEL_MAP_PALETTE.length];
    layouts[source.id] = { x: right, y: 0, color, logo: onMap.length === 0, panelNo: false, tip: false };
    order = [...order.filter((id) => id !== source.id), source.id];
    changed = true;
  }

  // A group keeps only the screens that still exist; one left with a single screen is undone.
  const groups = reconcileGroups(state.groups ?? [], (id) => known.has(id));
  if (groups !== state.groups) changed = true;

  return changed ? { ...state, layouts, order, groups } : state;
}

/** The map's screens in card order (only screens that have a source and a layout). */
export function resolvePixelScreens(state: PixelMapState, sources: PixelSource[]): PixelScreen[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  return state.order.flatMap((id) => {
    const source = byId.get(id);
    const layout = state.layouts[id];
    if (!source || !layout) return [];
    return [{ ...source, ...layout, width: source.cols * source.moduleW, height: source.rows * source.moduleH }];
  });
}

/** Composition size: the right-most and bottom-most screen edges (0 × 0 with no screens). */
export function totalArea(screens: Rect[]): { width: number; height: number } {
  return {
    width: Math.max(0, ...screens.map((s) => s.x + s.width)),
    height: Math.max(0, ...screens.map((s) => s.y + s.height)),
  };
}

export interface SnapResult {
  x: number;
  y: number;
  /** Lines (map x / y) the screen snapped to — drawn as guides while dragging. */
  guidesX: number[];
  guidesY: number[];
}

/**
 * Snaps a screen being dragged to `x, y`: its left / centre / right (and top /
 * centre / bottom) snap to the other screens' edges and centres and to the
 * origin axes (x = 0, y = 0) when within `threshold` map pixels. `disabled`
 * (Shift held) skips snapping. The result is whole pixels, never below 0.
 */
export function snapPosition(
  moving: { x: number; y: number; width: number; height: number },
  others: Rect[],
  threshold: number,
  disabled = false,
): SnapResult {
  if (disabled) return { ...clampPosition(moving.x, moving.y), guidesX: [], guidesY: [] };

  const targetsX = [0, ...others.flatMap((o) => [o.x, o.x + o.width / 2, o.x + o.width])];
  const targetsY = [0, ...others.flatMap((o) => [o.y, o.y + o.height / 2, o.y + o.height])];
  const axis = (pos: number, size: number, targets: number[]) => {
    let best: { pos: number; line: number; dist: number } | null = null;
    for (const offset of [0, size / 2, size]) {
      for (const target of targets) {
        const dist = Math.abs(pos + offset - target);
        if (dist <= threshold && (!best || dist < best.dist)) best = { pos: target - offset, line: target, dist };
      }
    }
    return best;
  };

  const sx = axis(moving.x, moving.width, targetsX);
  const sy = axis(moving.y, moving.height, targetsY);
  const { x, y } = clampPosition(sx ? sx.pos : moving.x, sy ? sy.pos : moving.y);
  return { x, y, guidesX: sx ? [sx.line] : [], guidesY: sy ? [sy.line] : [] };
}

/** One piece of a tiled export; row / col start at 1. */
export interface ExportTile {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Splits width × height into tiles of at most tileMax × tileMax, row by row (the last row / column is the remainder). */
export function planTiles(width: number, height: number, tileMax = EXPORT_TILE_MAX): ExportTile[] {
  const tiles: ExportTile[] = [];
  for (let y = 0, row = 1; y < height; y += tileMax, row++) {
    for (let x = 0, col = 1; x < width; x += tileMax, col++) {
      tiles.push({ row, col, x, y, width: Math.min(tileMax, width - x), height: Math.min(tileMax, height - y) });
    }
  }
  return tiles;
}

/** LED_PixelMap_tile_r1c2_x8192_y0.jpg */
export function tileFileName(tile: ExportTile, ext: "jpg" | "png"): string {
  return `LED_PixelMap_tile_r${tile.row}c${tile.col}_x${tile.x}_y${tile.y}.${ext}`;
}

export function exportFileName(width: number, height: number, ext: "jpg" | "png" | "zip" | "xml"): string {
  return `LED_PixelMap_${width}x${height}.${ext}`;
}

/** Base colour darkened by `amount` (0 – 1): the 0 / 20 / 40 % module shades. */
export function darken(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((n >> shift) & 255) * (1 - amount))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

export const MODULE_SHADES = [0, 0.2, 0.4] as const;

// ---------------------------------------------------------------------------
// State coming from localStorage or a share link: never trust its shape.

const HEX = /^#[0-9a-fA-F]{6}$/;

function num(v: unknown, fallback: number, min: number, max: number, integer = true): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return clamp(integer ? Math.round(n) : n, min, max);
}

/** A stored panel side in mm: a positive number up to MAX_PANEL_MM, else not entered. */
function optionalMm(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(MAX_PANEL_MM, Math.round(n * 10) / 10) : null;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function sanitizePixelMapState(raw: unknown): PixelMapState {
  if (!isObject(raw)) return DEFAULT_PIXEL_MAP_STATE;

  const layouts: Record<string, PixelLayout> = {};
  if (isObject(raw.layouts)) {
    for (const [id, l] of Object.entries(raw.layouts)) {
      if (!isObject(l)) continue;
      layouts[id] = {
        ...clampPosition(num(l.x, 0, 0, MAX_POSITION), num(l.y, 0, 0, MAX_POSITION)),
        color: typeof l.color === "string" && HEX.test(l.color) ? l.color : PIXEL_MAP_PALETTE[0],
        logo: l.logo === true,
        panelNo: l.panelNo === true,
        tip: l.tip === true,
      };
    }
  }

  const manual: ManualScreen[] = Array.isArray(raw.manual)
    ? raw.manual.filter(isObject).flatMap((m) =>
        typeof m.id === "string" && m.id !== ""
          ? [
              {
                id: m.id,
                name: typeof m.name === "string" ? m.name : "",
                moduleW: num(m.moduleW, 128, 1, MAX_MODULE_PX),
                moduleH: num(m.moduleH, 128, 1, MAX_MODULE_PX),
                ...(Array.isArray(m.cutouts) && m.cutouts.length > 0 ? { cutouts: sanitizeCutouts(m.cutouts) } : {}),
                // Saved before panel sizes as columns / rows: the same counts.
                widthPanels: num(m.widthPanels ?? m.cols, 1, 1, MAX_MODULE_COUNT),
                heightPanels: num(m.heightPanels ?? m.rows, 1, 1, MAX_MODULE_COUNT),
                panelWidthMm: optionalMm(m.panelWidthMm),
                panelHeightMm: optionalMm(m.panelHeightMm),
              },
            ]
          : [],
      )
    : [];

  const order = Array.isArray(raw.order) ? [...new Set(raw.order.filter((id): id is string => typeof id === "string"))] : [];

  const v = isObject(raw.view) ? raw.view : {};
  const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
  const view: PixelMapView = {
    showModuleBorders: bool(v.showModuleBorders, DEFAULT_PIXEL_MAP_VIEW.showModuleBorders),
    showDiagonals: bool(v.showDiagonals, DEFAULT_PIXEL_MAP_VIEW.showDiagonals),
    showCenterCross: bool(v.showCenterCross, DEFAULT_PIXEL_MAP_VIEW.showCenterCross),
    labelScale: num(v.labelScale, 1, SCALE_MIN, SCALE_MAX, false),
    logoScale: num(v.logoScale, 1, SCALE_MIN, SCALE_MAX, false),
  };

  return { layouts, manual, order, view, groups: sanitizeGroups(raw.groups) };
}

// ---------------------------------------------------------------------------
// Resolume Arena Advanced Output (Screen Setup) preset.

function xmlAttr(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The four corners in Resolume's order: top-left, top-right, bottom-right, bottom-left. */
function rectVertices(r: Rect, indent: string): string {
  const corners = [
    [r.x, r.y],
    [r.x + r.width, r.y],
    [r.x + r.width, r.y + r.height],
    [r.x, r.y + r.height],
  ];
  return corners.map(([x, y]) => `${indent}<v x="${x}" y="${y}"/>`).join("\n");
}

/**
 * Advanced Output preset for Resolume Arena 7: one Screen (a virtual output
 * the size of the composition) with one Slice per LED screen. Each slice
 * takes its own area of the composition and puts it at the same place on the
 * output (1:1 — InputRect = OutputRect). `idBase` makes the uniqueIds
 * deterministic in tests.
 */
export function buildResolumeXml(screens: (Rect & { name: string })[], idBase = Date.now()): string {
  const { width, height } = totalArea(screens);
  const slices = screens
    .map((s, i) => {
      const rect = { x: s.x, y: s.y, width: s.width, height: s.height };
      return [
        `        <Slice uniqueId="${idBase + i + 2}">`,
        `          <Params name="Common">`,
        `            <Param name="Name" T="STRING" default="Layer" value="${xmlAttr(s.name)}"/>`,
        `            <Param name="Enabled" T="BOOL" default="1" value="1"/>`,
        `          </Params>`,
        `          <InputRect orientation="0">`,
        rectVertices(rect, "            "),
        `          </InputRect>`,
        `          <OutputRect orientation="0">`,
        rectVertices(rect, "            "),
        `          </OutputRect>`,
        `        </Slice>`,
      ].join("\n");
    })
    .join("\n");

  return [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<XmlState name="LED_PixelMap_${width}x${height}">`,
    `  <versionInfo name="Resolume Arena" majorVersion="7" minorVersion="0" microVersion="0" revision="0"/>`,
    `  <ScreenSetup name="ScreenSetup">`,
    `    <Params name="ScreenSetupParams"/>`,
    `    <CurrentCompositionTextureSize width="${width}" height="${height}"/>`,
    `    <screens>`,
    `      <Screen name="LED" uniqueId="${idBase + 1}">`,
    `        <Params name="Params">`,
    `          <Param name="Name" T="STRING" default="" value="LED"/>`,
    `          <Param name="Enabled" T="BOOL" default="1" value="1"/>`,
    `        </Params>`,
    `        <layers>`,
    slices,
    `        </layers>`,
    `        <OutputDevice>`,
    `          <OutputDeviceVirtual name="LED" deviceId="VirtualScreen 1" width="${width}" height="${height}"/>`,
    `        </OutputDevice>`,
    `      </Screen>`,
    `    </screens>`,
    `  </ScreenSetup>`,
    `</XmlState>`,
    ``,
  ].join("\n");
}
