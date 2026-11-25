import * as THREE from "three";
import { VerletRope } from "../cords/verletRope";
import { matBrass } from "./materials";

export type CordSide = "a" | "b";

export interface PatchCord {
  object: THREE.Object3D;
  color: number;
  rope: VerletRope;
  /** Terminal id each end is currently plugged into (null = free). */
  plugged: { a: string | null; b: string | null };
  pinEnd(side: CordSide, position: THREE.Vector3, terminalId: string | null): void;
  unpinEnd(side: CordSide): void;
  endPosition(side: CordSide): THREE.Vector3;
  update(dt: number): void;
  dispose(): void;
}

const UP = new THREE.Vector3(0, 1, 0);

function createBananaPlug(color: number): THREE.Group {
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.05, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 }),
  );
  barrel.position.y = 0.025;
  barrel.castShadow = true;
  g.add(barrel);

  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.022, 12), matBrass());
  tip.position.y = 0.061;
  g.add(tip);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.004, 8, 16), matBrass());
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.004;
  g.add(collar);
  return g;
}

/**
 * A patch cord: a flexible Verlet cord with a banana plug at each end. Each end
 * can be pinned to a terminal; while free it can be dragged to another terminal.
 */
export function createPatchCord(color: number, floorY: number, length = 0.72): PatchCord {
  const object = new THREE.Group();
  object.name = "patch-cord";

  const rope = new VerletRope(
    new THREE.Vector3(0, floorY + 0.1, 0),
    new THREE.Vector3(0.2, floorY + 0.1, 0.05),
    { segments: 16, length, floorY },
  );

  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05 });
  let tube: THREE.Mesh = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rope.points), 24, 0.0065, 8, false),
    bodyMat,
  );
  tube.castShadow = true;
  object.add(tube);

  const plugA = createBananaPlug(color);
  const plugB = createBananaPlug(color);
  object.add(plugA, plugB);

  const cord: PatchCord = {
    object,
    color,
    rope,
    plugged: { a: null, b: null },

    pinEnd(side, position, terminalId) {
      const idx = side === "a" ? rope.first : rope.last;
      rope.pin(idx, position.clone());
      cord.plugged[side] = terminalId;
    },

    unpinEnd(side) {
      rope.unpin(side === "a" ? rope.first : rope.last);
      cord.plugged[side] = null;
    },

    endPosition(side) {
      return (side === "a" ? rope.points[rope.first] : rope.points[rope.last]).clone();
    },

    update(dt) {
      rope.update(dt);

      const oldGeo = tube.geometry;
      tube.geometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(rope.points),
        24,
        0.0065,
        8,
        false,
      );
      oldGeo.dispose();

      const ends: Array<[THREE.Group, number, number]> = [
        [plugA, rope.first, rope.first + 1],
        [plugB, rope.last, rope.last - 1],
      ];
      for (const [plug, idx, innerIdx] of ends) {
        const p = rope.points[idx];
        const inner = rope.points[innerIdx];
        plug.position.copy(p);
        const dir = new THREE.Vector3().subVectors(p, inner);
        if (dir.lengthSq() > 1e-8) {
          plug.quaternion.setFromUnitVectors(UP, dir.normalize());
        }
      }
    },

    dispose() {
      tube.geometry.dispose();
      bodyMat.dispose();
    },
  };

  return cord;
}
