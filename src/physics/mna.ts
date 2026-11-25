import type { Netlist } from "./netlist";

/** Result of a Modified Nodal Analysis solve. */
export interface MnaSolution {
  /** Node voltage (V) indexed by netlist node index; isolated nodes read 0. */
  readonly nodeVoltage: number[];
  /** Branch current per netlist.sources entry (A, flowing + terminal → −). */
  readonly sourceCurrent: number[];
  /** Branch current per netlist.meters entry (A, flowing + terminal → −). */
  readonly meterCurrent: number[];
}

/** Solve A·x = b in place with Gaussian elimination + partial pivoting. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  if (n === 0) return [];

  for (let col = 0; col < n; col += 1) {
    // Partial pivot: move the row with the largest magnitude into `col`.
    let pivot = col;
    let best = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row += 1) {
      const v = Math.abs(A[row][col]);
      if (v > best) {
        best = v;
        pivot = row;
      }
    }
    if (best < 1e-12) return null; // singular — no unique solution

    if (pivot !== col) {
      const tmpRow = A[pivot];
      A[pivot] = A[col];
      A[col] = tmpRow;
      const tmpB = b[pivot];
      b[pivot] = b[col];
      b[col] = tmpB;
    }

    const diag = A[col][col];
    for (let row = col + 1; row < n; row += 1) {
      const factor = A[row][col] / diag;
      if (factor === 0) continue;
      for (let c = col; c < n; c += 1) A[row][c] -= factor * A[col][c];
      b[row] -= factor * b[col];
    }
  }

  // Back-substitution.
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = b[row];
    for (let c = row + 1; c < n; c += 1) sum -= A[row][c] * x[c];
    x[row] = sum / A[row][row];
  }
  return x;
}

/** Array-based union-find over electrical node indices. */
class NodeDsu {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[x] !== root) {
      const next = this.parent[x];
      this.parent[x] = root;
      x = next;
    }
    return root;
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

/**
 * Modified Nodal Analysis of the netlist.
 *
 * - resistors → conductances stamped into G
 * - each voltage source (the supply and each ideal ammeter) → an extra branch
 *   current unknown, stamped into G and driven by its value (0 V for a meter)
 * - the reference node is the supply's `−` terminal; nodes electrically
 *   isolated from it are not part of the solved system and read 0 V.
 *
 * Returns `null` if the system is singular (e.g. a contradictory source loop);
 * callers then simply show no reading rather than crashing.
 */
export function solveMna(net: Netlist, groundTerminal = "E-"): MnaSolution | null {
  const n = net.nodeCount;
  const ground = net.nodeOf.get(groundTerminal);
  if (ground === undefined) return null;

  // Connect nodes that share *any* element, then keep only the ground's island.
  const dsu = new NodeDsu(n);
  const join = (a?: number, b?: number) => {
    if (a !== undefined && b !== undefined) dsu.union(a, b);
  };
  for (const r of net.resistors) join(net.nodeOf.get(r.a), net.nodeOf.get(r.b));
  for (const s of net.sources) join(net.nodeOf.get(s.positive), net.nodeOf.get(s.negative));
  for (const mt of net.meters) join(net.nodeOf.get(mt.positive), net.nodeOf.get(mt.negative));

  const groundRoot = dsu.find(ground);
  const inCircuit = (idx?: number) => idx !== undefined && dsu.find(idx) === groundRoot;

  // Unknown node voltages: every in-circuit node except the reference.
  const varOf = new Map<number, number>();
  for (let i = 0; i < n; i += 1) {
    if (i !== ground && dsu.find(i) === groundRoot) varOf.set(i, varOf.size);
  }
  const m = varOf.size;

  // Branches carrying a current unknown (voltage sources + ideal ammeters).
  interface Branch {
    pos?: number;
    neg?: number;
    value: number;
    kind: "source" | "meter";
    index: number;
  }
  const branches: Branch[] = [];
  net.sources.forEach((s, index) =>
    branches.push({
      pos: net.nodeOf.get(s.positive),
      neg: net.nodeOf.get(s.negative),
      value: s.volts,
      kind: "source",
      index,
    }),
  );
  net.meters.forEach((meter, index) =>
    branches.push({
      pos: net.nodeOf.get(meter.positive),
      neg: net.nodeOf.get(meter.negative),
      value: 0,
      kind: "meter",
      index,
    }),
  );

  // A branch only enters the system if at least one end is in the ground island.
  const active = branches.filter((br) => inCircuit(br.pos) || inCircuit(br.neg));
  const s = active.length;

  const size = m + s;
  const A: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const bVec = new Array<number>(size).fill(0);
  const vi = (idx?: number): number => {
    if (idx === undefined) return -1;
    const v = varOf.get(idx);
    return v === undefined ? -1 : v; // ground & off-island nodes are fixed
  };

  // Stamp resistances as conductances.
  for (const r of net.resistors) {
    const ia = vi(net.nodeOf.get(r.a));
    const ib = vi(net.nodeOf.get(r.b));
    const g = 1 / r.ohms;
    if (ia >= 0) A[ia][ia] += g;
    if (ib >= 0) A[ib][ib] += g;
    if (ia >= 0 && ib >= 0) {
      A[ia][ib] -= g;
      A[ib][ia] -= g;
    }
  }

  // Stamp voltage-source branches (value 0 for an ideal ammeter).
  active.forEach((branch, k) => {
    const row = m + k;
    const ip = vi(branch.pos);
    const ineg = vi(branch.neg);
    if (ip >= 0) {
      A[ip][row] += 1;
      A[row][ip] += 1;
    }
    if (ineg >= 0) {
      A[ineg][row] -= 1;
      A[row][ineg] -= 1;
    }
    bVec[row] = branch.value;
  });

  const x = solveLinear(A, bVec);
  if (!x) return null;

  const nodeVoltage = new Array<number>(n).fill(0);
  for (const [nodeIdx, varIdx] of varOf) nodeVoltage[nodeIdx] = x[varIdx];

  const sourceCurrent = new Array<number>(net.sources.length).fill(0);
  const meterCurrent = new Array<number>(net.meters.length).fill(0);
  active.forEach((branch, k) => {
    const current = x[m + k];
    if (branch.kind === "source") sourceCurrent[branch.index] = current;
    else meterCurrent[branch.index] = current;
  });

  return { nodeVoltage, sourceCurrent, meterCurrent };
}
