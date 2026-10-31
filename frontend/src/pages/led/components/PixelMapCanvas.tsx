import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { clampPosition, snapPosition, SNAP_SCREEN_PX, totalArea, type PixelMapView, type PixelScreen } from "../core/pixelMap";
import { drawGuides, drawOrigin, drawScreens, loadLogo, type DrawGroup } from "../core/pixelMapDraw";
import type { Side } from "../core/pixelAdjacent";

interface Props {
  screens: PixelScreen[];
  view: PixelMapView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** New position (already whole pixels, ≥ 0). */
  onMove: (id: string, x: number, y: number) => void;
  /** Frame colour of the selected screen (the page accent). */
  accentColor: string;
  /**
   * "Kırp" mode: panels are picked instead of screens moved — a click on a panel toggles it, a box dragged over the
   * map adds every panel it touches, a click on the empty map clears the choice. Cells: column × rows + row, row 0 =
   * bottom. The picked panels are drawn filled, the panels taken out dashed.
   */
  cutting?: {
    picked: ReadonlyMap<string, ReadonlySet<number>>;
    onPick: (picks: { id: string; cells: number[] }[], mode: "toggle" | "add") => void;
    onClear: () => void;
  } | null;
  /** Merged screens: drawn with one label / logo, dragged as one (snapping by the group's outline). */
  groups?: DrawGroup[];
  /** "Birleştir" mode: a click on a screen (a whole group) picks it or drops it; nothing moves. */
  merging?: { picked: ReadonlySet<string>; onToggle: (id: string) => void } | null;
  /** Buttons left of the zoom controls. */
  toolbar?: ReactNode;
  /** Under the buttons, right-aligned (e.g. the cut mode's hint). */
  toolbarNote?: ReactNode;
  /** "+" on the selected screen's four sides: the same screen again, edge to edge (Shift: the selection stays). */
  adjacent?: { onAdd: (side: Side, keepSelection: boolean) => void; disabled: boolean } | null;
}

interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}

const ZOOM_MIN = 0.005;
const ZOOM_MAX = 8;
const ZOOM_STEP = 1.25;
const FIT_PADDING = 32;

type DragState =
  | { kind: "screen"; id: string; pointerId: number; offsetX: number; offsetY: number }
  | { kind: "pan"; pointerId: number; startX: number; startY: number; panX: number; panY: number }
  | { kind: "cut"; pointerId: number; from: MapPoint; to: MapPoint; startX: number; startY: number; moved: boolean };

interface MapPoint {
  x: number;
  y: number;
}

/** A panel of a screen: column from the left, row from the top (as drawn). */
interface CellPos {
  col: number;
  row: number;
}

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

/** A press that moves less than this (screen px) is a click. */
const CLICK_SLOP = 4;

/** Black canvas with the screens; drag to move (snapping), drag empty space / scroll to pan, Ctrl + wheel to zoom. */
export function PixelMapCanvas({
  screens,
  view,
  selectedId,
  onSelect,
  onMove,
  accentColor,
  cutting = null,
  groups = [],
  merging = null,
  toolbar,
  toolbarNote,
  adjacent = null,
}: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: FIT_PADDING, panY: FIT_PADDING });
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState<{ id: string; guidesX: number[]; guidesY: number[] } | null>(null);
  // The box being dragged over the map to pick panels (cut mode).
  const [cutBox, setCutBox] = useState<{ from: MapPoint; to: MapPoint } | null>(null);
  // The panel type under the pointer, written in full (the panels may show a short form): the canvas' tooltip.
  const [hoverTitle, setHoverTitle] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    loadLogo().then((img) => alive && setLogo(img));
    return () => {
      alive = false;
    };
  }, []);

  // Canvas follows its container's size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Latest screens for "Sığdır" without re-creating `fit` on every move.
  const screensRef = useRef(screens);
  useEffect(() => {
    screensRef.current = screens;
  });

  const fit = useCallback(() => {
    if (size.width === 0 || size.height === 0) return;
    const area = totalArea(screensRef.current);
    const w = Math.max(area.width, 1);
    const h = Math.max(area.height, 1);
    const zoom = clampZoom(Math.min((size.width - 2 * FIT_PADDING) / w, (size.height - 2 * FIT_PADDING) / h));
    setViewport({ zoom, panX: (size.width - w * zoom) / 2, panY: (size.height - h * zoom) / 2 });
  }, [size.width, size.height]);

  // Re-fit when screens are added / removed or change size (not when they are moved), and on resize.
  const key = fitKey(screens);
  useEffect(() => {
    fit();
  }, [fit, key]);

  // Draw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const { zoom, panX, panY } = viewport;
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * panX, dpr * panY);
    const px = 1 / zoom;
    const visible = { x: -panX / zoom, y: -panY / zoom, width: size.width / zoom, height: size.height / zoom };
    drawScreens(ctx, screens, {
      view,
      px,
      logo,
      draggingId: dragging?.id ?? null,
      selectedId,
      selectedColor: accentColor,
      visible,
      groups,
    });
    if (cutting) drawCutOverlay(ctx, screens, cutting.picked, cutBox, px, accentColor);
    if (merging) drawMergeOverlay(ctx, screens, merging.picked, px, accentColor);
    drawOrigin(ctx, px);
    if (dragging) {
      drawGuides(ctx, dragging.guidesX, dragging.guidesY, visible, px);
    }
  }, [screens, view, viewport, size, dragging, selectedId, logo, accentColor, cutting, cutBox, groups, merging]);

  // Wheel: Ctrl (or trackpad pinch) zooms around the cursor, otherwise pans. Needs a non-passive listener.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      setViewport((v) => {
        if (e.ctrlKey || e.metaKey) {
          const zoom = clampZoom(v.zoom * Math.exp(-e.deltaY * 0.0015));
          const k = zoom / v.zoom;
          return { zoom, panX: sx - (sx - v.panX) * k, panY: sy - (sy - v.panY) * k };
        }
        return { ...v, panX: v.panX - e.deltaX, panY: v.panY - e.deltaY };
      });
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // Arrow keys move the selected screen: 1 px, Shift 10 px (not while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Nothing moves in the cut or merge mode.
      if (!selectedId || cutting || merging) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
      const step = e.shiftKey ? 10 : 1;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!delta) return;
      const s = screens.find((sc) => sc.id === selectedId);
      if (!s) return;
      e.preventDefault();
      const next = clampPosition(s.x + delta[0], s.y + delta[1]);
      onMove(s.id, next.x, next.y);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, screens, onMove, cutting, merging]);

  function toMap(e: { clientX: number; clientY: number }) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left - viewport.panX) / viewport.zoom, y: (e.clientY - rect.top - viewport.panY) / viewport.zoom };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = toMap(e);
    if (cutting) {
      dragRef.current = { kind: "cut", pointerId: e.pointerId, from: p, to: p, startX: e.clientX, startY: e.clientY, moved: false };
      return;
    }
    const hit = hitScreen(screens, p);
    if (merging) {
      if (hit) merging.onToggle(hit.id);
      return;
    }
    if (hit) {
      onSelect(hit.id);
      dragRef.current = { kind: "screen", id: hit.id, pointerId: e.pointerId, offsetX: p.x - hit.x, offsetY: p.y - hit.y };
    } else {
      onSelect(null);
      dragRef.current = { kind: "pan", pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, panX: viewport.panX, panY: viewport.panY };
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) {
      const hit = hitScreen(screens, toMap(e));
      const title = hit?.tip && hit.panelType ? t("pixel.tipHover", { tip: hit.panelType }) : undefined;
      if (title !== hoverTitle) setHoverTitle(title);
      return;
    }
    if (drag.pointerId !== e.pointerId) return;
    if (drag.kind === "cut") {
      const moved = drag.moved || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) >= CLICK_SLOP;
      const to = toMap(e);
      dragRef.current = { ...drag, to, moved };
      if (moved) setCutBox({ from: drag.from, to });
      return;
    }
    if (drag.kind === "pan") {
      setViewport((v) => ({ ...v, panX: drag.panX + e.clientX - drag.startX, panY: drag.panY + e.clientY - drag.startY }));
      return;
    }
    const s = screens.find((sc) => sc.id === drag.id);
    if (!s) return;
    const p = toMap(e);
    // A member of a group moves the group: its outline snaps to the screens outside it.
    const group = groups.find((g) => g.members.includes(s.id));
    const box = group ?? s;
    const others = screens.filter((o) => (group ? !group.members.includes(o.id) : o.id !== s.id));
    const snapped = snapPosition(
      { x: p.x - drag.offsetX + (box.x - s.x), y: p.y - drag.offsetY + (box.y - s.y), width: box.width, height: box.height },
      others,
      SNAP_SCREEN_PX / viewport.zoom,
      e.shiftKey,
    );
    const x = snapped.x + (s.x - box.x);
    const y = snapped.y + (s.y - box.y);
    setDragging({ id: s.id, guidesX: snapped.guidesX, guidesY: snapped.guidesY });
    if (x !== s.x || y !== s.y) onMove(s.id, x, y);
  }

  function endDrag(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (drag?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (drag.kind === "cut") {
      setCutBox(null);
      if (e.type !== "pointerup" || !cutting) return;
      if (drag.moved) {
        const picks = boxCells(screens, drag.from, drag.to);
        if (picks.length > 0) cutting.onPick(picks, "add");
        return;
      }
      const hit = hitScreen(screens, drag.from);
      if (!hit) cutting.onClear();
      else {
        const at = cellAt(hit, drag.from);
        cutting.onPick([{ id: hit.id, cells: [at.col * hit.rows + (hit.rows - 1 - at.row)] }], "toggle");
      }
      return;
    }
    setDragging(null);
  }

  function zoomBy(factor: number) {
    const cx = size.width / 2;
    const cy = size.height / 2;
    setViewport((v) => {
      const zoom = clampZoom(v.zoom * factor);
      const k = zoom / v.zoom;
      return { zoom, panX: cx - (cx - v.panX) * k, panY: cy - (cy - v.panY) * k };
    });
  }

  const selected = !cutting && !merging && !dragging ? screens.find((s) => s.id === selectedId) : undefined;

  const btn = "h-8 min-w-8 px-2 rounded bg-neutral-800/90 hover:bg-neutral-700 text-neutral-100 text-sm border border-neutral-700";

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        data-testid="pixel-map-canvas"
        title={hoverTitle}
        className={`block w-full h-full touch-none ${cutting ? "cursor-crosshair" : merging ? "cursor-pointer" : dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
      {selected && adjacent && <AdjacentButtons screen={selected} viewport={viewport} disabled={adjacent.disabled} onAdd={adjacent.onAdd} />}
      {/* Buttons top right; the note under them lets clicks through to the map. */}
      <div className="absolute top-2 right-2 flex flex-col items-end gap-1.5 pointer-events-none">
        <div className="flex items-center gap-1 pointer-events-auto">
          {toolbar}
          <button type="button" className={btn} aria-label={t("pixel.zoomOut")} onClick={() => zoomBy(1 / ZOOM_STEP)}>
            −
          </button>
          <span className="h-8 min-w-14 px-2 rounded bg-neutral-900/90 border border-neutral-700 text-sm text-neutral-200 inline-flex items-center justify-center tabular-nums">
            {Math.round(viewport.zoom * 100)}%
          </span>
          <button type="button" className={btn} aria-label={t("pixel.zoomIn")} onClick={() => zoomBy(ZOOM_STEP)}>
            +
          </button>
          <button type="button" className={btn} onClick={fit}>
            {t("pixel.fit")}
          </button>
        </div>
        {toolbarNote}
      </div>
      <div className="absolute bottom-2 left-2 right-2 text-[11px] text-neutral-400 pointer-events-none hidden sm:block">{t("pixel.hint")}</div>
    </div>
  );
}

/** "+" buttons just outside the middle of each side of the selected screen. */
function AdjacentButtons({
  screen: s,
  viewport,
  disabled,
  onAdd,
}: {
  screen: PixelScreen;
  viewport: Viewport;
  disabled: boolean;
  onAdd: (side: Side, keepSelection: boolean) => void;
}) {
  const { t } = useTranslation();
  const left = viewport.panX + s.x * viewport.zoom;
  const top = viewport.panY + s.y * viewport.zoom;
  const width = s.width * viewport.zoom;
  const height = s.height * viewport.zoom;
  const GAP = 16;
  const at: Record<Side, { x: number; y: number }> = {
    top: { x: left + width / 2, y: top - GAP },
    right: { x: left + width + GAP, y: top + height / 2 },
    bottom: { x: left + width / 2, y: top + height + GAP },
    left: { x: left - GAP, y: top + height / 2 },
  };
  return (
    <>
      {(Object.keys(at) as Side[]).map((side) => (
        <button
          key={side}
          type="button"
          data-add-side={side}
          aria-label={t(`pixel.addSide.${side}`)}
          title={t("pixel.addSideHint")}
          disabled={disabled}
          onClick={(e) => onAdd(side, e.shiftKey)}
          className="absolute -translate-x-1/2 -translate-y-1/2 size-6 rounded-full bg-accent text-accent-fg text-base leading-none font-bold shadow ring-2 ring-black/60 hover:scale-110 transition-transform disabled:opacity-40 disabled:hover:scale-100"
          style={{ left: at[side].x, top: at[side].y }}
        >
          +
        </button>
      ))}
    </>
  );
}

/** The panel of a screen under a map point (clamped to the screen). */
function cellAt(s: PixelScreen, p: { x: number; y: number }): CellPos {
  const clampTo = (v: number, n: number) => Math.min(n - 1, Math.max(0, Math.floor(v)));
  return { col: clampTo((p.x - s.x) / s.moduleW, s.cols), row: clampTo((p.y - s.y) / s.moduleH, s.rows) };
}

/** The topmost screen under a map point (later screens are drawn over earlier ones). */
function hitScreen(screens: PixelScreen[], p: MapPoint): PixelScreen | undefined {
  return [...screens].reverse().find((s) => p.x >= s.x && p.x < s.x + s.width && p.y >= s.y && p.y < s.y + s.height);
}

/** Every panel a box on the map touches, per screen (cells: column × rows + row from the bottom). */
function boxCells(screens: PixelScreen[], a: MapPoint, b: MapPoint): { id: string; cells: number[] }[] {
  const [x0, x1, y0, y1] = [Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.y, b.y), Math.max(a.y, b.y)];
  return screens.flatMap((s) => {
    if (x1 < s.x || x0 >= s.x + s.width || y1 < s.y || y0 >= s.y + s.height) return [];
    const from = cellAt(s, { x: x0, y: y0 });
    const to = cellAt(s, { x: x1, y: y1 });
    const cells: number[] = [];
    for (let c = from.col; c <= to.col; c++) for (let r = from.row; r <= to.row; r++) cells.push(c * s.rows + (s.rows - 1 - r));
    return [{ id: s.id, cells }];
  });
}

/** The cut mode: every screen's panels taken out framed (dashed), the picked panels filled, the box being dragged. */
/** The screens picked to be merged: tinted and framed in the accent. */
function drawMergeOverlay(ctx: CanvasRenderingContext2D, screens: PixelScreen[], picked: ReadonlySet<string>, px: number, color: string) {
  for (const s of screens) {
    if (!picked.has(s.id)) continue;
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = color;
    ctx.fillRect(s.x, s.y, s.width, s.height);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4 * px;
    ctx.setLineDash([12 * px, 6 * px]);
    ctx.strokeRect(s.x, s.y, s.width, s.height);
    ctx.setLineDash([]);
  }
}

function drawCutOverlay(
  ctx: CanvasRenderingContext2D,
  screens: PixelScreen[],
  picked: ReadonlyMap<string, ReadonlySet<number>>,
  box: { from: MapPoint; to: MapPoint } | null,
  px: number,
  color: string,
) {
  const rectOf = (s: PixelScreen, cell: number) => {
    const col = Math.floor(cell / s.rows);
    const row = s.rows - 1 - (cell % s.rows);
    return [s.x + col * s.moduleW, s.y + row * s.moduleH, s.moduleW, s.moduleH] as const;
  };
  ctx.save();
  ctx.lineWidth = px;
  ctx.setLineDash([4 * px, 3 * px]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  for (const s of screens)
    for (const cell of s.cut ?? []) {
      const [x, y, w, h] = rectOf(s, cell);
      ctx.strokeRect(x + px, y + px, w - 2 * px, h - 2 * px);
    }
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(236, 72, 153, 0.45)";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2 * px;
  for (const s of screens)
    for (const cell of picked.get(s.id) ?? []) {
      const [x, y, w, h] = rectOf(s, cell);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x + px, y + px, w - 2 * px, h - 2 * px);
    }
  if (box) {
    const [x, y] = [Math.min(box.from.x, box.to.x), Math.min(box.from.y, box.to.y)];
    const [w, h] = [Math.abs(box.from.x - box.to.x), Math.abs(box.from.y - box.to.y)];
    ctx.fillStyle = "rgba(236, 72, 153, 0.15)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color;
    ctx.strokeRect(x, y, w, h);
  }
  ctx.restore();
}

/** Fit key: ids and sizes, not positions — moving a screen must not re-fit the view. */
function fitKey(screens: PixelScreen[]): string {
  return screens.map((s) => `${s.id}:${s.width}x${s.height}`).join(",");
}
