import type { Vec3 } from "./camera";
import { faceOf, type PlacedScreen, type SceneLayout } from "./scene";
import type { StageSettings } from "./settings";

/**
 * 3D Sahne's carriers, as plain geometry (tubes and blocks, metres) — what holds each screen: an LED frame (LED
 * demiri) or scaff towers behind it when ground mounted, a truss when flown. The drawing turns these into instanced
 * meshes; the ground carriers also count their parts (the parts list).
 */

export type TubeKind = "steel" | "scaff" | "truss" | "rope";
export type BlockKind = "plate" | "rubber" | "profile" | "clamp" | "header";

/** A tube from a to b. */
export interface Tube {
  a: Vec3;
  b: Vec3;
  radius: number;
  kind: TubeKind;
}

/** A box: its centre, its size, turned `yaw` radians about the vertical axis. */
export interface Block {
  center: Vec3;
  size: Vec3;
  yaw: number;
  kind: BlockKind;
}

/** What a ground carrier is made of, to order: LED demiri posts with their 2 m and 1 m pieces, or scaff parts. */
export type CarrierBom =
  | { kind: "LedFrame"; posts: number; twoM: number; oneM: number }
  | { kind: "Scaff"; uprights: number; ledgers: number; diagonals: number; basePlates: number };

export interface CarrierModel {
  screenId: string;
  tubes: Tube[];
  blocks: Block[];
  /** Ground carriers: the parts to order. */
  bom?: CarrierBom;
}

/** LED demiri: fixed depth of its base. */
export const LED_FRAME_DEPTH_M = 1;
/** LED demiri: the first (bottom) tier's height, then 1 m tiers. */
const LED_FRAME_FIRST_TIER_M = 2;
const LED_FRAME_TIER_M = 1;
/** Scaff: uprights at most this far apart along the screen; a ledger every 2 m up. */
const SCAFF_BAY_M = 2.4;
const SCAFF_LIFT_M = 2;
/** The carrier stands this far behind the screen's face (the cabinets' depth and a little air). */
const BEHIND_FACE_M = 0.12;

const round = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Where the LED frame's posts go along a screen `widthM` wide, from its left edge: 0.5 m in from both ends, then every
 * 2 m. What is left at the end stays as its own (shorter) gap when it is 1 m or more; less than 1 m is added to the
 * gap before. 6 m → 0.5 / 2.5 / 4.5 / 5.5; 8 m → 0.5 / 2.5 / 4.5 / 6.5 / 7.5; 7.5 m → 0.5 / 2.5 / 4.5 / 7.0.
 */
export function ledFramePosts(widthM: number): number[] {
  if (widthM <= 1) return [round(widthM / 2)];
  const first = 0.5;
  const last = widthM - 0.5;
  const posts = [first];
  while (last - posts[posts.length - 1] > 2 + 1e-9) posts.push(posts[posts.length - 1] + 2);
  const leftover = last - posts[posts.length - 1];
  // Less than 1 m left (but not nothing): that bit goes into the gap before, unless the first post is the only one.
  if (leftover > 1e-9 && leftover < 1 - 1e-9 && posts.length > 1) posts.pop();
  if (last - posts[posts.length - 1] > 1e-9) posts.push(last);
  return posts.map(round);
}

/**
 * The LED frame's pieces from the bottom, by height: one 2 m piece, then as many 1 m pieces as fit under the screen's
 * top — the frame never stands above the screen (4.16 m → 2 + 1 + 1 = 4 m, the 0.16 m left stays free). A screen
 * whose top is lower than 2 m still gets the one 2 m piece (there is no shorter one).
 */
export function ledFrameModules(heightM: number): number[] {
  const ones = Math.max(0, Math.floor(heightM - LED_FRAME_FIRST_TIER_M + 1e-9));
  return [LED_FRAME_FIRST_TIER_M, ...Array<number>(ones).fill(LED_FRAME_TIER_M)];
}

/** Scaff uprights along a screen: both ends and evenly between them, at most 2.4 m apart. */
export function scaffColumns(widthM: number): number[] {
  const bays = Math.max(1, Math.ceil(widthM / SCAFF_BAY_M - 1e-9));
  return Array.from({ length: bays + 1 }, (_, i) => round((widthM * i) / bays));
}

/** Scaff ledger heights above the base: every 2 m, and the top. */
export function scaffLevels(heightM: number): number[] {
  const levels = [0];
  while (levels[levels.length - 1] + SCAFF_LIFT_M < heightM - 1e-9) levels.push(levels[levels.length - 1] + SCAFF_LIFT_M);
  levels.push(heightM);
  return levels.map(round);
}

/** A point on a screen's face at `s` metres along it from its left edge, and the direction straight back from there. */
export function faceFrame(placed: PlacedScreen): (s: number) => { x: number; z: number; backX: number; backZ: number } {
  const pts = faceOf(placed);
  return (s: number) => {
    let rest = Math.max(0, Math.min(placed.screen.widthM, s));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (rest <= len + 1e-9 || i === pts.length - 2) {
        const tx = (b.x - a.x) / (len || 1);
        const tz = (b.z - a.z) / (len || 1);
        const k = len > 0 ? Math.min(1, rest / len) : 0;
        return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, backX: tz, backZ: -tx };
      }
      rest -= len;
    }
    return { x: pts[0].x, z: pts[0].z, backX: 0, backZ: -1 };
  };
}

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const tube = (a: Vec3, b: Vec3, radius: number, kind: TubeKind): Tube => ({ a, b, radius, kind });

/** Space left between two stacked LED frame pieces, so every joint shows. */
const LED_FRAME_JOINT_M = 0.02;

/**
 * LED demiri behind one screen: a tower at every post, each a stack of separate pieces (2 m at the bottom, then 1 m
 * ones), every piece 1 m deep with its own front and rear uprights, its bottom and top rails and a diagonal; a clamp
 * at every joint. The bottom piece's bottom rail is the foot on the podium. It ends at or under the screen's top.
 */
export function ledFrame(placed: PlacedScreen, floorY: number): CarrierModel {
  const at = faceFrame(placed);
  const height = placed.bottom + placed.screen.heightM - floorY;
  const modules = ledFrameModules(height);
  const towers = ledFramePosts(placed.screen.widthM).map((s) => {
    const f = at(s);
    const front = { x: f.x + f.backX * BEHIND_FACE_M, z: f.z + f.backZ * BEHIND_FACE_M };
    return { front, rear: { x: front.x + f.backX * LED_FRAME_DEPTH_M, z: front.z + f.backZ * LED_FRAME_DEPTH_M }, yaw: Math.atan2(f.backX, f.backZ) };
  });
  const tubes: Tube[] = [];
  const blocks: Block[] = [];
  const R = 0.03;
  const half = LED_FRAME_JOINT_M / 2;
  for (const t of towers) {
    let y = floorY;
    modules.forEach((h, k) => {
      const y0 = y + (k === 0 ? 0 : half);
      const y1 = y + h - half;
      for (const p of [t.front, t.rear]) tubes.push(tube(v(p.x, y0, p.z), v(p.x, y1, p.z), R, "steel"));
      tubes.push(tube(v(t.front.x, y0 + 0.03, t.front.z), v(t.rear.x, y0 + 0.03, t.rear.z), R * 0.8, "steel"));
      tubes.push(tube(v(t.front.x, y1 - 0.03, t.front.z), v(t.rear.x, y1 - 0.03, t.rear.z), R * 0.8, "steel"));
      tubes.push(tube(v(t.rear.x, y0 + 0.03, t.rear.z), v(t.front.x, y1 - 0.03, t.front.z), R * 0.6, "steel"));
      // The joint on top of every piece but the last: a clamp on each upright.
      if (k < modules.length - 1) for (const p of [t.front, t.rear]) blocks.push({ center: v(p.x, y + h, p.z), size: v(0.1, 0.05, 0.1), yaw: t.yaw, kind: "clamp" });
      y += h;
    });
    for (const p of [t.front, t.rear]) blocks.push({ center: v(p.x, floorY + 0.005, p.z), size: v(0.2, 0.01, 0.2), yaw: t.yaw, kind: "plate" });
  }
  return { screenId: placed.screen.id, tubes, blocks, bom: { kind: "LedFrame", posts: towers.length, twoM: towers.length, oneM: towers.length * (modules.length - 1) } };
}

/**
 * Scaff towers behind one screen: uprights at most 2.4 m apart along it, a second row `legDepthM` behind, base plates
 * under each; ledgers every 2 m along both rows and across; a cross brace in every bay of both rows. From the podium
 * up to the screen's top.
 */
export function scaff(placed: PlacedScreen, floorY: number, legDepthM: number): CarrierModel {
  const at = faceFrame(placed);
  const height = placed.bottom + placed.screen.heightM - floorY;
  const levels = scaffLevels(height);
  const columns = scaffColumns(placed.screen.widthM).map((s) => {
    const f = at(s);
    const front = { x: f.x + f.backX * BEHIND_FACE_M, z: f.z + f.backZ * BEHIND_FACE_M };
    return { front, rear: { x: front.x + f.backX * legDepthM, z: front.z + f.backZ * legDepthM }, yaw: Math.atan2(f.backX, f.backZ) };
  });
  const tubes: Tube[] = [];
  const blocks: Block[] = [];
  const R = 0.024;
  const top = floorY + height;
  for (const c of columns) {
    for (const p of [c.front, c.rear]) {
      tubes.push(tube(v(p.x, floorY, p.z), v(p.x, top, p.z), R, "scaff"));
      blocks.push({ center: v(p.x, floorY + 0.005, p.z), size: v(0.15, 0.01, 0.15), yaw: c.yaw, kind: "plate" });
    }
    for (const y of levels) tubes.push(tube(v(c.front.x, floorY + y, c.front.z), v(c.rear.x, floorY + y, c.rear.z), R, "scaff"));
  }
  for (let i = 0; i < columns.length - 1; i++) {
    for (const row of ["front", "rear"] as const) {
      const a = columns[i][row];
      const b = columns[i + 1][row];
      for (const y of levels) tubes.push(tube(v(a.x, floorY + y, a.z), v(b.x, floorY + y, b.z), R, "scaff"));
      for (let k = 1; k < levels.length; k++) {
        // Alternating directions, as braces are laid up a tower.
        const [p, q] = (i + k) % 2 === 0 ? [a, b] : [b, a];
        tubes.push(tube(v(p.x, floorY + levels[k - 1], p.z), v(q.x, floorY + levels[k], q.z), R * 0.9, "scaff"));
      }
    }
  }
  const bays = columns.length - 1;
  const lifts = levels.length - 1;
  const bom: CarrierBom = {
    kind: "Scaff",
    uprights: columns.length * 2,
    // Across every column at every level, along both rows in every bay at every level.
    ledgers: columns.length * levels.length + bays * 2 * levels.length,
    diagonals: bays * 2 * lifts,
    basePlates: columns.length * 2,
  };
  return { screenId: placed.screen.id, tubes, blocks, bom };
}

/** The ground support's profile: always this tall and deep (its feet take up the rest of the height). */
export const GROUND_PROFILE_HEIGHT_M = 0.1;
export const GROUND_PROFILE_DEPTH_M = 0.24;
/** Feet about this far apart along the screen; a locking lever every this far on the profile's back. */
const GROUND_FOOT_SPACING_M = 1;
const GROUND_CLAMP_SPACING_M = 0.5;

/** `count` points evenly along a screen `widthM` wide, `inset` in from both ends (one in the middle when narrow). */
function evenly(widthM: number, spacing: number, inset: number): number[] {
  const span = widthM - 2 * inset;
  if (span <= 0) return [round(widthM / 2)];
  const gaps = Math.max(1, Math.ceil(span / spacing - 1e-9));
  return Array.from({ length: gaps + 1 }, (_, i) => round(inset + (span * i) / gaps));
}

/**
 * The column pieces of a bar running along a screen's face (curved screens: one piece per column), as blocks:
 * `height` tall, `depth` deep, its top at `topY`, standing `behind` metres back from the face.
 */
function barAlongFace(placed: PlacedScreen, topY: number, height: number, depth: number, behind: number, kind: BlockKind): Block[] {
  const at = faceFrame(placed);
  let s = 0;
  return placed.screen.columnWidthsM.map((w) => {
    const f = at(s + w / 2);
    s += w;
    const d = behind + depth / 2;
    return { center: v(f.x + f.backX * d, topY - height / 2, f.z + f.backZ * d), size: v(w, height, depth), yaw: Math.atan2(f.backX, f.backZ), kind };
  });
}

/**
 * Yer aparatı under one screen: an aluminium profile (24 cm deep, always 10 cm tall) right under the screen's bottom
 * edge along its whole width, round adjustable feet about every metre down to the podium with rubber pads, and
 * locking levers along the profile's back. A taller support only makes the feet longer.
 */
export function groundSupport(placed: PlacedScreen, floorY: number): { tubes: Tube[]; blocks: Block[] } {
  const at = faceFrame(placed);
  const profileTop = placed.bottom;
  const profileBottom = profileTop - GROUND_PROFILE_HEIGHT_M;
  const blocks = barAlongFace(placed, profileTop, GROUND_PROFILE_HEIGHT_M, GROUND_PROFILE_DEPTH_M, -0.08, "profile");
  const tubes: Tube[] = [];
  for (const s of evenly(placed.screen.widthM, GROUND_FOOT_SPACING_M, 0.25)) {
    const f = at(s);
    const d = -0.08 + GROUND_PROFILE_DEPTH_M / 2;
    const x = f.x + f.backX * d;
    const z = f.z + f.backZ * d;
    tubes.push(tube(v(x, floorY + 0.02, z), v(x, profileBottom, z), 0.02, "steel"));
    blocks.push({ center: v(x, floorY + 0.01, z), size: v(0.09, 0.02, 0.09), yaw: 0, kind: "rubber" });
  }
  for (const s of evenly(placed.screen.widthM, GROUND_CLAMP_SPACING_M, 0.25)) {
    const f = at(s);
    const d = -0.08 + GROUND_PROFILE_DEPTH_M + 0.02;
    blocks.push({ center: v(f.x + f.backX * d, profileTop - GROUND_PROFILE_HEIGHT_M / 2, f.z + f.backZ * d), size: v(0.05, 0.07, 0.04), yaw: Math.atan2(f.backX, f.backZ), kind: "clamp" });
  }
  return { tubes, blocks };
}

/** The flown truss: two chords this far apart, a diagonal every this far, the ropes at most this far apart. */
export const TRUSS_DEPTH_M = 0.3;
const TRUSS_PANEL_M = 0.5;
const ROPE_SPACING_M = 1;
const HEADER_HEIGHT_M = 0.08;
/** The truss line: this far behind the screens' faces; its ends this far past the screens. */
const TRUSS_Z_M = -0.15;
const TRUSS_OVERHANG_M = 1;
export const TRUSS_ID = "truss";

/** The truss line: just behind the rearmost screen face. */
export function trussZ(layout: SceneLayout): number {
  return Math.min(0, ...layout.screens.flatMap((p) => faceOf(p).map((f) => f.z))) + TRUSS_Z_M;
}

/** A flown screen's header profile on its top edge and its ropes up to the truss (`trussY` = the truss's kot, `z` its line). */
export function flownScreen(placed: PlacedScreen, trussY: number, z = TRUSS_Z_M): CarrierModel {
  const at = faceFrame(placed);
  const top = placed.bottom + placed.screen.heightM;
  const blocks = barAlongFace(placed, top + HEADER_HEIGHT_M, HEADER_HEIGHT_M, 0.15, -0.08, "header");
  const tubes = evenly(placed.screen.widthM, ROPE_SPACING_M, 0.25).map((s) => {
    const f = at(s);
    return tube(v(f.x + f.backX * 0.02, top + HEADER_HEIGHT_M, f.z + f.backZ * 0.02), v(f.x, trussY, z), 0.008, "rope");
  });
  return { screenId: placed.screen.id, tubes, blocks };
}

/**
 * The truss itself: two chords (its kot and 30 cm above) across the screens and 1 m past them, a diagonal in every
 * 50 cm, and at each end a leg down to the podium (or the floor beside it) with a base plate.
 */
export function truss(layout: SceneLayout, s: StageSettings): CarrierModel {
  const xs = layout.screens.flatMap((p) => faceOf(p).map((f) => f.x));
  const left = Math.min(...xs) - TRUSS_OVERHANG_M;
  const right = Math.max(...xs) + TRUSS_OVERHANG_M;
  const y0 = s.trussHeightM;
  const y1 = y0 + TRUSS_DEPTH_M;
  const z = trussZ(layout);
  const tubes: Tube[] = [tube(v(left, y0, z), v(right, y0, z), 0.025, "truss"), tube(v(left, y1, z), v(right, y1, z), 0.025, "truss")];
  const panels = Math.max(1, Math.round((right - left) / TRUSS_PANEL_M));
  for (let i = 0; i <= panels; i++) {
    const x = left + ((right - left) * i) / panels;
    tubes.push(tube(v(x, y0, z), v(x, y1, z), 0.012, "truss"));
    if (i < panels) {
      const next = left + ((right - left) * (i + 1)) / panels;
      tubes.push(i % 2 === 0 ? tube(v(x, y0, z), v(next, y1, z), 0.012, "truss") : tube(v(x, y1, z), v(next, y0, z), 0.012, "truss"));
    }
  }
  const blocks: Block[] = [];
  const onPodium = (x: number) => Math.abs(x) <= s.stageWidthM / 2 && z <= s.frontGapM && z >= s.frontGapM - s.stageDepthM;
  for (const x of [left, right]) {
    const base = onPodium(x) ? s.stageHeightM : 0;
    // A ladder leg: two uprights 30 cm apart (front / back), rungs every 50 cm.
    const zs = [z - TRUSS_DEPTH_M / 2, z + TRUSS_DEPTH_M / 2];
    for (const zz of zs) {
      tubes.push(tube(v(x, base, zz), v(x, y1, zz), 0.025, "truss"));
      blocks.push({ center: v(x, base + 0.006, zz), size: v(0.4, 0.012, 0.4), yaw: 0, kind: "plate" });
    }
    for (let y = base + TRUSS_PANEL_M; y < y1; y += TRUSS_PANEL_M) tubes.push(tube(v(x, y, zs[0]), v(x, y, zs[1]), 0.012, "truss"));
  }
  return { screenId: TRUSS_ID, tubes, blocks };
}

/**
 * Every carrier for the mounting chosen. Ground mounted: LED demiri or scaff behind every screen, plus the ground
 * support under it when ticked. Flown: the truss (its own model, `TRUSS_ID`) and every screen's header and ropes.
 */
export function carriers(layout: SceneLayout, s: StageSettings): CarrierModel[] {
  if (layout.screens.length === 0) return [];
  if (s.mount === "Flown") {
    const z = trussZ(layout);
    return [truss(layout, s), ...layout.screens.map((p) => flownScreen(p, s.trussHeightM, z))];
  }
  const floorY = s.stageHeightM;
  return layout.screens.map((p) => {
    const frame = s.carrier === "LedFrame" ? ledFrame(p, floorY) : scaff(p, floorY, s.legDepthM);
    if (!s.groundSupport) return frame;
    const support = groundSupport(p, floorY);
    return { ...frame, tubes: [...frame.tubes, ...support.tubes], blocks: [...frame.blocks, ...support.blocks] };
  });
}

/** The parts of every ground carrier added up (null when there is none, or they are of different kinds). */
export function totalBom(models: CarrierModel[]): CarrierBom | null {
  const boms = models.flatMap((m) => (m.bom ? [m.bom] : []));
  if (boms.length === 0) return null;
  if (boms.every((b) => b.kind === "LedFrame"))
    return boms.reduce((a, b) => ({ kind: "LedFrame", posts: a.posts + b.posts, twoM: a.twoM + b.twoM, oneM: a.oneM + b.oneM }));
  if (boms.every((b) => b.kind === "Scaff"))
    return boms.reduce((a, b) => ({ kind: "Scaff", uprights: a.uprights + b.uprights, ledgers: a.ledgers + b.ledgers, diagonals: a.diagonals + b.diagonals, basePlates: a.basePlates + b.basePlates }));
  return null;
}

/** What the carrier label says, and where it goes: on the main screen's carrier, at its back left. */
export interface CarrierLabel {
  point: Vec3;
  kind: "LedFrame" | "Scaff" | "Flown";
  /** Depth (ground mounted) or the truss's height (flown), metres. */
  valueM: number;
}

export function carrierLabel(layout: SceneLayout, s: StageSettings, models: CarrierModel[]): CarrierLabel | null {
  // Flown: on the truss's left leg.
  const main = models.find((m) => m.screenId === (s.mount === "Flown" ? TRUSS_ID : layout.mainId)) ?? models[0];
  if (!main || main.tubes.length === 0) return null;
  // Behind the left end, three quarters up: clear of the screen's name above and the height measurement beside it.
  const top = Math.max(...main.tubes.map((t) => Math.max(t.a.y, t.b.y)));
  const bottom = Math.min(...main.tubes.map((t) => Math.min(t.a.y, t.b.y)));
  const minZ = Math.min(...main.tubes.map((t) => Math.min(t.a.z, t.b.z)));
  const minX = Math.min(...main.tubes.map((t) => Math.min(t.a.x, t.b.x)));
  const point = v(minX, bottom + (top - bottom) * 0.75, minZ);
  if (s.mount === "Flown") return { point, kind: "Flown", valueM: s.trussHeightM };
  return { point, kind: s.carrier, valueM: s.carrier === "LedFrame" ? LED_FRAME_DEPTH_M : s.legDepthM };
}
