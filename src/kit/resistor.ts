import * as THREE from "three";
import { matBrass, matCeramic, makeNameplate } from "./materials";

/** Colour-band codes, purely cosmetic (identifies an axial resistor at a glance). */
const BAND_COLORS = [0x8a5a2b, 0x000000, 0xd23b3b]; // brown, black, red

/**
 * An axial wire-wound resistor lying along local +X, spanning exactly `length`
 * between its two connecting collars. Includes a small nameplate ("R1 = 100 Ω").
 */
export function createResistorUnit(
  label: string,
  valueText: string,
  length: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `resistor:${label}`;

  const bodyLen = length * 0.56;
  const radius = 0.03;

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, bodyLen, 22),
    matCeramic(),
  );
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Colour bands.
  BAND_COLORS.forEach((color, i) => {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.03, radius * 1.03, 0.008, 22),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
    );
    band.rotation.z = Math.PI / 2;
    band.position.x = -bodyLen * 0.3 + i * 0.028;
    group.add(band);
  });

  const brass = matBrass();
  const leadLen = (length - bodyLen) / 2;
  for (const side of [-1, 1] as const) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.08, radius * 1.08, 0.014, 22),
      brass,
    );
    cap.rotation.z = Math.PI / 2;
    cap.position.x = (side * bodyLen) / 2;
    group.add(cap);

    const lead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, leadLen, 10),
      brass,
    );
    lead.rotation.z = Math.PI / 2;
    lead.position.x = side * (bodyLen / 2 + leadLen / 2);
    group.add(lead);
  }

  const plate = makeNameplate(0.17, 0.055, [label, valueText], { bg: "#f5f1e6" });
  plate.rotation.x = -Math.PI / 2;
  plate.position.set(0, radius + 0.004, 0.055);
  group.add(plate);

  return group;
}
