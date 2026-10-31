import * as THREE from "three";
import type { Block, BlockKind, CarrierModel, Tube, TubeKind } from "../core/stage3d/carriers";
import { isBent, type Podium, type SceneLayout, type Segment } from "../core/stage3d/scene";
import { panelPlacements } from "../core/stage3d/screens";

/**
 * three.js objects of 3D Sahne, built from the scene layout (lib/stage3d/scene.ts). Each builder returns one group;
 * the view swaps groups when what they show changes and disposes the old ones.
 */

/** Space left between two panels (derz), metres. */
export const PANEL_GAP_M = 0.02;
/** Depth of an LED cabinet, metres. */
export const PANEL_DEPTH_M = 0.08;
const SELECTED_FRAME = 0xfacc15;
const DIMENSION_COLOR = 0xe5e7eb;

/** The screens: one instanced mesh each (one draw call however many panels); the selected one glows and is framed. */
export function buildScreens(layout: SceneLayout, selectedId: string | null): THREE.Group {
  const group = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (const placed of layout.screens) {
    const { screen, bottom } = placed;
    const panels = panelPlacements(screen, placed, bottom);
    if (panels.length === 0) continue;
    const selected = screen.id === selectedId;
    const color = new THREE.Color(screen.color);
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: selected ? 0.75 : 0.28, roughness: 0.55, metalness: 0.1 });
    const mesh = new THREE.InstancedMesh(box, material, panels.length);
    mesh.userData.screenId = screen.id;
    const bounds = new THREE.Box3();
    panels.forEach((p, i) => {
      q.setFromAxisAngle(up, p.yaw);
      m.compose(new THREE.Vector3(p.x, p.y, p.z - PANEL_DEPTH_M / 2), q, new THREE.Vector3(p.width - PANEL_GAP_M, p.height - PANEL_GAP_M, PANEL_DEPTH_M));
      mesh.setMatrixAt(i, m);
      bounds.expandByPoint(new THREE.Vector3(p.x - p.width / 2, p.y - p.height / 2, p.z - PANEL_DEPTH_M));
      bounds.expandByPoint(new THREE.Vector3(p.x + p.width / 2, p.y + p.height / 2, p.z));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    if (selected) group.add(new THREE.Box3Helper(bounds.expandByScalar(0.03), new THREE.Color(SELECTED_FRAME)));
  }
  return group;
}

/** Where a screen's label sits: above its middle (clear of the width measurement), at its front. */
export function screenLabelPoint(layout: SceneLayout, id: string): THREE.Vector3 | null {
  const placed = layout.screens.find((p) => p.screen.id === id);
  if (!placed) return null;
  const panels = panelPlacements(placed.screen, placed, placed.bottom);
  const maxZ = Math.max(0, ...panels.map((p) => p.z));
  // Over a curved screen higher still: its joint angles and its width measurement come first.
  return new THREE.Vector3(placed.x, placed.bottom + placed.screen.heightM + (isBent(placed.screen) ? 1.25 : 0.85), maxZ);
}

/** The podium: its block, a thin band along its top edge (front and sides). */
export function buildPodium(p: Podium): THREE.Group {
  const group = new THREE.Group();
  if (p.height <= 0) {
    // At floor level: only its outline on the floor.
    group.add(lines([outline(p, 0.01)], 0x71717a));
    return group;
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(p.width, p.height, p.depth), new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 }));
  deck.position.set(0, p.height / 2, (p.front + p.back) / 2);
  group.add(deck);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(p.width, p.depth), new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.8 }));
  top.rotation.x = -Math.PI / 2;
  top.position.set(0, p.height + 0.001, (p.front + p.back) / 2);
  group.add(top);
  const band = new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.5, metalness: 0.4 });
  const BAND = 0.06;
  const front = new THREE.Mesh(new THREE.BoxGeometry(p.width + 0.02, BAND, 0.02), band);
  front.position.set(0, p.height - BAND / 2, p.front + 0.01);
  group.add(front);
  for (const side of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.02, BAND, p.depth), band);
    edge.position.set(side * (p.width / 2 + 0.01), p.height - BAND / 2, (p.front + p.back) / 2);
    group.add(edge);
  }
  return group;
}

function outline(p: Podium, y: number): Segment[] {
  const c = [
    { x: -p.width / 2, y, z: p.back },
    { x: p.width / 2, y, z: p.back },
    { x: p.width / 2, y, z: p.front },
    { x: -p.width / 2, y, z: p.front },
  ];
  return c.map((a, i) => ({ a, b: c[(i + 1) % 4] }));
}

/** The measurement lines (their labels are written over the picture by the view). */
export function buildDimensions(layout: SceneLayout): THREE.Group {
  const group = new THREE.Group();
  group.add(lines(layout.dimensions.flatMap((d) => d.lines), DIMENSION_COLOR));
  return group;
}

/** Line segments in one draw call. */
export function lines(segments: Segment[] | Segment[][], color: number): THREE.LineSegments {
  const flat = (segments as (Segment | Segment[])[]).flat();
  const points = flat.flatMap((s) => [new THREE.Vector3(s.a.x, s.a.y, s.a.z), new THREE.Vector3(s.b.x, s.b.y, s.b.z)]);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }));
}

/** A word lying on the floor (e.g. "SEYİRCİ"), facing up, readable from the audience's side. */
export function buildFloorText(text: string, at: { x: number; y: number; z: number }, widthM: number): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#d4d4d8";
    ctx.font = 'bold 110px system-ui, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 40);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(widthM, (widthM * canvas.height) / canvas.width),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(at.x, at.y, at.z);
  return mesh;
}

const TUBE_COLOR: Record<TubeKind, number> = { steel: 0x8b8f98, scaff: 0xb8bcc4, truss: 0xd4d4d8, rope: 0x18181b };
const BLOCK_COLOR: Record<BlockKind, number> = { plate: 0x52525b, rubber: 0x0c0a09, profile: 0xc0c4cc, clamp: 0x3f3f46, header: 0xa1a1aa };

/** The carriers: one instanced mesh per tube kind and per block kind, however many parts. */
export function buildCarriers(models: CarrierModel[]): THREE.Group {
  const group = new THREE.Group();
  const tubes = models.flatMap((m) => m.tubes);
  const blocks = models.flatMap((m) => m.blocks);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  for (const kind of Object.keys(TUBE_COLOR) as TubeKind[]) {
    const list = tubes.filter((t) => t.kind === kind);
    if (list.length === 0) continue;
    const material = new THREE.MeshStandardMaterial({ color: TUBE_COLOR[kind], metalness: kind === "rope" ? 0 : 0.6, roughness: 0.4 });
    const mesh = new THREE.InstancedMesh(cylinder, material, list.length);
    list.forEach((t: Tube, i) => {
      dir.set(t.b.x - t.a.x, t.b.y - t.a.y, t.b.z - t.a.z);
      const length = dir.length();
      q.setFromUnitVectors(yAxis, length > 0 ? dir.normalize() : yAxis);
      m.compose(new THREE.Vector3((t.a.x + t.b.x) / 2, (t.a.y + t.b.y) / 2, (t.a.z + t.b.z) / 2), q, new THREE.Vector3(t.radius, length, t.radius));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  for (const kind of Object.keys(BLOCK_COLOR) as BlockKind[]) {
    const list = blocks.filter((b) => b.kind === kind);
    if (list.length === 0) continue;
    const metal = kind === "profile" || kind === "header";
    const mesh = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: BLOCK_COLOR[kind], metalness: metal ? 0.6 : 0.1, roughness: 0.6 }), list.length);
    list.forEach((b: Block, i) => {
      q.setFromAxisAngle(yAxis, b.yaw);
      m.compose(new THREE.Vector3(b.center.x, b.center.y, b.center.z), q, new THREE.Vector3(b.size.x, b.size.y, b.size.z));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}

/** Removes and disposes a group's children (geometries, materials, textures). */
export function disposeGroup(group: THREE.Object3D) {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeObject(child);
  }
}

export function disposeObject(object: THREE.Object3D) {
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      (m as THREE.MeshBasicMaterial).map?.dispose();
      m.dispose();
    }
  });
}
