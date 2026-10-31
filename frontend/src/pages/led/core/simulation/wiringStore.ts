/**
 * Simülasyon's wiring, made by hand only: which panels go on which data port of which processor, and on which power
 * line of which board, in the order painted (that order is the chain). Nothing is suggested: a new project has every
 * panel unassigned. One record for the whole project (a port or a line may run over several screens), kept in this
 * browser.
 *
 * A panel is known by its screen and its place on it ("s1/3:0": column 3, row 0 from the bottom), so when a screen
 * changes on Pixel Map the panels that stay keep their port / line, the ones gone drop out and new ones come in
 * unassigned. Assignments to a port of a processor no longer picked on Processor are kept (it may come back) but
 * count as none meanwhile.
 *
 * Cells are `column × rows + row` (column 0 = left, row 0 = bottom), as on Pixel Map and in the server's chains.
 */

export type WiringKind = "signal" | "power";

/** A panel: "<screen id>/<column>:<row>", row 0 = bottom. */
export type PanelRef = string;

export interface PowerLine {
  id: string;
  panels: PanelRef[];
}

export interface PowerBoard {
  id: string;
  /** null = "Pano n" (its place in the list). */
  name: string | null;
  lines: PowerLine[];
}

export interface SimWiring {
  /** By port key ("<processor id>#<unit>:<port>", both 0-based): the port's panels in chain order. */
  signal: Record<string, PanelRef[]>;
  power: PowerBoard[];
}

export const WIRING_STORAGE_KEY = "led-calc-sim-wiring-v3";
export const DEFAULT_WIRING: SimWiring = { signal: {}, power: [{ id: "b1", name: null, lines: [{ id: "l1", panels: [] }] }] };

const MAX_CHAINS = 2000;
const MAX_BOARDS = 100;
const MAX_LINES = 200;
const MAX_NAME = 40;
const REF = /^[^/]{1,80}\/\d{1,4}:\d{1,4}$/;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const PORT_KEY = /^[^#]{1,80}#\d{1,3}:\d{1,4}$/;

export const panelRef = (screenId: string, cell: number, rows: number): PanelRef => `${screenId}/${Math.floor(cell / rows)}:${cell % rows}`;

export function parseRef(ref: PanelRef): { screenId: string; column: number; row: number } | null {
  const slash = ref.lastIndexOf("/");
  if (slash <= 0) return null;
  const [column, row] = ref.slice(slash + 1).split(":").map(Number);
  if (!Number.isInteger(column) || !Number.isInteger(row)) return null;
  return { screenId: ref.slice(0, slash), column, row };
}

export const portKey = (processorId: string, unit: number, port: number) => `${processorId}#${unit}:${port}`;
export const lineKey = (boardId: string, lineId: string) => `${boardId}/${lineId}`;

/** Wiring from localStorage: anything broken is dropped; a panel is on one port and one line at most. */
export function sanitizeWiring(raw: unknown): SimWiring {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const seenSignal = new Set<string>();
  const refs = (list: unknown, seen: Set<string>) =>
    Array.isArray(list)
      ? list.filter((r): r is string => {
          if (typeof r !== "string" || !REF.test(r) || seen.has(r)) return false;
          seen.add(r);
          return true;
        })
      : [];
  const signal: Record<string, PanelRef[]> = {};
  const rawSignal = value.signal && typeof value.signal === "object" && !Array.isArray(value.signal) ? (value.signal as Record<string, unknown>) : {};
  for (const [key, list] of Object.entries(rawSignal).slice(0, MAX_CHAINS)) {
    if (!PORT_KEY.test(key)) continue;
    const panels = refs(list, seenSignal);
    if (panels.length > 0) signal[key] = panels;
  }
  const seenPower = new Set<string>();
  const boardIds = new Set<string>();
  const power: PowerBoard[] = [];
  for (const b of Array.isArray(value.power) ? value.power.slice(0, MAX_BOARDS) : []) {
    if (!b || typeof b !== "object") continue;
    const board = b as Record<string, unknown>;
    if (typeof board.id !== "string" || !ID.test(board.id) || boardIds.has(board.id)) continue;
    boardIds.add(board.id);
    const lineIds = new Set<string>();
    const lines: PowerLine[] = [];
    for (const l of Array.isArray(board.lines) ? board.lines.slice(0, MAX_LINES) : []) {
      const line = l as Record<string, unknown> | null;
      if (!line || typeof line.id !== "string" || !ID.test(line.id) || lineIds.has(line.id)) continue;
      lineIds.add(line.id);
      lines.push({ id: line.id, panels: refs(line.panels, seenPower) });
    }
    const name = typeof board.name === "string" && board.name.trim() ? board.name.trim().slice(0, MAX_NAME) : null;
    power.push({ id: board.id, name, lines });
  }
  return { signal, power: Array.isArray(value.power) ? power : DEFAULT_WIRING.power };
}

/** One kind's chains by key (power: "<board>/<line>"), every line listed (empty ones too). */
export function chainsOf(wiring: SimWiring, kind: WiringKind): Record<string, PanelRef[]> {
  if (kind === "signal") return wiring.signal;
  const chains: Record<string, PanelRef[]> = {};
  for (const board of wiring.power) for (const line of board.lines) chains[lineKey(board.id, line.id)] = line.panels;
  return chains;
}

/** The wiring with one kind's chains replaced (power: the boards' lines refilled by key; empty ports dropped). */
export function withChains(wiring: SimWiring, kind: WiringKind, chains: Record<string, PanelRef[]>): SimWiring {
  if (kind === "signal") return { ...wiring, signal: Object.fromEntries(Object.entries(chains).filter(([, panels]) => panels.length > 0)) };
  return {
    ...wiring,
    power: wiring.power.map((board) => ({ ...board, lines: board.lines.map((line) => ({ ...line, panels: chains[lineKey(board.id, line.id)] ?? [] })) })),
  };
}

/** Panels no longer on any screen (screen gone, panel taken out, screen smaller) dropped from every chain. */
export function pruneWiring(wiring: SimWiring, live: (ref: PanelRef) => boolean): SimWiring {
  const keep = (panels: PanelRef[]) => (panels.every(live) ? panels : panels.filter(live));
  return withChains(withChains(wiring, "signal", mapValues(wiring.signal, keep)), "power", mapValues(chainsOf(wiring, "power"), keep));
}

/** A chain's limit: its panels may weigh at most `max` (port: pixels; line: each panel its share of its line limit). */
export interface ChainLimit {
  max: number;
  weight: (ref: PanelRef) => number;
}

const EPSILON = 1e-9;

export const chainLoad = (panels: PanelRef[], limit: ChainLimit) => panels.reduce((sum, ref) => sum + limit.weight(ref), 0);

/** Room on the chain for one more panel. */
export const hasRoom = (panels: PanelRef[], ref: PanelRef, limit: ChainLimit | null) =>
  !limit || !(limit.max > 0) || chainLoad(panels, limit) + limit.weight(ref) <= limit.max + EPSILON;

export interface PaintResult {
  chains: Record<string, PanelRef[]>;
  /** The limit stopped it: the panel refused (the rest of the stroke paints nothing). */
  full?: PanelRef;
}

/**
 * Panels painted onto chain `target` in this order (null = the eraser: taken off every chain). A panel leaves the
 * chain it was on (its own too: it goes to the end, so a chain repainted from its start takes the new order); the one
 * that would pass the limit is not added and the painting stops there.
 */
export function paintPanels(chains: Record<string, PanelRef[]>, refs: PanelRef[], target: string | null, limit: ChainLimit | null): PaintResult {
  let next = chains;
  for (const ref of refs) {
    const own = next[target ?? ""] ?? [];
    if (target !== null && !own.includes(ref) && !hasRoom(own, ref, limit)) return { chains: next, full: ref };
    const off: Record<string, PanelRef[]> = {};
    for (const [key, panels] of Object.entries(next)) off[key] = panels.includes(ref) ? panels.filter((r) => r !== ref) : panels;
    next = target === null ? off : { ...off, [target]: [...(off[target] ?? []), ref] };
  }
  return { chains: next };
}

/**
 * "Port 1 doldu: 4/4 panel": the panels on the full chain and how many it holds — as many as it has plus as many of
 * the refused panel's weight as still fit (for a uniform screen: the limit in panels).
 */
export function fullCount(panels: PanelRef[], refused: PanelRef, limit: ChainLimit): { count: number; of: number } {
  const weight = limit.weight(refused);
  const left = Math.max(0, limit.max - chainLoad(panels, limit));
  return { count: panels.length, of: panels.length + (weight > 0 ? Math.floor(left / weight + EPSILON) : 0) };
}

/**
 * The panels on the straight line from `from` to `to` (without `from`, with `to`), one grid step at a time, so a
 * pointer that jumped over panels still paints the ones in between; panels not used (cut out) are skipped.
 */
export function cellsBetween(from: number, to: number, rows: number, used: (cell: number) => boolean): number[] {
  const c0 = Math.floor(from / rows);
  const r0 = from % rows;
  const c1 = Math.floor(to / rows);
  const r1 = to % rows;
  const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
  const cells: number[] = [];
  for (let i = 1; i <= steps; i++) {
    const cell = Math.round(c0 + ((c1 - c0) * i) / steps) * rows + Math.round(r0 + ((r1 - r0) * i) / steps);
    if (used(cell) && cells[cells.length - 1] !== cell) cells.push(cell);
  }
  return cells;
}

/** Boards and lines: new ids are the next free number ("b3", "l7"). */
const nextId = (prefix: string, ids: string[]) => `${prefix}${Math.max(0, ...ids.map((id) => Number(id.slice(prefix.length)) || 0)) + 1}`;

export function addBoard(wiring: SimWiring): { wiring: SimWiring; id: string } {
  const id = nextId("b", wiring.power.map((b) => b.id));
  return { wiring: { ...wiring, power: [...wiring.power, { id, name: null, lines: [{ id: "l1", panels: [] }] }] }, id };
}

export function renameBoard(wiring: SimWiring, boardId: string, name: string): SimWiring {
  const trimmed = name.trim().slice(0, MAX_NAME);
  return { ...wiring, power: wiring.power.map((b) => (b.id === boardId ? { ...b, name: trimmed || null } : b)) };
}

/** The board and its lines gone: their panels unassigned. */
export function removeBoard(wiring: SimWiring, boardId: string): SimWiring {
  return { ...wiring, power: wiring.power.filter((b) => b.id !== boardId) };
}

export function addLine(wiring: SimWiring, boardId: string): { wiring: SimWiring; id: string } {
  const board = wiring.power.find((b) => b.id === boardId);
  const id = nextId("l", board?.lines.map((l) => l.id) ?? []);
  return { wiring: { ...wiring, power: wiring.power.map((b) => (b.id === boardId ? { ...b, lines: [...b.lines, { id, panels: [] }] } : b)) }, id };
}

/** Undo / redo over the whole wiring: at most this many steps back. */
export const MAX_HISTORY = 100;

export interface History {
  past: SimWiring[];
  future: SimWiring[];
}

function mapValues<T, U>(record: Record<string, T>, fn: (value: T) => U): Record<string, U> {
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, fn(v)]));
}
