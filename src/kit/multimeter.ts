import * as THREE from "three";
import {
  KIT,
  matYellow,
  matCaseDark,
  matBakelite,
  matRed,
  matBlackPlastic,
  matSteel,
  makeNameplate,
  makeTextTexture,
} from "./materials";
import { createTerminal, type Terminal } from "./terminal";

/** How the multimeter is being used in the experiment. */
export type MeterMode = "voltmeter" | "milliammeter";

export interface Multimeter {
  group: THREE.Group;
  /** Red "VΩmA" jack (positive lead). */
  positive: Terminal;
  /** Black "COM" jack (common lead). */
  common: Terminal;
  setReading(text: string): void;
}

function updateDisplay(mesh: THREE.Mesh, lines: string[]): void {
  const material = mesh.material as THREE.MeshBasicMaterial;
  material.map?.dispose();
  material.map = makeTextTexture(lines, {
    bg: "#c9d6c2",
    fg: "#141814",
    width: 512,
    height: 224,
  });
  material.needsUpdate = true;
}

/**
 * Handheld digital multimeter on a tilt stand — the single "Digital Multimeter"
 * of the apparatus list. Instantiated twice to reproduce Fig. 1: one set to
 * VOLTS (across the source) and one set to MILLIAMPS (in a branch).
 */
export function createMultimeter(mode: MeterMode): Multimeter {
  const isVolt = mode === "voltmeter";
  const unit = isVolt ? "V" : "mA";
  const group = new THREE.Group();
  group.name = `multimeter:${mode}`;

  // Tilted body assembly.
  const body = new THREE.Group();
  body.rotation.x = -0.34;
  body.position.y = 0.115;
  group.add(body);

  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.06), matYellow());
  shell.castShadow = true;
  shell.receiveShadow = true;
  body.add(shell);

  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), matCaseDark());
  face.position.z = 0.031;
  body.add(face);

  const display = makeNameplate(0.2, 0.062, ["0.000 V"], {
    bg: "#c9d6c2",
    fg: "#141814",
  });
  display.position.set(0.03, 0.05, 0.032);
  body.add(display);
  updateDisplay(display, [`0.000 ${unit}`]);

  // Rotary selector.
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.014, 28), matBakelite());
  dial.rotation.x = Math.PI / 2;
  dial.position.set(-0.088, -0.03, 0.034);
  body.add(dial);
  const knobMark = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.026, 0.006), matYellow());
  knobMark.position.set(-0.088, -0.018, 0.043);
  body.add(knobMark);

  // Input jacks along the bottom edge.
  const jacks: Array<[number, string, THREE.MeshStandardMaterial]> = [
    [-0.02, "COM", matBlackPlastic()],
    [0.05, "VΩmA", matRed()],
    [0.115, "10A", matRed()],
  ];
  for (const [x, , material] of jacks) {
    const jack = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 14), material);
    jack.rotation.x = Math.PI / 2;
    jack.position.set(x, -0.078, 0.033);
    body.add(jack);
  }

  const plate = makeNameplate(0.24, 0.03, [`DIGITAL MULTIMETER · ${isVolt ? "V" : "mA"}`], {
    bg: "#2b3037",
    fg: "#e8ecf2",
  });
  plate.position.set(0, -0.052, 0.032);
  body.add(plate);

  // Tilt stand legs.
  for (const side of [-1, 1] as const) {
    const legM = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.02), matSteel());
    legM.position.set(side * 0.12, 0.055, -0.05);
    legM.rotation.x = 0.2;
    group.add(legM);
  }

  const positive = createTerminal(isVolt ? "V+" : "mA+", `DMM ${unit} + (red)`, KIT.red, 0.035);
  positive.object.position.set(0.05, 0.06, 0.045);
  body.add(positive.object);

  const common = createTerminal(isVolt ? "V-" : "mA-", "DMM COM − (black)", KIT.black, 0.035);
  common.object.position.set(-0.02, 0.06, 0.045);
  body.add(common.object);

  return {
    group,
    positive,
    common,
    setReading(text: string): void {
      updateDisplay(display, [`${text} ${unit}`]);
    },
  };
}
