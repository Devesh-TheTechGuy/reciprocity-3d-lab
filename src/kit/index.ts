import * as THREE from "three";
import { createKitBase, DEFAULT_RESISTORS, type KitBase } from "./kitBase";
import { createPowerSupply, type PowerSupply } from "./powerSupply";
import { createMultimeter, type Multimeter } from "./multimeter";
import type { Terminal } from "./terminal";
import type { ResistorSet } from "../experiment/components";

export interface LabKit {
  group: THREE.Group;
  terminals: Terminal[];
  terminalsById: Record<string, Terminal>;
  components: {
    base: KitBase;
    supply: PowerSupply;
    voltmeter: Multimeter;
    milliammeter: Multimeter;
  };
}

/**
 * The complete apparatus of the experiment, assembled on the table:
 *   - the reciprocity-theorem kit board (R1/R2/R3 + T-network terminals),
 *   - the variable DC supply (E),
 *   - two digital multimeters: one as the voltmeter V, one as the milliammeter mA.
 *
 * Every patchable point is registered in `terminalsById`.
 */
export function createLabKit(
  surfaceY: number,
  values: ResistorSet = DEFAULT_RESISTORS,
): LabKit {
  const group = new THREE.Group();
  group.name = "lab-kit";

  const base = createKitBase(values);
  base.group.position.set(0, surfaceY + 0.03, -0.04);
  group.add(base.group);

  const supply = createPowerSupply(6);
  supply.group.position.set(-0.74, surfaceY, 0.52);
  supply.group.rotation.y = 0.14;
  group.add(supply.group);

  const voltmeter = createMultimeter("voltmeter");
  voltmeter.group.position.set(0.0, surfaceY, 0.54);
  group.add(voltmeter.group);

  const milliammeter = createMultimeter("milliammeter");
  milliammeter.group.position.set(0.82, surfaceY, 0.52);
  milliammeter.group.rotation.y = -0.16;
  group.add(milliammeter.group);

  const components = { base, supply, voltmeter, milliammeter };
  const terminals: Terminal[] = [
    ...base.terminals,
    supply.positive,
    supply.negative,
    voltmeter.positive,
    voltmeter.common,
    milliammeter.positive,
    milliammeter.common,
  ];

  const terminalsById: Record<string, Terminal> = {};
  for (const t of terminals) terminalsById[t.id] = t;

  return { group, terminals, terminalsById, components };
}
