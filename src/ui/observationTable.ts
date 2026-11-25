import type { ExperimentView, ObservationRow } from "../experiment/flow";
import {
  STANDARD_RESISTOR_OHMS,
  formatOhms,
  type ResistorSet,
} from "../experiment/components";

export interface ObservationCallbacks {
  /** Snapshot the current reading for Fig 1(a) / Fig 1(b). */
  onRecord(label: "A" | "B"): void;
  /** Discard all recorded observations. */
  onClear(): void;
  /** The student changed R1/R2/R3 on the kit. */
  onResistorChange(values: ResistorSet): void;
}

const mA = (amps: number): string => (amps * 1000).toFixed(2);

/**
 * On-screen apparatus controls (R1/R2/R3 selectors) and the observation table
 * (Table 1: S.No | E | I_A | I_B). Purely presentational: every interaction is
 * handed back to the caller through {@link ObservationCallbacks}, and the whole
 * panel is repainted from an {@link ExperimentView}.
 */
export class ObservationTable {
  private readonly panel: HTMLElement;
  private readonly body: HTMLElement;
  private readonly verdict: HTMLElement;
  private readonly recordA: HTMLButtonElement;
  private readonly recordB: HTMLButtonElement;
  private readonly reveal: HTMLButtonElement;
  private readonly selects: Record<keyof ResistorSet, HTMLSelectElement>;
  private revealed = false;

  constructor(callbacks: ObservationCallbacks) {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="ui-apparatus" data-role="apparatus">
        <h3>Apparatus values</h3>
        <div class="ui-apparatus-row">
          ${(["r1", "r2", "r3"] as const)
            .map(
              (key) => `
            <label class="ui-apparatus-field">
              <span>${key.toUpperCase()}</span>
              <select data-resistor="${key}">
                ${STANDARD_RESISTOR_OHMS.map(
                  (ohms) => `<option value="${ohms}">${formatOhms(ohms)}</option>`,
                ).join("")}
              </select>
            </label>`,
            )
            .join("")}
        </div>
      </div>

      <div class="ui-observations" data-role="observations">
        <h3>Table 1 · Verification of Reciprocity</h3>
        <table>
          <thead>
            <tr>
              <th>S.No</th><th>E&nbsp;(V)</th><th>I<sub>A</sub>&nbsp;(mA)</th><th>I<sub>B</sub>&nbsp;(mA)</th>
              <th class="ui-obs-theory">Theory</th>
            </tr>
          </thead>
          <tbody data-role="obs-body"></tbody>
        </table>
        <p class="ui-obs-verdict" data-role="obs-verdict">Record I<sub>A</sub> and I<sub>B</sub> to verify.</p>
        <div class="ui-obs-actions">
          <button type="button" data-action="record-a">Record I<sub>A</sub></button>
          <button type="button" data-action="record-b">Record I<sub>B</sub></button>
          <button type="button" data-action="clear">Clear</button>
          <button type="button" data-action="reveal">Reveal theory</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    this.panel = ObservationTable.require(root, "observations");
    this.body = ObservationTable.require(root, "obs-body");
    this.verdict = ObservationTable.require(root, "obs-verdict");
    this.recordA = root.querySelector<HTMLButtonElement>('[data-action="record-a"]')!;
    this.recordB = root.querySelector<HTMLButtonElement>('[data-action="record-b"]')!;
    this.reveal = root.querySelector<HTMLButtonElement>('[data-action="reveal"]')!;

    this.selects = {
      r1: root.querySelector<HTMLSelectElement>('[data-resistor="r1"]')!,
      r2: root.querySelector<HTMLSelectElement>('[data-resistor="r2"]')!,
      r3: root.querySelector<HTMLSelectElement>('[data-resistor="r3"]')!,
    };

    this.recordA.addEventListener("click", () => callbacks.onRecord("A"));
    this.recordB.addEventListener("click", () => callbacks.onRecord("B"));
    root.querySelector<HTMLButtonElement>('[data-action="clear"]')!.addEventListener(
      "click",
      () => callbacks.onClear(),
    );
    this.reveal.addEventListener("click", () => {
      this.revealed = !this.revealed;
      this.panel.classList.toggle("ui-obs--revealed", this.revealed);
      this.reveal.textContent = this.revealed ? "Hide theory" : "Reveal theory";
    });

    for (const key of ["r1", "r2", "r3"] as const) {
      this.selects[key].addEventListener("change", () => callbacks.onResistorChange(this.values()));
    }
  }

  /** Reflect the component values currently on the board. */
  setResistors(values: ResistorSet): void {
    this.selects.r1.value = String(values.r1);
    this.selects.r2.value = String(values.r2);
    this.selects.r3.value = String(values.r3);
  }

  /** Push the latest experiment state into the panel. */
  render(view: ExperimentView): void {
    this.recordA.disabled = !view.canRecordA;
    this.recordB.disabled = !view.canRecordB;

    this.body.innerHTML =
      view.rows.length === 0
        ? `<tr class="ui-obs-empty"><td colspan="5">No readings yet.</td></tr>`
        : view.rows.map((row) => this.row(row)).join("");

    const text: Record<ExperimentView["verdict"], string> = {
      verified: "I_A = I_B — reciprocity verified",
      mismatch: "I_A \u2260 I_B — check the wiring and try again.",
      pending: "Record I_A and I_B to verify.",
    };
    this.verdict.textContent = text[view.verdict];
    this.verdict.classList.toggle("ui-obs-verdict--ok", view.verdict === "verified");
    this.verdict.classList.toggle("ui-obs-verdict--bad", view.verdict === "mismatch");
  }

  private row(row: ObservationRow): string {
    // The theory cell is always rendered; CSS hides the column until revealed.
    const cls = row.verified ? "ui-obs-row--ok" : "";
    return `
      <tr class="${cls}">
        <td>${row.sno}</td>
        <td>${row.E.toFixed(2)}</td>
        <td>${row.iA === null ? "—" : mA(row.iA)}</td>
        <td>${row.iB === null ? "—" : mA(row.iB)}</td>
        <td class="ui-obs-theory">${mA(row.theory)}</td>
      </tr>`;
  }

  private values(): ResistorSet {
    return {
      r1: Number(this.selects.r1.value),
      r2: Number(this.selects.r2.value),
      r3: Number(this.selects.r3.value),
    };
  }

  private static require(root: HTMLElement, role: string): HTMLElement {
    const el = root.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (!el) throw new Error(`Observation element not found: ${role}`);
    return el;
  }
}
