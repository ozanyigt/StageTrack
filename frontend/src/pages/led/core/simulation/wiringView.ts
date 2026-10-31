import { chainColor } from "./chainStyle";
import type { SignalDevice } from "./devices";
import { chainLoad, chainsOf, lineKey, parseRef, portKey, type ChainLimit, type PanelRef, type PowerBoard, type SimWiring } from "./wiringStore";

/**
 * What Simülasyon's canvas and port / line strip show: the screens where Pixel Map puts them (pixels), and the
 * ports of a processor or the lines of a board with their panels (the ones still on a screen), load and limit.
 */

/** A screen on the canvas, in Pixel Map pixels. */
export interface SimScreen {
  id: string;
  name: string;
  x: number;
  y: number;
  moduleW: number;
  moduleH: number;
  cols: number;
  rows: number;
  /** Panels taken out (cells). */
  cut: ReadonlySet<number>;
  color: string;
  /** A panel's pixels (a corner column has its own panel). */
  pixelsOf: (cell: number) => number;
  /** From the calculation: panels a line carries (0 = not known yet) and one panel's current. */
  panelsPerCircuit: number;
  panelCurrentA: number;
}

export const cellOf = (s: Pick<SimScreen, "rows">, column: number, row: number) => column * s.rows + row;

export function isUsed(s: Pick<SimScreen, "cols" | "rows" | "cut">, cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell < s.cols * s.rows && !s.cut.has(cell);
}

/** The screen and cell a panel is on now; null when it is gone. */
export function resolveRef(byId: ReadonlyMap<string, SimScreen>, ref: PanelRef): { screen: SimScreen; cell: number } | null {
  const p = parseRef(ref);
  const screen = p ? byId.get(p.screenId) : undefined;
  if (!p || !screen || p.column >= screen.cols || p.row >= screen.rows) return null;
  const cell = cellOf(screen, p.column, p.row);
  return isUsed(screen, cell) ? { screen, cell } : null;
}

/** A panel's centre on the canvas (y down; row 0 is the bottom row). */
export function centreOf(screen: SimScreen, cell: number) {
  const column = Math.floor(cell / screen.rows);
  const row = cell % screen.rows;
  return { x: screen.x + (column + 0.5) * screen.moduleW, y: screen.y + (screen.rows - row - 0.5) * screen.moduleH };
}

export function usedPanelCount(screens: SimScreen[]): number {
  return screens.reduce((sum, s) => sum + s.cols * s.rows - [...s.cut].filter((c) => c < s.cols * s.rows).length, 0);
}

/** A port or a line, as the strip and the canvas show it. */
export interface Slot {
  key: string;
  /** 1-based: "Port 3", "Hat 2" (the badge's number). */
  number: number;
  color: string;
  /** Its panels on the screens now, in chain order. */
  panels: PanelRef[];
  limit: ChainLimit | null;
  /** Share of the limit used (1 = full); null without a known limit. */
  load: number | null;
  /** No room left for another panel like its last one. */
  full: boolean;
  /** Lines: the panels' current, A. */
  currentA?: number;
  /** Ports: the card the port is on (null = the processor's own output). */
  card?: number | null;
}

/** A port's limit: the device's pixels per port, each panel its own pixels. */
export function signalLimit(device: SignalDevice, byId: ReadonlyMap<string, SimScreen>): ChainLimit {
  return { max: device.pixelsPerPort, weight: (ref) => weightOf(byId, ref, (s, cell) => s.pixelsOf(cell)) };
}

/**
 * A line's limit as shares: each panel weighs 1 / its screen's panels per line (Max atlama, else fuse × margin ÷
 * current — the calculation's figure), so a line may mix screens; a screen without a figure yet weighs nothing.
 */
export function powerLimit(byId: ReadonlyMap<string, SimScreen>): ChainLimit {
  return { max: 1, weight: (ref) => weightOf(byId, ref, (s) => (s.panelsPerCircuit > 0 ? 1 / s.panelsPerCircuit : 0)) };
}

function weightOf(byId: ReadonlyMap<string, SimScreen>, ref: PanelRef, of: (s: SimScreen, cell: number) => number): number {
  const at = resolveRef(byId, ref);
  return at ? of(at.screen, at.cell) : 0;
}

function slot(key: string, number: number, color: string, panels: PanelRef[], limit: ChainLimit | null): Slot {
  const load = limit && limit.max > 0 ? chainLoad(panels, limit) / limit.max : null;
  const last = panels[panels.length - 1];
  const full = limit !== null && limit.max > 0 && last !== undefined && chainLoad(panels, limit) + limit.weight(last) > limit.max + 1e-9;
  return { key, number, color, panels, limit, load, full };
}

/** Panels of a chain still on a screen. */
const live = (byId: ReadonlyMap<string, SimScreen>, panels: PanelRef[] | undefined) => (panels ?? []).filter((ref) => resolveRef(byId, ref) !== null);

export function portSlots(device: SignalDevice, wiring: SimWiring, byId: ReadonlyMap<string, SimScreen>): Slot[] {
  const limit = signalLimit(device, byId);
  return Array.from({ length: device.ports }, (_, port) => ({
    ...slot(portKey(device.processorId, device.unit, port), port + 1, chainColor(port), live(byId, wiring.signal[portKey(device.processorId, device.unit, port)]), limit),
    card: device.groups.find((g) => port >= g.from && port < g.from + g.count)?.card ?? null,
  }));
}

/** Lines are coloured by their place over all boards, so two boards' lines differ too. */
export function lineSlots(wiring: SimWiring, byId: ReadonlyMap<string, SimScreen>): Map<string, Slot[]> {
  const limit = powerLimit(byId);
  const byBoard = new Map<string, Slot[]>();
  let index = 0;
  for (const board of wiring.power) {
    byBoard.set(
      board.id,
      board.lines.map((line, i) => {
        const panels = live(byId, line.panels);
        const currentA = panels.reduce((sum, ref) => sum + (resolveRef(byId, ref)?.screen.panelCurrentA ?? 0), 0);
        const known = panels.some((ref) => limit.weight(ref) > 0);
        return { ...slot(lineKey(board.id, line.id), i + 1, chainColor(index++), panels, known || panels.length === 0 ? limit : null), currentA };
      }),
    );
  }
  return byBoard;
}

/** Panels on no port (of a processor in use) / on no line. */
export function unassigned(screens: SimScreen[], assigned: Iterable<PanelRef[]>): number {
  const byId = new Map(screens.map((s) => [s.id, s]));
  const on = new Set<PanelRef>();
  for (const panels of assigned) for (const ref of panels) if (resolveRef(byId, ref)) on.add(ref);
  return usedPanelCount(screens) - on.size;
}

/** Every port of the devices in use (assignments to a processor no longer picked count as none). */
export function signalAssigned(devices: SignalDevice[], wiring: SimWiring): PanelRef[][] {
  return devices.flatMap((d) => Array.from({ length: d.ports }, (_, port) => wiring.signal[portKey(d.processorId, d.unit, port)] ?? []));
}

export const powerAssigned = (wiring: SimWiring) => Object.values(chainsOf(wiring, "power"));

export const boardName = (board: PowerBoard, index: number, fallback: (n: number) => string) => board.name ?? fallback(index + 1);
