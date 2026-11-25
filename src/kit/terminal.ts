import * as THREE from "three";
import { KIT, matBakelite } from "./materials";

/** A patchable point: brass binding post / banana jack with a stable world pos. */
export interface Terminal {
  readonly id: string;
  readonly label: string;
  readonly color: number;
  readonly object: THREE.Object3D;
  worldPosition(out?: THREE.Vector3): THREE.Vector3;
}

/**
 * A classic brass binding post on a bakelite pad — the node a patch cord snaps
 * onto. Every kit item exposes its connection points as Terminal objects.
 */
export function createTerminal(
  id: string,
  label: string,
  color: number = KIT.brass,
  postHeight = 0.05,
): Terminal {
  const group = new THREE.Group();
  group.name = `terminal:${id}`;

  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.012, 0.062), matBakelite());
  pad.position.y = 0.006;
  pad.receiveShadow = true;
  group.add(pad);

  const metal = new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.3 });
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, postHeight, 14),
    metal,
  );
  post.position.y = 0.006 + postHeight / 2;
  post.castShadow = true;
  group.add(post);

  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.013, 6), metal);
  nut.position.y = 0.006 + postHeight - 0.012;
  nut.castShadow = true;
  group.add(nut);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.005, 8, 18), metal);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.006 + postHeight * 0.35;
  group.add(collar);

  return {
    id,
    label,
    color,
    object: group,
    worldPosition(out = new THREE.Vector3()): THREE.Vector3 {
      return group.getWorldPosition(out);
    },
  };
}
