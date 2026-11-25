import * as THREE from "three";

export interface LabTable {
  group: THREE.Group;
  /** World-space Y of the table surface. */
  surfaceY: number;
}

/**
 * A plain wooden school-lab table. `surfaceY` is the true top surface, so the
 * kit and instruments sit correctly on top of it.
 */
export function createLabTable(): LabTable {
  const group = new THREE.Group();
  const surfaceY = 0.95;

  const wood = new THREE.MeshStandardMaterial({
    color: 0x6b4a2b,
    roughness: 0.5,
    metalness: 0.05,
  });

  const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.5), wood);
  top.position.y = surfaceY - 0.05;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  // Apron rail just under the top for a more solid look.
  const apron = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.3), wood);
  apron.position.y = surfaceY - 0.16;
  apron.castShadow = true;
  group.add(apron);

  const legGeo = new THREE.BoxGeometry(0.09, 0.9, 0.09);
  const legPositions: Array<[number, number]> = [
    [-1.18, -0.62],
    [1.18, -0.62],
    [-1.18, 0.62],
    [1.18, 0.62],
  ];
  for (const [x, z] of legPositions) {
    const leg = new THREE.Mesh(legGeo, wood);
    leg.position.set(x, 0.45, z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    group.add(leg);
  }

  return { group, surfaceY };
}
