import type { WiringState } from "../state/wiring";
import { buildNetlist, DEFAULT_CIRCUIT, type CircuitParams } from "./netlist";
import { solveMna } from "./mna";

export type { CircuitParams } from "./netlist";
export { DEFAULT_CIRCUIT } from "./netlist";

/**
 * What the meters of Fig. 1 would read for the current wiring.
 * `null` readings mean the circuit is not complete/solvable yet.
 */
export interface CircuitSolution {
  /** Which Fig-1 arrangement is wired up, if either. */
  readonly config: "A" | "B" | null;
  /** Node voltage in volts, keyed by terminal id (referenced to the E− rail). */
  readonly nodeVoltage: Map<string, number>;
  /** Voltmeter reading = V(V+) − V(V−) in volts. */
  readonly voltage: number;
  /** Milliammeter reading magnitude in amps (the branch's I). */
  readonly current: number;
  /** Current delivered by the source, magnitude in amps. */
  readonly sourceCurrent: number;
}

/** Closed-form current of the Fig-1 network: I = E·R3 / (R1R2 + R2R3 + R1R3). */
export function theoreticalCurrent({ E, r1, r2, r3 }: CircuitParams): number {
  const denom = r1 * r2 + r2 * r3 + r1 * r3;
  return denom === 0 ? 0 : (E * r3) / denom;
}

/** Closed-form total resistance seen by the source: R_T = (R1R2 + R2R3 + R1R3) / R3. */
export function theoreticalResistance({ r1, r2, r3 }: CircuitParams): number {
  const denom = r1 * r2 + r2 * r3 + r1 * r3;
  return r3 === 0 ? Number.POSITIVE_INFINITY : denom / r3;
}

/**
 * Solve the live circuit: build its netlist from the static board wiring plus
 * the patched cords, run MNA, then read the meters off the solution.
 * Returns `null` only when the linear system is singular.
 */
export function solveCircuit(
  wiring: WiringState,
  params: CircuitParams = DEFAULT_CIRCUIT,
): CircuitSolution | null {
  const net = buildNetlist(wiring, params);
  const mna = solveMna(net);
  if (!mna) return null;

  const nodeVoltage = new Map<string, number>();
  for (const [id, index] of net.nodeOf) nodeVoltage.set(id, mna.nodeVoltage[index]);

  const voltage = (nodeVoltage.get("V+") ?? 0) - (nodeVoltage.get("V-") ?? 0);

  return {
    config: wiring.detectConfig(),
    nodeVoltage,
    voltage,
    current: Math.abs(mna.meterCurrent[0] ?? 0),
    sourceCurrent: Math.abs(mna.sourceCurrent[0] ?? 0),
  };
}
