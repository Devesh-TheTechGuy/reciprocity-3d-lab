import * as THREE from "three";
import {
  KIT,
  matCase,
  matCaseDark,
  matBakelite,
  matRed,
  matBlackPlastic,
  matGreen,
  makeNameplate,
  makeTextTexture,
} from "./materials";
import { createTerminal, type Terminal } from "./terminal";

export interface PowerSupply {
  group: THREE.Group;
  positive: Terminal;
  negative: Terminal;
  setVoltage(volts: number): void;
}

function updateDisplay(mesh: THREE.Mesh, lines: string[]): void {
  const material = mesh.material as THREE.MeshBasicMaterial;
  material.map?.dispose();
  material.map = makeTextTexture(lines, { bg: "#0a0a0c", fg: "#ff5a3c", width: 512, height: 192 });
  material.needsUpdate = true;
}

/**
 * Variable regulated DC supply — the source "E" of Fig. 1. Modelled as a small
 * bench box with a voltage window, a set knob and red/black output terminals.
 */
export function createPowerSupply(initialVolts = 6): PowerSupply {
  const group = new THREE.Group();
  group.name = "power-supply";

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.24), matCase());
  body.position.y = 0.09;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.24), matCaseDark());
  bezel.position.y = 0.185;
  bezel.castShadow = true;
  group.add(bezel);

  // Front face detail.
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.15), matCaseDark());
  face.position.set(0, 0.095, 0.121);
  group.add(face);

  const display = makeNameplate(0.17, 0.06, ["6.00 V"], { bg: "#0a0a0c", fg: "#ff5a3c" });
  display.position.set(-0.065, 0.125, 0.123);
  group.add(display);
  updateDisplay(display, [`${initialVolts.toFixed(2)} V`]);

  // Voltage set knob + pointer.
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 24), matBakelite());
  knob.rotation.x = Math.PI / 2;
  knob.position.set(0.085, 0.115, 0.128);
  knob.castShadow = true;
  group.add(knob);
  const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.02, 0.004), matRed());
  pointer.position.set(0.085, 0.126, 0.139);
  group.add(pointer);

  // Power LED.
  const led = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.006, 12), matGreen());
  led.rotation.x = Math.PI / 2;
  led.position.set(0.085, 0.075, 0.125);
  group.add(led);

  const plate = makeNameplate(0.2, 0.035, ["DC SUPPLY  0–12 V"], {
    bg: "#2b3037",
    fg: "#e8ecf2",
  });
  plate.position.set(-0.06, 0.055, 0.123);
  group.add(plate);

  // Output terminals on the top deck (red = +, black = −).
  const positive = createTerminal("E+", "E · + (red)", KIT.red, 0.045);
  positive.object.position.set(-0.08, 0.19, 0.055);
  group.add(positive.object);

  const negative = createTerminal("E-", "E · − (black)", KIT.black, 0.045);
  negative.object.position.set(0.08, 0.19, 0.055);
  group.add(negative.object);

  // Polariry marks next to the terminals.
  const plus = makeNameplate(0.05, 0.05, ["+"], { bg: "#f5f1e6", fg: "#d23b3b", width: 128, height: 128 });
  plus.rotation.x = -Math.PI / 2;
  plus.position.set(-0.08, 0.191, -0.03);
  group.add(plus);
  const minus = makeNameplate(0.05, 0.05, ["−"], { bg: "#f5f1e6", fg: "#17171a", width: 128, height: 128 });
  minus.rotation.x = -Math.PI / 2;
  minus.position.set(0.08, 0.191, -0.03);
  group.add(minus);

  // Vent slots.
  for (let i = 0; i < 4; i += 1) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.006, 0.006), matBlackPlastic());
    slot.position.set(0, 0.03 + i * 0.012, 0.121);
    group.add(slot);
  }

  return {
    group,
    positive,
    negative,
    setVoltage(volts: number): void {
      updateDisplay(display, [`${volts.toFixed(2)} V`]);
    },
  };
}
