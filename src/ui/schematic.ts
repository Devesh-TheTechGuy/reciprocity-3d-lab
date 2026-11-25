import type { CircuitParams, CircuitSolution } from "../physics";
import type { Connection } from "../state/wiring";

/** Inputs the schematic needs: the live circuit + the figure to guide towards. */
export interface SchematicInput {
  params: CircuitParams;
  solution: CircuitSolution | null;
  /** The patch cords currently plugged on the board. */
  cords: readonly Connection[];
  /** Figure the student is working towards (drives the dashed "how to wire" guide). */
  target: "A" | "B";
}

/** Where every terminal sits in the 2D schematic (SVG user units). */
const NODE: Record<string, { x: number; y: number }> = {
  T1: { x: 70, y: 80 },
  C1: { x: 170, y: 80 },
  T3: { x: 270, y: 80 },
  T2: { x: 70, y: 200 },
  T5: { x: 170, y: 200 },
  T4: { x: 270, y: 200 },
  "E+": { x: 48, y: 246 },
  "E-": { x: 78, y: 246 },
  "V+": { x: 156, y: 246 },
  "V-": { x: 186, y: 246 },
  "mA+": { x: 264, y: 246 },
  "mA-": { x: 294, y: 246 },
};

/** Terminals that belong to the fixed kit board (vs. the loose instruments). */
const BOARD = new Set(["T1", "C1", "T3", "T2", "T5", "T4"]);

const COLOR = {
  brass: "#e0b93f",
  red: "#ff6b6b",
  black: "#c9cfd8",
  accent: "#4c8bff",
  ok: "#3ee06a",
} as const;

const isPositivePost = (id: string): boolean => id === "E+" || id === "V+" || id === "mA+";
const isNegativePost = (id: string): boolean => id === "E-" || id === "V-" || id === "mA-";

/** Colour a cord by the instrument post it lands on. */
function cordColor(a: string, b: string): string {
  if (isPositivePost(a) || isPositivePost(b)) return COLOR.red;
  if (isNegativePost(a) || isNegativePost(b)) return COLOR.black;
  return COLOR.brass;
}

/**
 * SVG path between two terminals, drawn from `a` → `b`. Board-to-board links are
 * straight; anything touching an instrument is a smooth S so cords do not mask
 * the board.
 */
function pathFor(a: string, b: string): string {
  const p1 = NODE[a];
  const p2 = NODE[b];
  if (!p1 || !p2) return "";
  if (BOARD.has(a) && BOARD.has(b)) return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
  const dy = (p2.y - p1.y) * 0.55;
  return `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + dy}, ${p2.x} ${p2.y - dy}, ${p2.x} ${p2.y}`;
}

/** Zig-zag resistor glyph, horizontal. */
function zigzagH(x1: number, x2: number, y: number, amp: number, teeth = 3): string {
  const n = teeth * 2;
  const seg = (x2 - x1) / n;
  let d = `M ${x1} ${y}`;
  for (let i = 1; i <= n; i += 1) {
    d += ` L ${x1 + seg * i} ${i % 2 === 1 ? y - amp : y + amp}`;
  }
  return `${d} L ${x2} ${y}`;
}

/** Zig-zag resistor glyph, vertical. */
function zigzagV(y1: number, y2: number, x: number, amp: number, teeth = 3): string {
  const n = teeth * 2;
  const seg = (y2 - y1) / n;
  let d = `M ${x} ${y1}`;
  for (let i = 1; i <= n; i += 1) {
    d += ` L ${i % 2 === 1 ? x - amp : x + amp} ${y1 + seg * i}`;
  }
  return `${d} L ${x} ${y2}`;
}

/**
 * Directed wires that carry the meter current, per figure. This mirrors the
 * solver's result: Fig 1(a) reads the R2 branch current, Fig 1(b) the R1 branch,
 * and by reciprocity they are equal (I = E·R3 / (R1R2 + R2R3 + R1R3)). Pairs whose
 * terminals are both on the board are internal; the rest match patch cords.
 */
const FLOW: Record<"A" | "B", Array<[string, string]>> = {
  A: [
    ["E+", "T1"],
    ["T2", "E-"],
    ["T3", "mA+"],
    ["mA-", "T4"],
    ["T1", "C1"],
    ["C1", "T3"],
    ["C1", "T5"],
    ["T4", "T5"],
    ["T5", "T2"],
  ],
  B: [
    ["E+", "T3"],
    ["T4", "E-"],
    ["T1", "mA+"],
    ["mA-", "T2"],
    ["T3", "C1"],
    ["C1", "T1"],
    ["C1", "T5"],
    ["T2", "T5"],
    ["T5", "T4"],
  ],
};

/** Recommended patch cords for each figure ("how to connect the wires"). */
const GUIDE: Record<"A" | "B", Array<[string, string]>> = {
  A: [
    ["E+", "T1"],
    ["E-", "T2"],
    ["V+", "T1"],
    ["V-", "T2"],
    ["mA+", "T3"],
    ["mA-", "T4"],
  ],
  B: [
    ["E+", "T3"],
    ["E-", "T4"],
    ["V+", "T3"],
    ["V-", "T4"],
    ["mA+", "T1"],
    ["mA-", "T2"],
  ],
};

interface FlowPath {
  el: SVGPathElement;
  dir: number;
}

/**
 * A live 2D wiring schematic on the side of the screen. It mirrors the physical
 * kit — the fixed R1/R2/R3 T-network plus the E, V and mA instruments — draws the
 * cords the student has actually patched, overlays a dashed "how to wire" guide
 * for the figure they are working towards, and animates the current around the
 * loop (speed proportional to |I|) whenever the circuit is closed.
 */
export class Schematic {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly title: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private collapsed = false;

  private flowPaths: FlowPath[] = [];
  private offset = 0;
  private speed = 0;

  constructor() {
    const root = document.createElement("div");
    root.className = "ui ui-schematic";
    root.innerHTML = `
      <div class="ui-schematic-head">
        <h3>Circuit Map <span data-role="sch-title">Fig 1(a)</span></h3>
        <button type="button" data-role="sch-toggle" title="Collapse">&#9662;</button>
      </div>
      <div class="ui-schematic-body" data-role="sch-body"></div>
    `;
    document.body.appendChild(root);

    this.root = root;
    this.body = Schematic.require(root, "sch-body");
    this.title = Schematic.require(root, "sch-title");
    this.toggle = Schematic.requireButton(root, "sch-toggle");
    this.toggle.addEventListener("click", () => this.setCollapsed(!this.collapsed));
  }

  /** Repaint the whole schematic from the latest circuit state. */
  render(input: SchematicInput): void {
    const cfg = input.solution?.config ?? null;
    const live = cfg !== null;
    const current = live && input.solution ? input.solution.current : 0;
    const voltage = live && input.solution ? input.solution.voltage : 0;
    const shown: "A" | "B" = cfg ?? input.target;

    this.title.textContent = `Fig 1(${shown.toLowerCase()})`;

    const attached = new Set<string>();
    for (const c of input.cords) {
      attached.add(c.a);
      attached.add(c.b);
    }

    const svg: string[] = [
      `<svg class="ui-schematic-svg" viewBox="0 0 340 304" role="img" aria-label="Circuit wiring diagram">`,
      // Board outline + fixed T-network links.
      `<rect class="sch-board" x="46" y="60" width="248" height="160" rx="10" />`,
      `<path class="sch-wire" d="${pathFor("T2", "T5")}" />`,
      `<path class="sch-wire" d="${pathFor("T5", "T4")}" />`,
      `<path class="sch-wire" d="${pathFor("T1", "C1")}" />`,
      `<path class="sch-wire" d="${pathFor("C1", "T3")}" />`,
      `<path class="sch-wire" d="${pathFor("C1", "T5")}" />`,
      // Resistor glyphs + references.
      `<path class="sch-resistor" d="${zigzagH(86, 154, 80, 8)}" />`,
      `<path class="sch-resistor" d="${zigzagH(186, 254, 80, 8)}" />`,
      `<path class="sch-resistor" d="${zigzagV(92, 188, 170, 8)}" />`,
      Schematic.label(120, 62, "R1", "sch-ref", "middle"),
      Schematic.label(220, 62, "R2", "sch-ref", "middle"),
      Schematic.label(184, 140, "R3", "sch-ref", "start"),
    ];

    // Dashed "how to wire" guide (only while the circuit is open).
    if (!live) {
      for (const [a, b] of GUIDE[input.target]) {
        svg.push(`<path class="sch-guide" d="${pathFor(a, b)}" stroke="${cordColor(a, b)}" />`);
      }
    }

    // The cords the student has actually patched.
    for (const c of input.cords) {
      if (!NODE[c.a] || !NODE[c.b]) continue;
      svg.push(
        `<path class="sch-cord" d="${pathFor(c.a, c.b)}" stroke="${cordColor(c.a, c.b)}" />`,
      );
    }

    // Animated current flow (only when the circuit is closed).
    const flowSegs: Array<{ d: string; dir: number }> = [];
    if (live) {
      const dirSet = new Set(FLOW[cfg].map(([f, t]) => `${f}>${t}`));
      for (const [f, t] of FLOW[cfg]) {
        if (BOARD.has(f) && BOARD.has(t)) flowSegs.push({ d: pathFor(f, t), dir: 1 });
      }
      for (const c of input.cords) {
        if (!NODE[c.a] || !NODE[c.b]) continue;
        if (dirSet.has(`${c.a}>${c.b}`)) flowSegs.push({ d: pathFor(c.a, c.b), dir: 1 });
        else if (dirSet.has(`${c.b}>${c.a}`)) flowSegs.push({ d: pathFor(c.a, c.b), dir: -1 });
      }
    }
    for (const seg of flowSegs) {
      svg.push(`<path class="sch-flow" data-dir="${seg.dir}" d="${seg.d}" />`);
    }

    // Terminals: dotted ring = guide target, solid ring = a cord is plugged in.
    const ghostTargets = new Set<string>();
    if (!live) {
      for (const [a, b] of GUIDE[input.target]) {
        ghostTargets.add(a);
        ghostTargets.add(b);
      }
    }
    for (const [id, p] of Object.entries(NODE)) {
      const fill = isPositivePost(id) ? COLOR.red : isNegativePost(id) ? COLOR.black : COLOR.brass;
      if (ghostTargets.has(id)) {
        svg.push(`<circle class="sch-ring sch-ring--guide" cx="${p.x}" cy="${p.y}" r="8" />`);
      } else if (attached.has(id)) {
        svg.push(`<circle class="sch-ring sch-ring--live" cx="${p.x}" cy="${p.y}" r="7.5" />`);
      }
      svg.push(`<circle class="sch-post" cx="${p.x}" cy="${p.y}" r="4" fill="${fill}" />`);
    }

    // Terminal labels.
    svg.push(Schematic.label(70, 66, "T1", "sch-pin", "middle"));
    svg.push(Schematic.label(170, 66, "C1", "sch-pin", "middle"));
    svg.push(Schematic.label(270, 66, "T3", "sch-pin", "middle"));
    svg.push(Schematic.label(70, 218, "T2", "sch-pin", "middle"));
    svg.push(Schematic.label(170, 218, "T5", "sch-pin", "middle"));
    svg.push(Schematic.label(270, 218, "T4", "sch-pin", "middle"));

    // Instrument boxes with live readings.
    const res = `${input.params.r1} / ${input.params.r2} / ${input.params.r3} &#937;`;
    svg.push(Schematic.instrument(28, "E", `${input.params.E.toFixed(2)} V`, res));
    svg.push(
      Schematic.instrument(136, "V", live ? `${voltage.toFixed(3)} V` : "0.000 V", "voltmeter"),
    );
    svg.push(
      Schematic.instrument(
        244,
        "mA",
        live ? `${(current * 1000).toFixed(2)} mA` : "0.00 mA",
        "milliammeter",
      ),
    );

    svg.push(`</svg>`);

    const status = live
      ? `Closed loop &middot; <strong>${(current * 1000).toFixed(2)} mA</strong> through the ammeter`
      : `Open circuit &middot; patch the dashed cords for Fig&nbsp;1(${input.target.toLowerCase()})`;
    svg.push(`
      <p class="ui-schematic-legend">
        <span class="sch-swatch sch-swatch--guide"></span>guide
        <span class="sch-swatch sch-swatch--red"></span>+ lead
        <span class="sch-swatch sch-swatch--black"></span>&minus; lead
      </p>
      <p class="ui-schematic-status">${status}</p>`);

    this.body.innerHTML = svg.join("");

    this.flowPaths = Array.from(this.body.querySelectorAll<SVGPathElement>("path.sch-flow")).map(
      (el) => ({ el, dir: Number(el.dataset.dir) || 1 }),
    );
    this.offset = 0;
    this.speed = live ? 8 + Math.min(current * 1000, 40) * 1.2 : 0;
  }

  /** Advance the marching-current animation. Called once per frame. */
  tick(delta: number): void {
    if (this.flowPaths.length === 0 || this.speed === 0) return;
    this.offset = (this.offset - this.speed * delta) % 10;
    for (const { el, dir } of this.flowPaths) {
      el.style.strokeDashoffset = String(this.offset * dir);
    }
  }

  private setCollapsed(next: boolean): void {
    this.collapsed = next;
    this.root.classList.toggle("ui-schematic--collapsed", next);
    this.toggle.innerHTML = next ? "&#9656;" : "&#9662;";
    this.toggle.title = next ? "Expand" : "Collapse";
  }

  private static label(
    x: number,
    y: number,
    text: string,
    cls: string,
    anchor: "start" | "middle" | "end",
  ): string {
    return `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${text}</text>`;
  }

  private static instrument(cx: number, name: string, reading: string, sub: string): string {
    return `<g class="sch-instrument">
        <rect x="${cx}" y="252" width="70" height="44" rx="9" />
        <text class="sch-instrument-name" x="${cx + 35}" y="267" text-anchor="middle">${name}</text>
        <text class="sch-instrument-value" x="${cx + 35}" y="283" text-anchor="middle">${reading}</text>
        <text class="sch-instrument-sub" x="${cx + 35}" y="293" text-anchor="middle">${sub}</text>
      </g>`;
  }

  private static require(root: HTMLElement, role: string): HTMLElement {
    const el = root.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (!el) throw new Error(`Schematic element not found: ${role}`);
    return el;
  }

  private static requireButton(root: HTMLElement, role: string): HTMLButtonElement {
    const el = root.querySelector<HTMLButtonElement>(`[data-role="${role}"]`);
    if (!el) throw new Error(`Schematic button not found: ${role}`);
    return el;
  }
}

