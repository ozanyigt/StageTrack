import { panelCode } from "./panelCode";
import { darken, MODULE_SHADES, type PixelMapView, type PixelScreen, type Rect } from "./pixelMap";

/**
 * Canvas drawing for the Pixel Map. Everything is drawn in map pixels; `px`
 * is how many map pixels one screen pixel is (1 / zoom on the page, 1 in the
 * JPG), so lines and markers keep the same on-screen thickness at any zoom.
 */

export const GUIDE_COLOR = "#22d3ee";
const ORIGIN_COLOR = "#ef4444";
const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';

export interface DrawOptions {
  view: PixelMapView;
  px: number;
  logo: HTMLImageElement | null;
  /** Page only: the screen being dragged (cyan, thick frame). */
  draggingId?: string | null;
  /** Page only: the selected screen (accent frame). */
  selectedId?: string | null;
  selectedColor?: string;
  /** The map area being drawn (the page's view, an export's region): panel codes outside it are skipped. */
  visible?: Rect;
  /**
   * Merged screens: their members get no label or logo of their own — the group gets one of each, in its middle, and
   * a solid frame around all of them.
   */
  groups?: DrawGroup[];
}

/** A merged screen as drawn: its name, the label lines under the position, its area and members. */
export interface DrawGroup extends Rect {
  id: string;
  name: string;
  logo: boolean;
  info: string[];
  members: string[];
}

/** Logo box: ~30 % of the screen width (× logoScale), centred in the top third, never taller than 30 % of the screen. */
export function logoRect(screen: Rect, logoScale: number, imgW: number, imgH: number): Rect {
  const aspect = imgH / imgW;
  let width = Math.min(screen.width * 0.3 * logoScale, screen.width * 0.9);
  let height = width * aspect;
  const maxHeight = screen.height * 0.3;
  if (height > maxHeight) {
    height = maxHeight;
    width = height / aspect;
  }
  return { x: screen.x + (screen.width - width) / 2, y: screen.y + screen.height / 6 - height / 2, width, height };
}

function drawModules(ctx: CanvasRenderingContext2D, s: PixelScreen) {
  const shades = MODULE_SHADES.map((a) => darken(s.color, a));
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      // A panel taken out stays empty (black, as in the output).
      if (s.cut?.has(c * s.rows + (s.rows - 1 - r))) continue;
      ctx.fillStyle = shades[(c + r) % 3];
      ctx.fillRect(s.x + c * s.moduleW, s.y + r * s.moduleH, s.moduleW, s.moduleH);
    }
  }
}

function drawModuleBorders(ctx: CanvasRenderingContext2D, s: PixelScreen, px: number) {
  // Too small to see on screen: the lines would only turn the screen black.
  if (s.moduleW / px < 4 || s.moduleH / px < 4) return;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = px;
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let c = 1; c < s.cols; c++) {
    const x = s.x + c * s.moduleW;
    ctx.moveTo(x, s.y);
    ctx.lineTo(x, s.y + s.height);
  }
  for (let r = 1; r < s.rows; r++) {
    const y = s.y + r * s.moduleH;
    ctx.moveTo(s.x, y);
    ctx.lineTo(s.x + s.width, y);
  }
  ctx.stroke();
}

function drawDiagonals(ctx: CanvasRenderingContext2D, s: PixelScreen, px: number) {
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2 * px;
  ctx.setLineDash([12 * px, 8 * px]);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(s.x + s.width, s.y + s.height);
  ctx.moveTo(s.x + s.width, s.y);
  ctx.lineTo(s.x, s.y + s.height);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawCenterCross(ctx: CanvasRenderingContext2D, s: PixelScreen, px: number) {
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2 * px;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y + s.height / 2);
  ctx.lineTo(s.x + s.width, s.y + s.height / 2);
  ctx.moveTo(s.x + s.width / 2, s.y);
  ctx.lineTo(s.x + s.width / 2, s.y + s.height);
  ctx.stroke();
}

/** A panel code's base size: this share of the module's shorter side (× the label size setting). */
export const PANEL_CODE_SCALE = 0.35;
/** A code never gets wider than this share of its module. */
export const PANEL_CODE_MAX_WIDTH = 0.8;

/**
 * Where and how big a module's panel code is drawn: the module's centre, min(module W, H) × 0.35 × labelScale,
 * shrunk for a code wider than 80 % of the module (and never taller than 80 % of it). `textWidth(text, size)` is
 * the text's width at that font size.
 */
export function panelCodeLayout(
  s: Pick<PixelScreen, "x" | "y" | "moduleW" | "moduleH">,
  col: number,
  row: number,
  labelScale: number,
  textWidth: (text: string, size: number) => number,
  maxHeight = PANEL_CODE_MAX_WIDTH,
): { text: string; x: number; y: number; size: number } {
  const text = panelCode(row, col);
  let size = Math.min(s.moduleW, s.moduleH) * PANEL_CODE_SCALE * labelScale;
  const width = textWidth(text, size);
  if (width > s.moduleW * PANEL_CODE_MAX_WIDTH) size *= (s.moduleW * PANEL_CODE_MAX_WIDTH) / width;
  size = Math.min(size, s.moduleH * maxHeight);
  return { text, x: s.x + (col + 0.5) * s.moduleW, y: s.y + (row + 0.5) * s.moduleH, size };
}

/** "Panel No": every module's code, bold and light with a dark outline, centred in the module. */
function drawPanelCodes(ctx: CanvasRenderingContext2D, s: PixelScreen, labelScale: number, px: number, visible: Rect | undefined) {
  // Unreadably small on screen: skip (like the module borders).
  if (Math.min(s.moduleW, s.moduleH) * PANEL_CODE_SCALE * labelScale < 4 * px) return;
  const first = (start: number, size: number, from: number) => Math.max(0, Math.floor((from - start) / size));
  const c0 = visible ? first(s.x, s.moduleW, visible.x) : 0;
  const r0 = visible ? first(s.y, s.moduleH, visible.y) : 0;
  const c1 = visible ? Math.min(s.cols, Math.ceil((visible.x + visible.width - s.x) / s.moduleW)) : s.cols;
  const r1 = visible ? Math.min(s.rows, Math.ceil((visible.y + visible.height - s.y) / s.moduleH)) : s.rows;

  // Widths are measured once at 100 px and scaled (text width grows with the font size).
  ctx.font = `bold 100px ${FONT}`;
  const textWidth = (text: string, size: number) => (ctx.measureText(text).width * size) / 100;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
  ctx.fillStyle = "#fff";
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      if (s.cut?.has(c * s.rows + (s.rows - 1 - r))) continue;
      ctx.font = `bold 100px ${FONT}`;
      // With the type labels on, the code stays in the middle 30 % (below the top-right type label).
      const code = panelCodeLayout(s, c, r, labelScale, textWidth, s.tip && s.panelType ? PANEL_CODE_WITH_TIP_MAX_HEIGHT : PANEL_CODE_MAX_WIDTH);
      ctx.font = `bold ${code.size}px ${FONT}`;
      ctx.lineWidth = code.size * 0.16;
      ctx.strokeText(code.text, code.x, code.y);
      ctx.fillText(code.text, code.x, code.y);
    }
  }
}

/** The panel code's height with the type labels on: the middle 30 % (0,35–0,65), clear of the top third. */
export const PANEL_CODE_WITH_TIP_MAX_HEIGHT = 0.3;
/** A tip label is this share of the module's width wide (the whole word, scaled to it)… */
export const PANEL_TIP_WIDTH = 0.65;
/** …but never taller than this share of the module's height (outline included), so it stays in the top third. */
export const PANEL_TIP_MAX_HEIGHT = 0.28;
/** The gap to the module's top and right edges, as a share of the module's shorter side. */
export const PANEL_TIP_INSET = 0.03;
/** The outline's width as a share of the font size. */
export const PANEL_TIP_STROKE = 0.16;
/** Under this many screen pixels high the tip labels are left out (too small to read, a crowd at low zoom). */
export const PANEL_TIP_MIN_SCREEN_PX = 7;

/**
 * A module's type label in its top-right corner: the whole word, scaled to 65 % of the module's width (smaller when
 * that would be taller than 28 % of the module); null when it would be under 7 screen px (hidden). The box (text +
 * outline) stays inside the module, above 0,31 of its height — the panel code then stays in 0,35–0,65, so the two
 * never meet.
 */
export function panelTipLayout(
  s: Pick<PixelScreen, "x" | "y" | "moduleW" | "moduleH">,
  col: number,
  row: number,
  panelType: string,
  px: number,
  textWidth: (text: string, size: number) => number,
): { text: string; x: number; y: number; size: number; box: Rect } | null {
  const perPx = textWidth(panelType, 1) || 1;
  const outline = 1 + PANEL_TIP_STROKE;
  const size = Math.min((s.moduleW * PANEL_TIP_WIDTH) / (perPx + PANEL_TIP_STROKE), (s.moduleH * PANEL_TIP_MAX_HEIGHT) / outline);
  if (size / px < PANEL_TIP_MIN_SCREEN_PX) return null;
  const inset = Math.min(s.moduleW, s.moduleH) * PANEL_TIP_INSET;
  const half = (size * PANEL_TIP_STROKE) / 2;
  const width = textWidth(panelType, size) + 2 * half;
  const height = size * outline;
  const right = s.x + (col + 1) * s.moduleW - inset;
  const top = s.y + row * s.moduleH + inset;
  return { text: panelType, x: right - half, y: top + height / 2, size, box: { x: right - width, y: top, width, height } };
}

/** "Tip": the panel type on every module that is not cut out, big, bold white with a black outline (readable on any colour). */
function drawPanelTips(ctx: CanvasRenderingContext2D, s: PixelScreen, panelType: string, px: number, visible: Rect | undefined) {
  const first = (start: number, size: number, from: number) => Math.max(0, Math.floor((from - start) / size));
  const c0 = visible ? first(s.x, s.moduleW, visible.x) : 0;
  const r0 = visible ? first(s.y, s.moduleH, visible.y) : 0;
  const c1 = visible ? Math.min(s.cols, Math.ceil((visible.x + visible.width - s.x) / s.moduleW)) : s.cols;
  const r1 = visible ? Math.min(s.rows, Math.ceil((visible.y + visible.height - s.y) / s.moduleH)) : s.rows;

  ctx.font = `bold 100px ${FONT}`;
  const textWidth = (text: string, size: number) => (ctx.measureText(text).width * size) / 100;
  // The same size on every module: when it is too small, none is drawn.
  const probe = panelTipLayout(s, 0, 0, panelType, px, textWidth);
  if (!probe) return;
  ctx.font = `bold ${probe.size}px ${FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.setLineDash([]);
  ctx.lineWidth = probe.size * PANEL_TIP_STROKE;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
  ctx.fillStyle = "#fff";
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      if (s.cut?.has(c * s.rows + (s.rows - 1 - r))) continue;
      const x = probe.x + c * s.moduleW;
      const y = probe.y + r * s.moduleH;
      ctx.strokeText(panelType, x, y);
      ctx.fillText(panelType, x, y);
    }
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, s: PixelScreen, color: string, width: number, dash: number[]) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  // Inset by half the line so the frame stays inside the screen (and inside the JPG).
  ctx.strokeRect(s.x + width / 2, s.y + width / 2, s.width - width, s.height - width);
  ctx.setLineDash([]);
}

/**
 * Label: bold name, then "X: 0 Y: 0", then the screen's info lines ("Piksel: 256 × 512", "Metraj: 0,50 m × 1,00 m";
 * the size is said once, there). The box is as wide as its widest line; when it doesn't fit the screen the text
 * shrinks.
 */
function drawLabel(ctx: CanvasRenderingContext2D, s: Pick<PixelScreen, "x" | "y" | "width" | "height" | "name" | "info">, labelScale: number, logoBottom: number | null) {
  let size = Math.min(96, Math.max(12, s.width * 0.035)) * labelScale;
  const pos = `X: ${s.x} Y: ${s.y}`;
  const measure = (lines: string[], fs: number) =>
    lines.map((line, i) => {
      ctx.font = i === 0 ? `bold ${fs}px ${FONT}` : `${fs * 0.8}px ${FONT}`;
      return ctx.measureText(line).width;
    });
  const box = (lines: string[], fs: number) => ({
    width: Math.max(...measure(lines, fs)) + fs,
    height: fs * 1.25 + (lines.length - 1) * fs * 1.05 + fs * 0.6,
  });

  const info = s.info ?? [];
  const lines = [s.name, pos, ...info];
  // Still too big (narrow / short screen): shrink the text until it fits.
  const fit = box(lines, size);
  const shrink = Math.min(1, (s.width * 0.95) / fit.width, (s.height * 0.95) / fit.height);
  size *= shrink;
  const { width, height } = box(lines, size);

  let cy = s.y + s.height / 2;
  if (logoBottom !== null) {
    const gap = size * 0.3;
    if (cy - height / 2 < logoBottom + gap) cy = logoBottom + gap + height / 2;
    cy = Math.min(cy, s.y + s.height - height / 2);
  }
  const cx = s.x + s.width / 2;

  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(cx - width / 2, cy - height / 2, width, height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let y = cy - height / 2 + size * 0.3 + size * 0.625;
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? `bold ${size}px ${FONT}` : `${size * 0.8}px ${FONT}`;
    ctx.fillText(line, cx, y);
    y += i === 0 ? size * 1.15 : size * 1.05;
  });
}

/** All screens, in list order (later ones on top). */
export function drawScreens(ctx: CanvasRenderingContext2D, screens: PixelScreen[], opts: DrawOptions) {
  const { view, px, logo } = opts;
  const grouped = new Set((opts.groups ?? []).flatMap((g) => g.members));
  for (const s of screens) {
    drawModules(ctx, s);
    if (view.showModuleBorders) drawModuleBorders(ctx, s, px);
    if (view.showDiagonals) drawDiagonals(ctx, s, px);
    if (view.showCenterCross) drawCenterCross(ctx, s, px);
    // Over the cross and diagonals, under the logo and the label.
    if (s.panelNo) drawPanelCodes(ctx, s, view.labelScale, px, opts.visible);
    // Top right of every panel, clear of the centred panel code.
    if (s.tip && s.panelType) drawPanelTips(ctx, s, s.panelType, px, opts.visible);

    if (grouped.has(s.id)) {
      // A member: its own dashed frame only; the group draws the rest below.
      drawFrame(ctx, s, "#fff", 1.5 * px, [10 * px, 6 * px]);
      continue;
    }

    const logoBottom = s.logo ? drawLogo(ctx, s, view.logoScale, logo) : null;

    if (s.id === opts.draggingId) drawFrame(ctx, s, GUIDE_COLOR, 4 * px, []);
    else if (s.id === opts.selectedId && opts.selectedColor) drawFrame(ctx, s, opts.selectedColor, 3 * px, []);
    else drawFrame(ctx, s, "#fff", 2 * px, [10 * px, 6 * px]);

    drawLabel(ctx, s, view.labelScale, logoBottom);
  }

  // Merged screens: one logo, one label and a solid frame each, over their members.
  for (const g of opts.groups ?? []) {
    const logoBottom = g.logo ? drawLogo(ctx, g, view.logoScale, logo) : null;
    const dragged = g.members.includes(opts.draggingId ?? "");
    const selected = g.members.includes(opts.selectedId ?? "");
    ctx.strokeStyle = dragged ? GUIDE_COLOR : selected && opts.selectedColor ? opts.selectedColor : "#fff";
    ctx.lineWidth = (dragged ? 4 : 3) * px;
    ctx.setLineDash([]);
    ctx.strokeRect(g.x, g.y, g.width, g.height);
    drawLabel(ctx, g, view.labelScale, logoBottom);
  }
}

/** The logo in a screen's (or group's) top third; returns its bottom edge (null when there is no image). */
function drawLogo(ctx: CanvasRenderingContext2D, area: Rect, logoScale: number, logo: HTMLImageElement | null): number | null {
  if (!logo || logo.naturalWidth === 0) return null;
  const r = logoRect(area, logoScale, logo.naturalWidth, logo.naturalHeight);
  ctx.drawImage(logo, r.x, r.y, r.width, r.height);
  return r.y + r.height;
}

/** Page only: red X / Y axes (100 screen px), a dot and "ORIGIN 0,0" at the top-left corner. */
export function drawOrigin(ctx: CanvasRenderingContext2D, px: number) {
  ctx.strokeStyle = ORIGIN_COLOR;
  ctx.fillStyle = ORIGIN_COLOR;
  ctx.lineWidth = 2 * px;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(100 * px, 0);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 100 * px);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 4 * px, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `bold ${11 * px}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("ORIGIN 0,0", 6 * px, -4 * px);
}

/** Page only: thin cyan lines where a dragged screen snapped, across the visible area. */
export function drawGuides(ctx: CanvasRenderingContext2D, guidesX: number[], guidesY: number[], visible: Rect, px: number) {
  ctx.strokeStyle = GUIDE_COLOR;
  ctx.lineWidth = px;
  ctx.setLineDash([]);
  ctx.beginPath();
  for (const x of guidesX) {
    ctx.moveTo(x, visible.y);
    ctx.lineTo(x, visible.y + visible.height);
  }
  for (const y of guidesY) {
    ctx.moveTo(visible.x, y);
    ctx.lineTo(visible.x + visible.width, y);
  }
  ctx.stroke();
}

let logoPromise: Promise<HTMLImageElement | null> | null = null;

/** public/brand/panelyze-logo.svg, loaded once (null if it can't be loaded — the map is drawn without it). */
export function loadLogo(): Promise<HTMLImageElement | null> {
  logoPromise ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `${import.meta.env.BASE_URL}brand/panelyze-logo.svg`;
  });
  return logoPromise;
}

/**
 * The JPG / PNG: one region of the composition (the whole map, or a tile) at
 * 1:1, black background — no origin, guides or drag highlight.
 *
 * null when the browser can't really draw a canvas this size. Over its limit a
 * canvas may still hand out a context but silently draw nothing, so the black
 * background is read back from the far corner before drawing.
 */
export function renderExportCanvas(
  screens: PixelScreen[],
  region: { x: number; y: number; width: number; height: number },
  view: PixelMapView,
  logo: HTMLImageElement | null,
  groups: DrawGroup[] = [],
): HTMLCanvasElement | null {
  const { x, y, width, height } = region;
  const canvas = document.createElement("canvas");
  try {
    canvas.width = width;
    canvas.height = height;
    if (canvas.width !== width || canvas.height !== height) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    if (ctx.getImageData(width - 1, height - 1, 1, 1).data[3] !== 255) return null;

    const inside = screens.filter((s) => s.x < x + width && s.x + s.width > x && s.y < y + height && s.y + s.height > y);
    ctx.translate(-x, -y);
    // A group touching the region is drawn whole (its label / logo may lie in another tile).
    const ids = new Set(inside.map((s) => s.id));
    const touching = groups.filter((g) => g.members.some((m) => ids.has(m)));
    const members = new Set(touching.flatMap((g) => g.members));
    drawScreens(ctx, screens.filter((s) => ids.has(s.id) || members.has(s.id)), { view, px: 1, logo, visible: region, groups: touching });
    return canvas;
  } catch {
    return null;
  }
}
