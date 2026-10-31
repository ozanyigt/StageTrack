import { EXPORT_TILE_MAX, exportFileName, planTiles, tileFileName, totalArea, type PixelMapView, type PixelScreen } from "./pixelMap";
import { renderExportCanvas, type DrawGroup } from "./pixelMapDraw";

/**
 * A finished download, or why it couldn't be made. `tiles` > 1: the map was
 * too large for one canvas and the download is a ZIP of that many pieces.
 */
export type ExportResult =
  | { blob: Blob; filename: string; width: number; height: number; tiles: number }
  | { error: "empty" | "failed"; width: number; height: number };

type Format = "jpg" | "png";

/**
 * Tile sides tried, largest first, when the whole map can't be drawn. Some
 * browsers (Safari) stop well below 8192 × 8192, hence the smaller fallbacks.
 */
const TILE_SIZES = [EXPORT_TILE_MAX, 4096, 2048];

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(resolve, type, quality);
    } catch {
      resolve(null);
    }
  });
}

/** One region encoded (null if the browser can't draw or encode it). The canvas is freed straight after. */
async function renderBlob(
  screens: PixelScreen[],
  region: { x: number; y: number; width: number; height: number },
  view: PixelMapView,
  logo: HTMLImageElement | null,
  format: Format,
  groups: DrawGroup[],
): Promise<Blob | null> {
  const canvas = renderExportCanvas(screens, region, view, logo, groups);
  if (!canvas) return null;
  try {
    return format === "jpg" ? await canvasToBlob(canvas, "image/jpeg", 0.95) : await canvasToBlob(canvas, "image/png");
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** Images are already compressed, so they go into the ZIP as-is (level 0). fflate is loaded only here. */
async function zip(files: [name: string, blob: Blob][]): Promise<Blob> {
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const [name, blob] of files) entries[name] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
  const { zipSync } = await import("fflate");
  return new Blob([zipSync(entries) as BlobPart], { type: "application/zip" });
}

/** Every tile of one size, or null as soon as one can't be drawn. */
async function renderTiles(
  screens: PixelScreen[],
  width: number,
  height: number,
  tileMax: number,
  view: PixelMapView,
  logo: HTMLImageElement | null,
  format: Format,
  groups: DrawGroup[],
): Promise<[string, Blob][] | null> {
  const files: [string, Blob][] = [];
  for (const tile of planTiles(width, height, tileMax)) {
    const blob = await renderBlob(screens, tile, view, logo, format, groups);
    if (!blob) return null;
    files.push([tileFileName(tile, format), blob]);
  }
  return files;
}

/**
 * The composition at 1:1 (logo included). First tried as one image; if the
 * browser can't draw or encode a canvas that large, it is split into tiles of
 * at most 8192 × 8192 px and downloaded as one ZIP.
 */
async function exportImage(screens: PixelScreen[], view: PixelMapView, logo: HTMLImageElement | null, format: Format, groups: DrawGroup[]): Promise<ExportResult> {
  const { width, height } = totalArea(screens);
  if (width <= 0 || height <= 0) return { error: "empty", width, height };

  const whole = await renderBlob(screens, { x: 0, y: 0, width, height }, view, logo, format, groups);
  if (whole) {
    if (format === "jpg") return { blob: whole, filename: exportFileName(width, height, "jpg"), width, height, tiles: 1 };
    const blob = await zip([[exportFileName(width, height, "png"), whole]]);
    return { blob, filename: exportFileName(width, height, "zip"), width, height, tiles: 1 };
  }

  for (const tileMax of TILE_SIZES) {
    // A single tile is the whole map again, which just failed.
    if (width <= tileMax && height <= tileMax) continue;
    const files = await renderTiles(screens, width, height, tileMax, view, logo, format, groups);
    if (files) return { blob: await zip(files), filename: exportFileName(width, height, "zip"), width, height, tiles: files.length };
  }
  return { error: "failed", width, height };
}

/** LED_PixelMap_<W>x<H>.jpg, quality 0.95 — or a ZIP of JPG tiles when too large. */
export function exportJpg(screens: PixelScreen[], view: PixelMapView, logo: HTMLImageElement | null, groups: DrawGroup[] = []): Promise<ExportResult> {
  return exportImage(screens, view, logo, "jpg", groups);
}

/** LED_PixelMap_<W>x<H>.zip holding LED_PixelMap_<W>x<H>.png — or PNG tiles when too large. */
export function exportPngZip(screens: PixelScreen[], view: PixelMapView, logo: HTMLImageElement | null, groups: DrawGroup[] = []): Promise<ExportResult> {
  return exportImage(screens, view, logo, "png", groups);
}
