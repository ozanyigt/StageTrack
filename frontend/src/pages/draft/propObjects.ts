import * as THREE from 'three';
import { TRADE_COLOR, type StageProp } from './stageProps';

/**
 * three.js bodies for the trades that are counted rather than drawn. One box per product, a few of them side by
 * side so a group reads as a cluster, in the trade's own colour; a lighting group also gets a translucent cone so
 * the lit and unlit parts of the stage can be seen from above - the question a designer actually asks of a plan.
 */
const SELECTED_FRAME = 0xfacc15;

/** Space between two bodies of a group, metres. */
const GAP = 0.08;

export function buildProps(props: StageProp[], selectedId: string | null): THREE.Group {
  const group = new THREE.Group();

  for (const prop of props) {
    const colour = new THREE.Color(TRADE_COLOR[prop.trade]);
    const material = new THREE.MeshStandardMaterial({
      color: colour,
      emissive: colour,
      emissiveIntensity: prop.id === selectedId ? 0.55 : 0.18,
      roughness: 0.6,
      metalness: 0.15,
    });

    const box = new THREE.BoxGeometry(prop.size.w, prop.size.h, prop.size.d);
    const mesh = new THREE.InstancedMesh(box, material, prop.bodies);
    mesh.userData.propId = prop.id;

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (prop.rotationDeg * Math.PI) / 180);
    const scale = new THREE.Vector3(1, 1, 1);
    const span = prop.bodies * prop.size.w + (prop.bodies - 1) * GAP;
    const bounds = new THREE.Box3();

    for (let i = 0; i < prop.bodies; i++) {
      // Along the group's own x, centred on where it was placed, so turning it turns the whole cluster.
      const offset = -span / 2 + prop.size.w / 2 + i * (prop.size.w + GAP);
      const local = new THREE.Vector3(offset, 0, 0).applyQuaternion(quaternion);
      const centre = new THREE.Vector3(prop.x + local.x, prop.y + prop.size.h / 2, prop.z + local.z);
      matrix.compose(centre, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
      bounds.expandByPoint(centre.clone().addScalar(Math.max(prop.size.w, prop.size.d) / 2 + prop.size.h / 2));
      bounds.expandByPoint(centre.clone().addScalar(-(Math.max(prop.size.w, prop.size.d) / 2 + prop.size.h / 2)));

      if (prop.beam) {
        group.add(beam(centre, prop.y, colour));
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);

    if (prop.id === selectedId) {
      group.add(new THREE.Box3Helper(bounds.expandByScalar(0.05), new THREE.Color(SELECTED_FRAME)));
    }
  }

  return group;
}

/**
 * A fixture's light: a cone from the body down to the floor it stands on. Not a photometric model - the firm's
 * beam angles are not in the inventory - but it shows where the light is and where it is not, which is what the
 * plan is read for.
 */
function beam(from: THREE.Vector3, floorY: number, colour: THREE.Color): THREE.Mesh {
  const height = Math.max(0.6, from.y - floorY + 2.2);
  const geometry = new THREE.ConeGeometry(height * 0.42, height, 20, 1, true);
  const material = new THREE.MeshBasicMaterial({
    color: colour,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const cone = new THREE.Mesh(geometry, material);
  // The cone's point is at the fixture and its mouth on the floor, which is the way a hung fixture throws.
  cone.position.set(from.x, from.y - height / 2, from.z);
  cone.rotation.x = Math.PI;
  return cone;
}
