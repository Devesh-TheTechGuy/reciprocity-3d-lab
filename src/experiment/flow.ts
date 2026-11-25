import {
  theoreticalCurrent,
  type CircuitParams,
  type CircuitSolution,
} from "../physics";
import { resistorSignature } from "./components";

/** Coarse progress of the experiment, derived from the *current* wiring. */
export type FlowState =
  | "idle"
  | "needsA"
  | "recordedA"
  | "needsB"
  | "recordedB";

/** One row of Table 1 (plus the bookkeeping needed to verify it). */
export interface ObservationRow {
  sno: number;
  /** Source EMF held for this row, in volts. */
  E: number;
  /** Resistor set that was on the board, as `"r1/r2/r3"`. */
  resistorSig: string;
  /** Ammeter reading in Fig 1(a), in amps (null until recorded). */
  iA: number | null;
  /** Ammeter reading in Fig 1(b), in amps (null until recorded). */
  iB: number | null;
  /** Closed-form I = E·R3/(R1R2+R2R3+R1R3) for this row, in amps. */
  theory: number;
  /** True once both readings exist and match within tolerance. */
  verified: boolean;
}

export interface ExperimentView {
  state: FlowState;
  /** Next-step instruction for the student. */
  prompt: string;
  canRecordA: boolean;
  canRecordB: boolean;
  rows: ObservationRow[];
  /** Overall verdict across all completed rows. */
  verdict: "verified" | "mismatch" | "pending";
}

/** Tolerance for calling two float readings equal (0.5%, floor of 0.02 mA). */
function tolerance(i: number): number {
  return Math.max(0.02e-3, Math.abs(i) * 0.005);
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(tolerance(a), tolerance(b));
}

/**
 * The Fig 1(a) → Fig 1(b) experiment state machine (procedure steps 1–5).
 *
 * It is a pure model: it never touches the DOM or the scene. `main.ts` feeds it
 * the live `CircuitSolution` + `CircuitParams` on every wiring/value change, and
 * the UI reads the {@link ExperimentView} it returns. Rows are keyed by
 * `(EMF, resistor set)`, so *changing R1–R3 and repeating* (step 5) simply opens
 * a new row while I_A and I_B from a single condition are compared together.
 */
export class ExperimentFlow {
  private readonly rows: ObservationRow[] = [];
  private seq = 0;
  private last: { solution: CircuitSolution | null; params: CircuitParams } | null = null;

  /** Recompute the view from the latest solution + component values. */
  update(solution: CircuitSolution | null, params: CircuitParams): ExperimentView {
    this.last = { solution, params };
    return this.view();
  }

  /** Snapshot the current reading into the row for this figure. */
  record(label: "A" | "B"): boolean {
    const can = label === "A" ? this.canRecord("A") : this.canRecord("B");
    if (!can || !this.last?.solution) return false;

    const { solution, params } = this.last;
    const sig = resistorSignature(params);
    const slot = label === "A" ? "iA" : "iB";

    let row =
      this.rows.find((r) => r.E === params.E && r.resistorSig === sig && r[slot] === null) ??
      this.rows.find((r) => r.E === params.E && r.resistorSig === sig);

    if (!row) {
      row = {
        sno: (this.seq += 1),
        E: params.E,
        resistorSig: sig,
        iA: null,
        iB: null,
        theory: theoreticalCurrent(params),
        verified: false,
      };
      this.rows.push(row);
    }

    row[slot] = solution.current;
    row.verified =
      row.iA !== null && row.iB !== null && nearlyEqual(row.iA, row.iB);
    return true;
  }

  /** Clear all observations and start over. */
  reset(): void {
    this.rows.length = 0;
    this.seq = 0;
  }

  private canRecord(label: "A" | "B"): boolean {
    const solution = this.last?.solution;
    return Boolean(solution && solution.config === label);
  }

  private view(): ExperimentView {
    const solution = this.last?.solution ?? null;
    const params = this.last?.params ?? null;
    const cfg = solution?.config ?? null;

    const canRecordA = cfg === "A";
    const canRecordB = cfg === "B";

    // The row for the *current* condition, if any.
    const row =
      params === null
        ? undefined
        : this.rows.find(
            (r) => r.E === params.E && r.resistorSig === resistorSignature(params),
          );

    let state: FlowState = "idle";
    if (cfg === "A") state = row && row.iA !== null ? "recordedA" : "needsA";
    else if (cfg === "B") state = row && row.iB !== null ? "recordedB" : "needsB";

    return {
      state,
      prompt: this.prompt(state, cfg),
      canRecordA,
      canRecordB,
      rows: this.rows,
      verdict: this.verdict(),
    };
  }

  private verdict(): ExperimentView["verdict"] {
    const complete = this.rows.filter((r) => r.iA !== null && r.iB !== null);
    if (complete.length === 0) return "pending";
    return complete.every((r) => r.verified) ? "verified" : "mismatch";
  }

  private prompt(state: FlowState, cfg: "A" | "B" | null): string {
    switch (state) {
      case "needsA":
        return "Fig 1(a) wired — click “Record I_A”.";
      case "recordedA":
        return "I_A noted. Interchange source and ammeter: rewire as Fig 1(b).";
      case "needsB":
        return "Fig 1(b) wired — click “Record I_B”.";
      case "recordedB":
        return "I_B noted — compare with I_A, then change R1–R3 to repeat.";
      default:
        return cfg === null
          ? "Wire Fig 1(a): E and V across T1/T2, mA across T3/T4."
          : "Wiring incomplete.";
    }
  }
}
