import * as THREE from "three";

/** Interior dimensions of the lab room, in metres. */
export const ROOM = { width: 8, depth: 7, height: 3.2 } as const;

export interface Room {
  group: THREE.Group;
  /** Animate the ceiling fan. */
  update(delta: number): void;
}

const WALL_COLOR = 0xd1863f; // school-lab orange
const FLOOR_COLOR = 0x8f9096;
const CEILING_COLOR = 0xf2efe6;

/**
 * Builds the lab shell: floor, ceiling, four inward-facing orange walls, three
 * back-wall windows, three ceiling tube-light fixtures (each with a point light)
 * and a slowly spinning ceiling fan.
 */
export function createRoom(): Room {
  const group = new THREE.Group();
  const { width: W, depth: D, height: H } = ROOM;

  const wallMat = new THREE.MeshStandardMaterial({
    color: WALL_COLOR,
    roughness: 0.95,
    metalness: 0,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: FLOOR_COLOR,
    roughness: 0.9,
    metalness: 0.02,
  });
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: CEILING_COLOR,
    roughness: 1,
    metalness: 0,
  });
  const metalDark = new THREE.MeshStandardMaterial({
    color: 0x2c3036,
    roughness: 0.45,
    metalness: 0.6,
  });

  // Floor + ceiling.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  ceiling.receiveShadow = true;
  group.add(ceiling);

  // Walls (plane normals rotate to face the room interior). castShadow stays
  // false so the directional sun is not blocked by the shell.
  const addWall = (
    planeWidth: number,
    pos: [number, number, number],
    rotY: number,
  ): void => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, H), wallMat);
    wall.position.set(pos[0], pos[1], pos[2]);
    wall.rotation.y = rotY;
    wall.receiveShadow = true;
    group.add(wall);
  };
  addWall(W, [0, H / 2, -D / 2], 0); // back (-Z) faces +Z
  addWall(W, [0, H / 2, D / 2], Math.PI); // front (+Z) faces -Z
  addWall(D, [-W / 2, H / 2, 0], Math.PI / 2); // left (-X) faces +X
  addWall(D, [W / 2, H / 2, 0], -Math.PI / 2); // right (+X) faces -X

  // Windows are applied flat on the wall surface (no boolean cut): a bright
  // "outside" panel + tinted glass + a dark frame, ordered panel -> glass ->
  // frame so the panel occludes the wall behind it.
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x3a3f45,
    roughness: 0.6,
    metalness: 0.25,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xbfe0ff,
    transparent: true,
    opacity: 0.28,
    roughness: 0.08,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const outsideMat = new THREE.MeshBasicMaterial({ color: 0xdff0ff });

  const addWindow = (
    wx: number,
    wz: number,
    rotY: number,
    winW = 1.5,
    winH = 1.3,
    sillY = 1.05,
  ): void => {
    const win = new THREE.Group();
    win.position.set(wx, sillY + winH / 2, wz);
    win.rotation.y = rotY;

    const outside = new THREE.Mesh(
      new THREE.PlaneGeometry(winW + 0.16, winH + 0.16),
      outsideMat,
    );
    win.add(outside);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), glassMat);
    glass.position.z = 0.012;
    win.add(glass);

    const bar = 0.07;
    const bars: Array<[number, number, number, number]> = [
      [winW + bar * 2, bar, 0, winH / 2 + bar / 2], // top
      [winW + bar * 2, bar, 0, -winH / 2 - bar / 2], // bottom
      [bar, winH, -winW / 2 - bar / 2, 0], // left
      [bar, winH, winW / 2 + bar / 2, 0], // right
      [0.04, winH, 0, 0], // vertical mullion
      [winW, 0.04, 0, 0], // horizontal mullion
    ];
    for (const [bw, bh, bx, by] of bars) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.06), frameMat);
      m.position.set(bx, by, 0.02);
      m.castShadow = true;
      win.add(m);
    }
    group.add(win);
  };

  // Three windows along the back wall, two along the right wall.
  for (const x of [-2.2, 0, 2.2]) {
    addWindow(x, -D / 2 + 0.02, 0);
  }
  for (const z of [-1.6, 1.6]) {
    addWindow(W / 2 - 0.02, z, -Math.PI / 2, 1.3, 1.3, 1.05);
  }


  // Chalkboard on the front wall for lab character.
  const boardFrame = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 1.8, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.6 }),
  );
  boardFrame.position.set(0, H / 2 + 0.15, D / 2 - 0.02);
  boardFrame.castShadow = true;
  group.add(boardFrame);

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x1b2a24, roughness: 0.85, metalness: 0 }),
  );
  board.position.set(0, H / 2 + 0.15, D / 2 - 0.06);
  board.rotation.y = Math.PI;
  board.receiveShadow = true;
  group.add(board);

  // Ceiling tube-light fixtures (+ a soft point light each).
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0xdfe3e8,
    roughness: 0.4,
    metalness: 0.5,
  });
  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff3dc,
    emissiveIntensity: 3.4,
    roughness: 0.3,
  });
  for (const z of [-2.2, 0, 2.2]) {
    const fixture = new THREE.Group();
    fixture.position.set(0, H - 0.08, z);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.09, 0.22), fixtureMat);
    housing.castShadow = true;
    fixture.add(housing);

    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1.25, 16),
      tubeMat,
    );
    tube.rotation.z = Math.PI / 2;
    tube.position.y = -0.06;
    fixture.add(tube);

    const glow = new THREE.PointLight(0xfff1dc, 4.5, 9, 2);
    glow.position.set(0, -0.35, 0);
    fixture.add(glow);

    group.add(fixture);
  }

  // Ceiling fan.
  const fan = new THREE.Group();
  fan.position.set(0, H, 0);

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 12), metalDark);
  rod.position.y = -0.16;
  fan.add(rod);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.09, 20), metalDark);
  hub.position.y = -0.34;
  hub.castShadow = true;
  fan.add(hub);

  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xcfd3d8,
    roughness: 0.5,
    metalness: 0.1,
  });
  const bladeGeo = new THREE.BoxGeometry(0.95, 0.02, 0.18);
  const blades = new THREE.Group();
  blades.position.y = -0.36;
  for (let i = 0; i < 3; i += 1) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 3) * Math.PI * 2;
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0.52, 0, 0);
    blade.rotation.z = 0.13;
    blade.castShadow = true;
    pivot.add(blade);
    blades.add(pivot);
  }
  fan.add(blades);
  group.add(fan);

  return {
    group,
    update: (delta: number): void => {
      blades.rotation.y += delta * 2.6;
    },
  };
}

