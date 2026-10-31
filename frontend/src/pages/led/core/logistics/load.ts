import type { LedTransportKind, PlanStackDto, TransportGroupDto, TransportPlanResponse, TransportVehicle as TransportVehicleDto } from "../../../../api/ledTypes";
import { FALLBACK_KIND_COLOR, kindById, type TransportKindInfo } from "../transportKinds";

/**
 * Lojistik: a loading layout — vehicles with the stacks on their floor — that starts as the server's automatic plan
 * and can then be edited by hand (moved, turned, put in another vehicle). Everything here is in cm, seen from above:
 * x along the vehicle's length from the front (cab), y across its width from the left. The workspace's gap (`gapCm`)
 * is kept between two stacks and between a stack and a wall: closer counts as a problem, and the fills and the free
 * length are worked out with it.
 */

/** A stack of one model's cases (as the plan returns it). */
export type LoadItem = PlanStackDto;

export interface LoadVehicle {
  /** This vehicle in the layout ("v1", "v2", …): two vehicles of one type are told apart by it. */
  uid: string;
  typeId: string;
  items: LoadItem[];
}

export interface LoadLayout {
  vehicles: LoadVehicle[];
  /** Stacks in no vehicle: what fits none (automatic plan). */
  unplaced: LoadItem[];
}

/** "auto" or a vehicle type id. */
export type VehicleMode = string;
export const AUTO_MODE = "auto";

/**
 * What the page keeps in this browser: the vehicle choice, the layout edited by hand (null = automatic) and whether a
 * stack dropped where it does not fit goes to the nearest free place ("Boşluğa yerleştir").
 */
export interface LogisticsState {
  vehicleMode: VehicleMode;
  manual: { signature: string; layout: LoadLayout } | null;
  autoFit: boolean;
}

export const DEFAULT_LOGISTICS: LogisticsState = { vehicleMode: AUTO_MODE, manual: null, autoFit: true };

/** An arrow key moves the selected stack 1 cm, with Shift 10 cm. */
export const KEY_STEP_CM = 1;
export const KEY_STEP_BIG_CM = 10;
/** How near a dragged stack is pulled to a wall or a neighbour — screen pixels, so it feels the same at every zoom. */
export const MAGNET_PX = 16;

const EPS = 1e-6;

/** A model's cases with its kind as the page shows it: name, colour, place in the tabs, panels or units. */
export type PlanGroup = TransportGroupDto & { kindName: string; kindColor: string; kindOrder: number; units: boolean };

export type Groups = ReadonlyMap<string, PlanGroup>;
export type VehicleTypes = ReadonlyMap<string, TransportVehicleDto>;

/** The plan's groups by model, each with its kind (a model of an LED-panel kind counts panels, any other units). */
export function groupsOf(plan: Pick<TransportPlanResponse, "groups">, kinds?: readonly TransportKindInfo[]): Groups {
  return new Map(
    plan.groups.map((g) => {
      const kind = kindById(kinds, g.kind);
      return [
        g.equipmentId,
        {
          ...g,
          kindName: kind?.name ?? "",
          kindColor: kind?.color ?? FALLBACK_KIND_COLOR,
          kindOrder: kind?.sortOrder ?? Number.MAX_SAFE_INTEGER,
          units: kind ? kind.template !== "LedPanel" : false,
        },
      ];
    }),
  );
}
export const typesOf = (plan: Pick<TransportPlanResponse, "vehicleTypes">): VehicleTypes => new Map(plan.vehicleTypes.map((v) => [v.id, v]));
/** The plan's gap between the stacks and to the walls, in cm. */
export const gapOf = (plan: Pick<TransportPlanResponse, "gapMm">) => plan.gapMm / 10;

/** The automatic plan as a layout. */
export function layoutFromPlan(plan: TransportPlanResponse): LoadLayout {
  return {
    vehicles: plan.vehicles.map((v, i) => ({ uid: `v${i + 1}`, typeId: v.typeId, items: v.stacks.map((s) => ({ ...s })) })),
    unplaced: plan.unplaced.map((s) => ({ ...s })),
  };
}

/**
 * What a hand-made layout was made for: the cases of every model and the vehicle types. When this changes (other
 * screens, other case data, other vehicles) the old layout no longer fits and the automatic one is used again.
 */
export function planSignature(plan: TransportPlanResponse, vehicleMode: VehicleMode): string {
  return JSON.stringify([
    vehicleMode,
    plan.gapMm,
    plan.groups.map((g) => [g.equipmentId, g.cases, g.panels, g.heightCm, g.widthCm, g.depthCm, g.caseWeightKg, g.maxStack]),
    plan.vehicleTypes.map((v) => [v.id, v.lengthMm, v.widthMm, v.heightMm, v.capacityKg]),
  ]);
}

/** The layout Lojistik shows: the one made by hand while it still fits the job, else the automatic plan. */
export function currentLayout(plan: TransportPlanResponse, state: Pick<LogisticsState, "manual">, vehicleMode: VehicleMode): LoadLayout {
  return state.manual && state.manual.signature === planSignature(plan, vehicleMode) ? state.manual.layout : layoutFromPlan(plan);
}

/** Vehicle load space in cm. */
export function spaceOf(type: TransportVehicleDto) {
  return { length: type.lengthMm / 10, width: type.widthMm / 10, height: type.heightMm / 10 };
}

/** A stack's footprint: along the length (dx) and across (dy); turned = the case's width along the length. */
export function footprint(item: LoadItem, group: TransportGroupDto) {
  return item.rotated ? { dx: group.widthCm, dy: group.depthCm } : { dx: group.depthCm, dy: group.widthCm };
}

export const stackHeight = (item: LoadItem, group: TransportGroupDto) => item.cases * group.heightCm;
export const stackWeight = (item: LoadItem, group: TransportGroupDto) => item.cases * (group.caseWeightKg ?? 0);

/** Positions are kept to the mm (never -0). */
const toMm = (cm: number) => Math.round(cm * 10) / 10 || 0;

/** A footprint on a vehicle floor (cm). */
interface Box {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/** Two footprints closer than the gap to each other (on each other when the gap is 0). */
const tooClose = (a: Box, b: Box, g: number) =>
  a.x < b.x + b.dx + g - EPS && b.x < a.x + a.dx + g - EPS && a.y < b.y + b.dy + g - EPS && b.y < a.y + a.dy + g - EPS;

/** A footprint (partly) outside the floor, or closer than the gap to a wall. */
const offFloor = (b: Box, space: { length: number; width: number }, g: number) =>
  b.x < g - EPS || b.y < g - EPS || b.x + b.dx + g > space.length + EPS || b.y + b.dy + g > space.width + EPS;

/** The stacks of a vehicle with their footprints. */
function boxesOf(vehicle: LoadVehicle, groups: Groups) {
  return vehicle.items.flatMap((item) => {
    const group = groups.get(item.equipmentId);
    return group ? [{ item, group, x: item.x, y: item.y, ...footprint(item, group) }] : [];
  });
}

// ---------------------------------------------------------------- Problems

export type ItemProblem = "outside" | "overlap" | "tooTall";

/**
 * What is wrong with each stack (outside its vehicle or closer than the gap to a wall, on another stack or closer than
 * the gap to it, above the roof); stacks without problems are left out.
 */
export function itemProblems(layout: LoadLayout, groups: Groups, types: VehicleTypes, gapCm = 0): Map<string, Set<ItemProblem>> {
  const g = gapCm;
  const problems = new Map<string, Set<ItemProblem>>();
  const add = (id: string, p: ItemProblem) => {
    if (!problems.has(id)) problems.set(id, new Set());
    problems.get(id)!.add(p);
  };
  for (const vehicle of layout.vehicles) {
    const type = types.get(vehicle.typeId);
    if (!type) continue;
    const space = spaceOf(type);
    const boxes = boxesOf(vehicle, groups);
    for (const b of boxes) {
      if (offFloor(b, space, g)) add(b.item.id, "outside");
      if (stackHeight(b.item, b.group) > space.height + EPS) add(b.item.id, "tooTall");
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        if (tooClose(boxes[i], boxes[j], g)) {
          add(boxes[i].item.id, "overlap");
          add(boxes[j].item.id, "overlap");
        }
      }
  }
  return problems;
}

// ---------------------------------------------------------------- Totals

export interface VehicleTotals {
  cases: number;
  dollies: number;
  panels: number;
  weightKg: number;
  capacityKg: number;
  /** Floor and volume used, 0–1 (or more when stacks overlap): every stack with the gap around it. */
  floorFill: number;
  volumeFill: number;
  /** Free length behind the last stack (cm): what one more row may take, its gaps before and after left out. */
  freeLengthCm: number;
  overWeight: boolean;
}

export function vehicleTotals(vehicle: LoadVehicle, groups: Groups, type: TransportVehicleDto, gapCm = 0): VehicleTotals {
  const space = spaceOf(type);
  const g = gapCm;
  let cases = 0;
  let dollies = 0;
  let panels = 0;
  let weightKg = 0;
  let floor = 0;
  let volume = 0;
  // The front wall's gap, then each stack's own size + the gap behind it.
  let end = g;
  for (const item of vehicle.items) {
    const group = groups.get(item.equipmentId);
    if (!group) continue;
    const { dx, dy } = footprint(item, group);
    if (group.kind === "Dolly") dollies += item.cases;
    else cases += item.cases;
    panels += item.panels;
    weightKg += stackWeight(item, group);
    floor += (dx + g) * (dy + g);
    volume += (dx + g) * (dy + g) * stackHeight(item, group);
    end = Math.max(end, item.x + dx + g);
  }
  return {
    cases,
    dollies,
    panels,
    weightKg,
    capacityKg: type.capacityKg,
    floorFill: floor / (space.length * space.width),
    volumeFill: volume / (space.length * space.width * space.height),
    freeLengthCm: Math.max(0, space.length - end - g),
    overWeight: weightKg > type.capacityKg + EPS,
  };
}

export interface LoadSummary extends VehicleTotals {
  vehicles: number;
  /** Cases / dollies in no vehicle. */
  unplacedCases: number;
  /** Models whose case weight is not entered (counted as 0). */
  unknownWeight: number;
  /** Over 100 % of a vehicle's floor or volume (stacks laid over each other). */
  overVolume: boolean;
}

/** The whole layout: totals over every vehicle; fills against their total floor / volume; free length of the last one. */
export function loadSummary(layout: LoadLayout, groups: Groups, types: VehicleTypes, gapCm = 0): LoadSummary {
  const per = layout.vehicles.flatMap((v) => {
    const type = types.get(v.typeId);
    return type ? [{ totals: vehicleTotals(v, groups, type, gapCm), space: spaceOf(type) }] : [];
  });
  const sum = (f: (t: VehicleTotals) => number) => per.reduce((s, p) => s + f(p.totals), 0);
  const floorAll = per.reduce((s, p) => s + p.space.length * p.space.width, 0);
  const volumeAll = per.reduce((s, p) => s + p.space.length * p.space.width * p.space.height, 0);
  const floorUsed = per.reduce((s, p) => s + p.totals.floorFill * p.space.length * p.space.width, 0);
  const volumeUsed = per.reduce((s, p) => s + p.totals.volumeFill * p.space.length * p.space.width * p.space.height, 0);
  return {
    vehicles: per.length,
    cases: sum((t) => t.cases),
    dollies: sum((t) => t.dollies),
    panels: sum((t) => t.panels),
    weightKg: sum((t) => t.weightKg),
    capacityKg: sum((t) => t.capacityKg),
    floorFill: floorAll > 0 ? floorUsed / floorAll : 0,
    volumeFill: volumeAll > 0 ? volumeUsed / volumeAll : 0,
    freeLengthCm: per.length > 0 ? per[per.length - 1].totals.freeLengthCm : 0,
    overWeight: per.some((p) => p.totals.overWeight),
    overVolume: per.some((p) => p.totals.floorFill > 1 + EPS || p.totals.volumeFill > 1 + EPS),
    unplacedCases: layout.unplaced.reduce((s, i) => s + i.cases, 0),
    unknownWeight: [...groups.values()].filter((g) => g.caseWeightKg === null).length,
  };
}

// ---------------------------------------------------------------- Edits (each returns a new layout)

function findItem(layout: LoadLayout, id: string): { item: LoadItem; vehicle: LoadVehicle | null } | null {
  for (const vehicle of layout.vehicles) {
    const item = vehicle.items.find((i) => i.id === id);
    if (item) return { item, vehicle };
  }
  const item = layout.unplaced.find((i) => i.id === id);
  return item ? { item, vehicle: null } : null;
}

export const vehicleOfItem = (layout: LoadLayout, id: string) => findItem(layout, id)?.vehicle ?? null;

function without(layout: LoadLayout, id: string): LoadLayout {
  return {
    vehicles: layout.vehicles.map((v) => (v.items.some((i) => i.id === id) ? { ...v, items: v.items.filter((i) => i.id !== id) } : v)),
    unplaced: layout.unplaced.filter((i) => i.id !== id),
  };
}

/** Puts a stack at (x, y) of a vehicle (the same or another one), to the mm. */
export function moveItem(layout: LoadLayout, id: string, vehicleUid: string, x: number, y: number): LoadLayout {
  const found = findItem(layout, id);
  if (!found || !layout.vehicles.some((v) => v.uid === vehicleUid)) return layout;
  const moved = { ...found.item, x: toMm(x), y: toMm(y) };
  const rest = without(layout, id);
  return { ...rest, vehicles: rest.vehicles.map((v) => (v.uid === vehicleUid ? { ...v, items: [...v.items, moved] } : v)) };
}

/** Turns a stack 90° around its centre (to the mm). */
export function rotateItem(layout: LoadLayout, id: string, groups: Groups): LoadLayout {
  const found = findItem(layout, id);
  const group = found && groups.get(found.item.equipmentId);
  if (!found || !group || !found.vehicle) return layout;
  const { dx, dy } = footprint(found.item, group);
  const cx = found.item.x + dx / 2;
  const cy = found.item.y + dy / 2;
  const turned = { ...found.item, rotated: !found.item.rotated };
  const next = footprint(turned, group);
  const item = { ...turned, x: toMm(cx - next.dx / 2), y: toMm(cy - next.dy / 2) };
  return {
    ...layout,
    vehicles: layout.vehicles.map((v) => (v === found.vehicle ? { ...v, items: v.items.map((i) => (i.id === id ? item : i)) } : v)),
  };
}

/**
 * Moves a stack into another vehicle: behind its last stack (the gap left) — the page shows it red when that is past
 * the rear, until it is moved to a free spot.
 */
export function sendToVehicle(layout: LoadLayout, id: string, vehicleUid: string, groups: Groups, gapCm = 0): LoadLayout {
  const target = layout.vehicles.find((v) => v.uid === vehicleUid);
  if (!target) return layout;
  const end = target.items.reduce((max, i) => {
    const group = groups.get(i.equipmentId);
    return group && i.id !== id ? Math.max(max, i.x + footprint(i, group).dx + gapCm) : max;
  }, gapCm);
  return moveItem(layout, id, vehicleUid, end, gapCm);
}

// ---------------------------------------------------------------- Dragging: magnet, free place, readout

/** A guide line on a vehicle floor (cm): an edge the dragged stack lines up with. */
export interface Guide {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Magnet {
  x: number;
  y: number;
  /** Pulled to a wall, a neighbour or an edge on either axis. */
  snapped: boolean;
  guides: Guide[];
}

/** The stack, its footprint and the other stacks of a vehicle; null when one of them is not there. */
function dragContext(layout: LoadLayout, id: string, vehicleUid: string, groups: Groups, types: VehicleTypes) {
  const vehicle = layout.vehicles.find((v) => v.uid === vehicleUid);
  const type = vehicle && types.get(vehicle.typeId);
  const found = findItem(layout, id);
  const group = found && groups.get(found.item.equipmentId);
  if (!vehicle || !type || !found || !group) return null;
  return { type, space: spaceOf(type), item: found.item, group, ...footprint(found.item, group), others: boxesOf(vehicle, groups).filter((b) => b.item.id !== id) };
}

/**
 * Where a stack dragged to (x, y) of a vehicle lands. On each axis the candidates within `thresholdCm` are a wall (at
 * the gap), the side of a neighbour it is beside (at the gap) and a neighbour's edge (lined up); of every pair of them
 * (or the drop point's own line) the one chosen is free (on no stack, inside), then fits most of its surroundings
 * (walls, gaps and edges it meets — so a stack put back near its old place goes exactly there), then is nearest. The
 * guides are the neighbour edges it then lines up with.
 */
export function magnetize(
  layout: LoadLayout,
  id: string,
  vehicleUid: string,
  x: number,
  y: number,
  groups: Groups,
  types: VehicleTypes,
  gapCm: number,
  thresholdCm: number,
): Magnet {
  const c = dragContext(layout, id, vehicleUid, groups, types);
  if (!c || thresholdCm <= 0) return { x: toMm(x), y: toMm(y), snapped: false, guides: [] };
  const g = gapCm;
  const { dx, dy, space, others } = c;
  // A neighbour's side counts when the two are beside each other (their ranges across meet, give or take the reach).
  const beside = (a0: number, a1: number, b0: number, b1: number, reach: number) => a0 < b1 + g + reach && b0 < a1 + g + reach;
  const xs = [g, space.length - g - dx];
  const ys = [g, space.width - g - dy];
  for (const o of others) {
    if (beside(y, y + dy, o.y, o.y + o.dy, thresholdCm)) xs.push(o.x + o.dx + g, o.x - g - dx);
    if (beside(x, x + dx, o.x, o.x + o.dx, thresholdCm)) ys.push(o.y + o.dy + g, o.y - g - dy);
    xs.push(o.x, o.x + o.dx - dx);
    ys.push(o.y, o.y + o.dy - dy);
  }
  const reach = (v: number) => (cands: number[]) => [v, ...cands.filter((cand) => Math.abs(cand - v) <= thresholdCm + EPS)];
  const same = (a: number, b: number) => Math.abs(a - b) < 0.05;

  /** How many walls, neighbour gaps and neighbour edges a place meets. */
  function contacts(bx: number, by: number) {
    let n = [same(bx, g), same(bx + dx + g, space.length), same(by, g), same(by + dy + g, space.width)].filter(Boolean).length;
    for (const o of others) {
      if (same(bx, o.x) || same(bx + dx, o.x + o.dx)) n++;
      if (same(by, o.y) || same(by + dy, o.y + o.dy)) n++;
      if (beside(by, by + dy, o.y, o.y + o.dy, 0) && (same(bx, o.x + o.dx + g) || same(bx + dx + g, o.x))) n++;
      if (beside(bx, bx + dx, o.x, o.x + o.dx, 0) && (same(by, o.y + o.dy + g) || same(by + dy + g, o.y))) n++;
    }
    return n;
  }

  let best = { x, y, free: false, contacts: -1, distance: Infinity };
  for (const cx of reach(x)(xs))
    for (const cy of reach(y)(ys)) {
      const box = { x: cx, y: cy, dx, dy };
      const free = !offFloor(box, space, g) && !others.some((o) => tooClose(box, o, g));
      const n = contacts(cx, cy);
      const distance = Math.hypot(cx - x, cy - y);
      const better =
        free !== best.free ? free : n !== best.contacts ? n > best.contacts : distance < best.distance - EPS;
      if (better) best = { x: cx, y: cy, free, contacts: n, distance };
    }
  const nx = toMm(best.x);
  const ny = toMm(best.y);
  const guides: Guide[] = [];
  for (const o of others) {
    const top = Math.min(ny, o.y);
    const bottom = Math.max(ny + dy, o.y + o.dy);
    const left = Math.min(nx, o.x);
    const right = Math.max(nx + dx, o.x + o.dx);
    if (same(nx, o.x)) guides.push({ x1: nx, y1: top, x2: nx, y2: bottom });
    if (same(nx + dx, o.x + o.dx)) guides.push({ x1: nx + dx, y1: top, x2: nx + dx, y2: bottom });
    if (same(ny, o.y)) guides.push({ x1: left, y1: ny, x2: right, y2: ny });
    if (same(ny + dy, o.y + o.dy)) guides.push({ x1: left, y1: ny + dy, x2: right, y2: ny + dy });
  }
  return { x: nx, y: ny, snapped: Math.abs(best.x - x) > EPS || Math.abs(best.y - y) > EPS, guides };
}

/** Why a stack fits nowhere in a vehicle. */
export type NoFitReason = "tooTall" | "tooBig" | "noSpace";
export type FreeSpot = { x: number; y: number } | { reason: NoFitReason };

/**
 * The free place nearest to (x, y) for a stack in a vehicle: inside, at the gap from the walls and from every other
 * stack. The nearest free point lies, on each axis, on the drop point's own line or on a wall's or a neighbour's gap
 * line, so those are the candidates.
 */
export function findFreeSpot(layout: LoadLayout, id: string, vehicleUid: string, x: number, y: number, groups: Groups, types: VehicleTypes, gapCm: number): FreeSpot {
  const c = dragContext(layout, id, vehicleUid, groups, types);
  if (!c) return { reason: "noSpace" };
  const g = gapCm;
  const { dx, dy, space } = c;
  if (stackHeight(c.item, c.group) > space.height + EPS) return { reason: "tooTall" };
  if (dx + 2 * g > space.length + EPS || dy + 2 * g > space.width + EPS) return { reason: "tooBig" };
  const within = (v: number, max: number) => v >= g - EPS && v <= max + EPS;
  const xs = [x, g, space.length - g - dx, ...c.others.flatMap((o) => [o.x + o.dx + g, o.x - g - dx])].filter((v) => within(v, space.length - g - dx));
  const ys = [y, g, space.width - g - dy, ...c.others.flatMap((o) => [o.y + o.dy + g, o.y - g - dy])].filter((v) => within(v, space.width - g - dy));
  let best: { x: number; y: number } | null = null;
  let distance = Infinity;
  for (const cx of xs)
    for (const cy of ys) {
      const d = Math.hypot(cx - x, cy - y);
      if (d >= distance) continue;
      const box = { x: cx, y: cy, dx, dy };
      if (c.others.some((o) => tooClose(box, o, g))) continue;
      best = { x: toMm(cx), y: toMm(cy) };
      distance = d;
    }
  return best ?? { reason: "noSpace" };
}

/** Where a stack stands (from the front and the left wall) and the free space to the nearest neighbour or wall each way (cm). */
export interface Clearance {
  x: number;
  y: number;
  front: number;
  rear: number;
  left: number;
  right: number;
  /** On another stack. */
  clash: boolean;
}

export function clearances(vehicle: LoadVehicle, id: string, groups: Groups, type: TransportVehicleDto): Clearance | null {
  const boxes = boxesOf(vehicle, groups);
  const b = boxes.find((x) => x.item.id === id);
  if (!b) return null;
  const space = spaceOf(type);
  const others = boxes.filter((o) => o !== b);
  const acrossMeet = (o: Box) => o.y < b.y + b.dy - EPS && b.y < o.y + o.dy - EPS;
  const alongMeet = (o: Box) => o.x < b.x + b.dx - EPS && b.x < o.x + o.dx - EPS;
  let front = b.x;
  let rear = space.length - (b.x + b.dx);
  let left = b.y;
  let right = space.width - (b.y + b.dy);
  for (const o of others) {
    if (acrossMeet(o) && o.x + o.dx <= b.x + EPS) front = Math.min(front, b.x - (o.x + o.dx));
    if (acrossMeet(o) && o.x >= b.x + b.dx - EPS) rear = Math.min(rear, o.x - (b.x + b.dx));
    if (alongMeet(o) && o.y + o.dy <= b.y + EPS) left = Math.min(left, b.y - (o.y + o.dy));
    if (alongMeet(o) && o.y >= b.y + b.dy - EPS) right = Math.min(right, o.y - (b.y + b.dy));
  }
  return {
    x: b.x,
    y: b.y,
    front: toMm(front),
    rear: toMm(rear),
    left: toMm(left),
    right: toMm(right),
    clash: others.some((o) => tooClose(b, o, 0)),
  };
}

/** One more (empty) vehicle of a type. */
export function addVehicle(layout: LoadLayout, typeId: string): LoadLayout {
  const next = layout.vehicles.reduce((max, v) => Math.max(max, Number(v.uid.slice(1)) || 0), 0) + 1;
  return { ...layout, vehicles: [...layout.vehicles, { uid: `v${next}`, typeId, items: [] }] };
}

/** Removes an empty vehicle (one with stacks stays). */
export function removeVehicle(layout: LoadLayout, uid: string): LoadLayout {
  return { ...layout, vehicles: layout.vehicles.filter((v) => v.uid !== uid || v.items.length > 0) };
}

// ---------------------------------------------------------------- Stored state

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function sanitizeItem(raw: unknown): LoadItem | null {
  const i = raw as Partial<LoadItem> | null;
  if (!i || typeof i.id !== "string" || typeof i.equipmentId !== "string") return null;
  if (!isNum(i.cases) || !isNum(i.panels) || !isNum(i.x) || !isNum(i.y)) return null;
  return { id: i.id, equipmentId: i.equipmentId, cases: i.cases, panels: i.panels, x: i.x, y: i.y, rotated: i.rotated === true };
}

/** A stored state from an older version or another tab: anything that does not fit is dropped. */
export function sanitizeLogisticsState(value: LogisticsState): LogisticsState {
  const mode = typeof value?.vehicleMode === "string" && value.vehicleMode ? value.vehicleMode : AUTO_MODE;
  const autoFit = value?.autoFit !== false;
  const manual = value?.manual;
  if (!manual || typeof manual.signature !== "string" || !manual.layout || !Array.isArray(manual.layout.vehicles)) return { vehicleMode: mode, manual: null, autoFit };
  const vehicles = manual.layout.vehicles.flatMap((v) =>
    v && typeof v.uid === "string" && typeof v.typeId === "string" && Array.isArray(v.items)
      ? [{ uid: v.uid, typeId: v.typeId, items: v.items.map(sanitizeItem).filter((i): i is LoadItem => i !== null) }]
      : [],
  );
  const unplaced = (Array.isArray(manual.layout.unplaced) ? manual.layout.unplaced : []).map(sanitizeItem).filter((i): i is LoadItem => i !== null);
  return { vehicleMode: mode, manual: { signature: manual.signature, layout: { vehicles, unplaced } }, autoFit };
}

// ---------------------------------------------------------------- Labels and colours

/** "Roe BP2 V2" */
export const groupName = (group: Pick<TransportGroupDto, "code" | "name">) => `${group.code} ${group.name}`;

const PALETTE = ["#a78bfa", "#38bdf8", "#f59e0b", "#34d399", "#f472b6", "#fb7185", "#facc15", "#2dd4bf", "#c084fc", "#60a5fa"];

/** The plan holds more than one kind: then the drawing is coloured by kind. */
export const isMultiKind = (groups: Groups) => new Set([...groups.values()].map((g) => g.kind)).size > 1;

/**
 * A model's colour on the drawing and in the legend: by its place in the plan's list (one kind only, as before), or by
 * its kind when several kinds travel.
 */
export function groupColor(groups: Groups, equipmentId: string): string {
  if (isMultiKind(groups)) return groups.get(equipmentId)?.kindColor ?? FALLBACK_KIND_COLOR;
  const index = [...groups.keys()].indexOf(equipmentId);
  return PALETTE[(index < 0 ? 0 : index) % PALETTE.length];
}

export interface KindLoad {
  kind: string;
  name: string;
  color: string;
  models: number;
  units: number;
  cases: number;
  dollies: number;
  /** Known case weights only (a model without one counts 0). */
  weightKg: number;
}

/** Per kind (in the tabs' order): its models, units, cases / dollies and their weight. */
export function loadByKind(groups: Groups): KindLoad[] {
  const all = [...groups.values()];
  const ids = [...new Set([...all].sort((a, b) => a.kindOrder - b.kindOrder).map((g) => g.kind))];
  return ids.flatMap((kindId: LedTransportKind) => {
    const list = all.filter((g) => g.kind === kindId);
    if (list.length === 0) return [];
    const cases = (kind: TransportGroupDto["kind"]) => list.filter((g) => g.kind === kind).reduce((s, g) => s + g.cases, 0);
    return [
      {
        kind: kindId,
        name: list[0].kindName,
        color: list[0].kindColor,
        models: list.length,
        units: list.reduce((s, g) => s + g.panels, 0),
        cases: cases("Case"),
        dollies: cases("Dolly"),
        weightKg: list.reduce((s, g) => s + (g.caseWeightKg ?? 0) * g.cases, 0),
      },
    ];
  });
}
