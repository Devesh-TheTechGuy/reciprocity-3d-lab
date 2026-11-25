/** A patched connection between two terminals, realised physically by one cord. */
export interface Connection {
  readonly id: string;
  /** Terminal ids at each end. */
  readonly a: string;
  readonly b: string;
}

/** The two wiring arrangements of the experiment (Fig. 1a and Fig. 1b). */
export type CircuitConfig = "A" | "B" | null;

/**
 * The live wiring graph. Terminals are nodes; each patch cord adds an edge.
 * M3's solver and M4's experiment flow read this state.
 */
export class WiringState {
  private readonly edges: Connection[] = [];
  private seq = 0;

  private readonly listeners = new Set<() => void>();

  add(a: string, b: string): Connection {
    const existing = this.find(a, b);
    if (existing) return existing;
    const connection: Connection = { id: `c${(this.seq += 1)}`, a, b };
    this.edges.push(connection);
    this.emit();
    return connection;
  }

  remove(id: string): void {
    const i = this.edges.findIndex((e) => e.id === id);
    if (i >= 0) {
      this.edges.splice(i, 1);
      this.emit();
    }
  }

  removeAt(terminalId: string, end: "a" | "b"): void {
    const i = this.edges.findIndex((e) => (end === "a" ? e.a : e.b) === terminalId);
    if (i >= 0) {
      this.edges.splice(i, 1);
      this.emit();
    }
  }

  find(a: string, b: string): Connection | undefined {
    return this.edges.find(
      (e) => (e.a === a && e.b === b) || (e.a === b && e.b === a),
    );
  }

  list(): readonly Connection[] {
    return this.edges;
  }

  clear(): void {
    this.edges.length = 0;
    this.emit();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  /** Which Fig-1 arrangement the current wiring realises, if either. */
  detectConfig(): CircuitConfig {
    const mAto = (t: string) => this.find("mA+", t) || this.find("mA-", t);
    const Eto = (t: string) => this.find("E+", t) || this.find("E-", t);

    const mAonLeft = Boolean(mAto("T1")) && Boolean(mAto("T2"));
    const mAonRight = Boolean(mAto("T3")) && Boolean(mAto("T4"));
    const EonLeft = Boolean(Eto("T1")) && Boolean(Eto("T2"));
    const EonRight = Boolean(Eto("T3")) && Boolean(Eto("T4"));

    if (mAonRight && EonLeft) return "A";
    if (mAonLeft && EonRight) return "B";
    return null;
  }
}
