import * as THREE from "three";
import { matBoard, matBrass, matBakelite, makeNameplate } from "./materials";
import { createTerminal, type Terminal } from "./terminal";
import { createResistorUnit } from "./resistor";

/** Which resistor in the T-network this is (values are set per experiment run). */
export interface ResistorValues {
  r1: string;
  r2: string;
  r3: string;
}

export interface KitBase {
  group: THREE.Group;
  terminals: Terminal[];
  terminalsById: Record<string, Terminal>;
}

export const DEFAULT_RESISTORS: ResistorValues = { r1: "100 Ω", r2: "100 Ω", r3: "100 Ω" };

const TOP_Z = -0.26;
const BOTTOM_Z = 0.26;
const LEFT_X = -0.78;
const RIGHT_X = 0.78;

/**
 * The reciprocity-theorem kit board: R1, R2, R3 wired as the Fig-1 T-network on
 * a common bottom rail, with brass binding posts exposed at every node so the
 * source, voltmeter and milliammeter can be patched in exactly like Fig 1.
 *
 *   T1 (A top) ── R1 ── C1 ── R2 ── T3 (B top)
 *                        │
 *                       R3
 *                        │
 *   T2 (rail) ──────── T5 ──────── T4 (rail)
 */
export function createKitBase(values: ResistorValues = DEFAULT_RESISTORS): KitBase {
  const group = new THREE.Group();
  group.name = "kit-base";

  const boardW = 1.8;
  const boardD = 0.8;

  const board = new THREE.Mesh(new THREE.BoxGeometry(boardW, 0.03, boardD), matBoard());
  board.position.y = -0.015;
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  // A dark rim so the board reads as a kit, not a random slab.
  const rim = matBakelite();
  const rimParts: Array<[number, number, number, number, number]> = [
    [boardW, 0.012, 0.03, 0, boardD / 2 - 0.015],
    [boardW, 0.012, 0.03, 0, -boardD / 2 + 0.015],
  ];
  for (const [w, h, d, x, z] of rimParts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rim);
    m.position.set(x, 0.006, z);
    group.add(m);
  }
  for (const side of [-1, 1] as const) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, boardD), rim);
    m.position.set((side * boardW) / 2 - side * 0.015, 0.006, 0);
    group.add(m);
  }

  const specs: Array<[string, string, number, number]> = [
    ["T1", "T1 · A top", LEFT_X, TOP_Z],
    ["C1", "C1 · centre node", 0, TOP_Z],
    ["T3", "T3 · B top", RIGHT_X, TOP_Z],
    ["T2", "T2 · rail left", LEFT_X, BOTTOM_Z],
    ["T5", "T5 · rail centre", 0, BOTTOM_Z],
    ["T4", "T4 · rail right", RIGHT_X, BOTTOM_Z],
  ];
  const terminals: Terminal[] = [];
  const terminalsById: Record<string, Terminal> = {};
  for (const [id, label, x, z] of specs) {
    const t = createTerminal(id, label);
    t.object.position.set(x, 0, z);
    group.add(t.object);
    terminals.push(t);
    terminalsById[id] = t;
  }

  // Common bottom rail bus.
  const rail = new THREE.Mesh(new THREE.BoxGeometry(RIGHT_X - LEFT_X, 0.01, 0.05), matBrass());
  rail.position.set(0, 0.014, BOTTOM_Z);
  rail.castShadow = true;
  group.add(rail);

  // R1 (T1→C1) and R2 (C1→T3) along the top rail.
  const axisY = 0.042;
  const halfSpan = RIGHT_X; // distance from the centre node to either outer terminal (0.78)
  const r1 = createResistorUnit("R1", values.r1, halfSpan);
  r1.position.set(LEFT_X / 2, axisY, TOP_Z);
  group.add(r1);

  const r2 = createResistorUnit("R2", values.r2, halfSpan);
  r2.position.set(RIGHT_X / 2, axisY, TOP_Z);
  group.add(r2);

  // R3 (C1→T5) down the middle.
  const r3 = createResistorUnit("R3", values.r3, BOTTOM_Z - TOP_Z);
  r3.position.set(0, axisY, 0);
  r3.rotation.y = Math.PI / 2;
  group.add(r3);

  const plate = makeNameplate(0.66, 0.07, ["RECIPROCITY THEOREM KIT"], {
    bg: "#f5f1e6",
    fg: "#141418",
    accent: "#d1863f",
  });
  plate.rotation.x = -Math.PI / 2;
  plate.position.set(0, 0.031, 0.36);
  group.add(plate);

  return { group, terminals, terminalsById };
}
