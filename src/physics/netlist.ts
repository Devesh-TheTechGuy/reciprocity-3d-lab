import type { WiringState } from "../state/wiring";

/** A resistive branch between two terminal ids (the kit's R1/R2/R3). */
export interface ResistorBranch {
  readonly id: string;
  readonly a: string;
  readonly b: string;
  readonly ohms: number;
}

/** An ideal voltage source between two terminal ids (the supply "E"). */
export interface SourceBranch {
  readonly id: string;
  readonly positive: string;
  readonly negative: string;
  readonly volts: number;
}

/**
 * An ideal zero-ohm *sense* branch — the milliammeter. It behaves as a dead
 * short electrically, but it also carries an extra current unknown so the
 * solver can report exactly the current through the meter.
 */
export interface SenseBranch {
  readonly id: string;
  readonly positive: string;
  readonly negative: string;
}

/** Numeric element values of the Fig-1 network, in SI units (V, Ω). */
export interface CircuitParams {
  E: number;
  r1: number;
  r2: number;
  r3: number;
}

/** The element values silk-screened on the kit board (must mirror kitBase). */
export const DEFAULT_CIRCUIT: CircuitParams = { E: 6, r1: 100, r2: 100, r3: 100 };

/** Every patchable terminal id, in a stable order. */
export const TERMINAL_IDS = [
  "T1",
  "C1",
  "T3",
  "T2",
  "T5",
  "T4",
  "E+",
  "E-",
  "V+",
  "V-",
  "mA+",
  "mA-",
] as const;

/**
 * The Fig-1 T-network wired into the kit board, independent of how the student
 * patches the source / meters in. The common bottom rail (T2–T5–T4) is a solid
 * 0 Ω bus; R1/R2/R3 are the three resistive branches.
 */
export interface Netlist {
  /** terminal id → electrical node index (0..nodeCount-1) */
  readonly nodeOf: Map<string, number>;
  readonly nodeCount: number;
  readonly resistors: ResistorBranch[];
  readonly sources: SourceBranch[];
  readonly meters: SenseBranch[];
}

/** Tiny union-find over terminal-id strings (used to merge 0 Ω connections). */
class UnionFind {
  private readonly parent = new Map<string, string>();

  find(x: string): string {
    let p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    if (p === x) return x;
    p = this.find(p);
    this.parent.set(x, p);
    return p;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/**
 * Build the circuit's netlist from the *static* kit wiring plus the live patch
 * cords. Every cord is treated as an ideal wire (0 Ω), so it merges the two
 * terminals it joins into a single electrical node.
 */
export function buildNetlist(
  wiring: WiringState,
  params: CircuitParams = DEFAULT_CIRCUIT,
): Netlist {
  const uf = new UnionFind();

  // Fixed 0 Ω links built into the board: the common bottom rail bus.
  uf.union("T2", "T5");
  uf.union("T5", "T4");

  // Patch cords are ideal wires too.
  for (const cord of wiring.list()) uf.union(cord.a, cord.b);

  // Assign a stable node index to each electrical node (union-find root).
  const rootToNode = new Map<string, number>();
  const nodeOf = new Map<string, number>();
  const node = (id: string): number => {
    const root = uf.find(id);
    let n = rootToNode.get(root);
    if (n === undefined) {
      n = rootToNode.size;
      rootToNode.set(root, n);
    }
    nodeOf.set(id, n);
    return n;
  };
  for (const id of TERMINAL_IDS) node(id);

  const resistors: ResistorBranch[] = [
    { id: "R1", a: "T1", b: "C1", ohms: params.r1 },
    { id: "R2", a: "C1", b: "T3", ohms: params.r2 },
    { id: "R3", a: "C1", b: "T5", ohms: params.r3 },
  ];

  const sources: SourceBranch[] = [
    { id: "E", positive: "E+", negative: "E-", volts: params.E },
  ];

  const meters: SenseBranch[] = [{ id: "mA", positive: "mA+", negative: "mA-" }];

  return { nodeOf, nodeCount: rootToNode.size, resistors, sources, meters };
}
