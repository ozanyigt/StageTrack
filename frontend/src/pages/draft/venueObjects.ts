import * as THREE from 'three';
import type { SiteVenue } from '../../api/siteTypes';

/**
 * The room in three.js: a floor, four walls and the ceiling the rig has to clear. Drawn as an open shell - the
 * walls are thin and the ceiling is a wireframe - because the point is to see what the design is standing
 * inside, not to light a building. If the venue sent its own layout drawing, that is laid on the floor at the
 * scale it was given, which is where the columns and the doors come from.
 */
const WALL = 0x3f3f46;
const CEILING = 0x52525b;

export interface RoomBox {
  /** Scene metres; the stage stands at z = 0 and the audience is towards +z. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

/**
 * Where the room's walls fall around the stage. The back wall is a set distance behind the podium and the room
 * runs forward from there, so moving the stage inside the hall is one number, not a coordinate system.
 */
export function roomBox(venue: SiteVenue, podiumBack: number): RoomBox {
  const minZ = podiumBack - venue.behindStageM;
  return {
    minX: venue.stageOffsetXM - venue.widthM / 2,
    maxX: venue.stageOffsetXM + venue.widthM / 2,
    minZ,
    maxZ: minZ + venue.depthM,
    height: venue.clearHeightM,
  };
}

export function buildRoom(box: RoomBox, planTexture: THREE.Texture | null, plan: { widthM: number; depthM: number; originXM: number; originZM: number; rotationDeg: number } | null): THREE.Group {
  const group = new THREE.Group();
  const width = box.maxX - box.minX;
  const depth = box.maxZ - box.minZ;
  const centreX = (box.minX + box.maxX) / 2;
  const centreZ = (box.minZ + box.maxZ) / 2;

  // The floor: a shade lighter than the world outside it, so the room reads as the room.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(centreX, 0.001, centreZ);
  group.add(floor);

  if (planTexture && plan) {
    // The venue's own drawing, laid where it was placed and turned the way it was turned.
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(plan.widthM, plan.depthM),
      new THREE.MeshBasicMaterial({ map: planTexture, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    sheet.rotation.x = -Math.PI / 2;
    sheet.rotation.z = (-plan.rotationDeg * Math.PI) / 180;
    sheet.position.set(plan.originXM + plan.widthM / 2, 0.004, plan.originZM + plan.depthM / 2);
    sheet.renderOrder = 1;
    group.add(sheet);
  }

  const wallHeight = box.height > 0 ? box.height : 6;
  const material = new THREE.MeshStandardMaterial({ color: WALL, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
  const wall = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
  };
  const t = 0.1;
  wall(width, wallHeight, t, centreX, wallHeight / 2, box.minZ);
  wall(width, wallHeight, t, centreX, wallHeight / 2, box.maxZ);
  wall(t, wallHeight, depth, box.minX, wallHeight / 2, centreZ);
  wall(t, wallHeight, depth, box.maxX, wallHeight / 2, centreZ);

  if (box.height > 0) {
    // The ceiling is the limit, so it is drawn as a grid rather than a lid: you see through it and still see it.
    const grid = new THREE.GridHelper(Math.max(width, depth), Math.ceil(Math.max(width, depth) / 2), CEILING, CEILING);
    grid.position.set(centreX, box.height, centreZ);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    group.add(grid);
  }

  return group;
}
