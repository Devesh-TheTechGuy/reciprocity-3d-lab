import type { CameraMode } from "../interaction/cameraRig";

export interface HudCallbacks {
  onEnterFirstPerson: () => void;
  onExitToOrbit: () => void;
  /** Clicking the "Paused" card should re-acquire the pointer / start playing. */
  onResume: () => void;
}

/** Live circuit measurements shown in the top-right readout panel. */
export interface ReadoutView {
  /** e.g. "Fig 1(a)" / "Fig 1(b)" / "not wired". */
  config: string;
  /** Supply EMF, e.g. "6.00 V". */
  emf: string;
  /** Voltmeter reading, e.g. "6.000 V". */
  volts: string;
  /** Milliammeter reading, e.g. "20.00 mA". */
  amps: string;
  /** Closed-form expectation for the same EMF/network, e.g. "20.00 mA". */
  theory: string;
}

/**
 * Screen-space overlay: branding, the intro/paused cards, the first-person
 * crosshair and the control hint bar. Visibility is driven purely by camera
 * mode + lock state via {@link update}.
 */
export class Hud {
  private readonly intro: HTMLElement;
  private readonly paused: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly hintbar: HTMLElement;
  private readonly readout: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly readoutFields: Record<keyof ReadoutView, HTMLElement>;

  constructor(callbacks: HudCallbacks) {
    const root = document.createElement("div");
    root.className = "ui";

    root.innerHTML = `
      <div class="ui-brand">
        Reciprocity Theorem <span>3D Lab</span>
        <em>Virtual Physics Laboratory</em>
      </div>

      <div class="ui-card" data-role="intro">
        <h1>To Verify the Reciprocity Theorem</h1>
        <p>
          A passive, linear, bilateral network obeys
          <strong>I&#8202;<sub>A</sub> = I&#8202;<sub>B</sub></strong>: swapping the source
          and the ammeter between two branches leaves the ammeter reading unchanged.
        </p>
        <p class="ui-note">Drag to orbit &middot; scroll to zoom</p>
        <button type="button" data-action="enter">Enter the lab (first-person)</button>
      </div>

      <div class="ui-card ui-card--small" data-role="paused">
        <h2>Paused</h2>
        <p>Click anywhere in the lab (or here) to look around.</p>
        <button type="button" data-action="exit">Back to overview</button>
      </div>

      <div class="ui-prompt" data-role="prompt"></div>
      <div class="ui-crosshair" data-role="crosshair"></div>
      <div class="ui-hintbar" data-role="hint">
        <span>W A S D</span> move &nbsp;&middot;&nbsp; <span>Shift</span> run
        &nbsp;&middot;&nbsp; <span>drag</span> to look
        &nbsp;&middot;&nbsp; <span>Left-click</span> patch a cord
        &nbsp;&middot;&nbsp; <span>Right-click</span> unplug
      </div>

      <div class="ui-readout" data-role="readout">
        <h3>Circuit <span data-field="config">not wired</span></h3>
        <dl>
          <div><dt>Source E</dt><dd data-field="emf">6.00 V</dd></div>
          <div><dt>Voltmeter V</dt><dd data-field="volts">0.000 V</dd></div>
          <div><dt>Ammeter I</dt><dd data-field="amps">0.00 mA</dd></div>
          <div><dt>Theory I</dt><dd data-field="theory">20.00 mA</dd></div>
        </dl>
      </div>
    `;
    document.body.appendChild(root);

    this.intro = Hud.require(root, "intro");
    this.paused = Hud.require(root, "paused");
    this.crosshair = Hud.require(root, "crosshair");
    this.hintbar = Hud.require(root, "hint");
    this.readout = Hud.require(root, "readout");
    this.prompt = Hud.require(root, "prompt");
    this.readoutFields = {
      config: Hud.field(this.readout, "config"),
      emf: Hud.field(this.readout, "emf"),
      volts: Hud.field(this.readout, "volts"),
      amps: Hud.field(this.readout, "amps"),
      theory: Hud.field(this.readout, "theory"),
    };

    const enter = root.querySelector<HTMLButtonElement>('[data-action="enter"]');
    const exit = root.querySelector<HTMLButtonElement>('[data-action="exit"]');
    enter?.addEventListener("click", callbacks.onEnterFirstPerson);
    exit?.addEventListener("click", callbacks.onExitToOrbit);

    // Clicking the card itself (but not the button) resumes looking.
    this.paused.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("button")) return;
      callbacks.onResume();
    });

    this.update("orbit", false);
  }

  /**
   * @param mode   current camera mode
   * @param active true while the player is actually driving the lab in
   *               first-person (pointer locked, or lock unavailable and using
   *               the drag-to-look fallback) — never tied to a stale lock flag.
   */
  update(mode: CameraMode, active: boolean): void {
    const isOrbit = mode === "orbit";
    const isFp = mode === "firstperson";
    const playing = isFp && active;

    this.intro.classList.toggle("hidden", !isOrbit);
    this.paused.classList.toggle("hidden", !(isFp && !active));
    this.crosshair.classList.toggle("hidden", !playing);
    this.hintbar.classList.toggle("hidden", !playing);
  }

  /** Show the next step of the experiment (e.g. "rewire as Fig 1(b)"). */
  setPrompt(text: string): void {
    this.prompt.textContent = text;
    this.prompt.classList.toggle("hidden", text.length === 0);
  }

  /** Push the latest circuit measurements into the readout panel. */
  setReadings(view: ReadoutView): void {
    this.readoutFields.config.textContent = view.config;
    this.readoutFields.emf.textContent = view.emf;
    this.readoutFields.volts.textContent = view.volts;
    this.readoutFields.amps.textContent = view.amps;
    this.readoutFields.theory.textContent = view.theory;
    const live = view.config === "Fig 1(a)" || view.config === "Fig 1(b)";
    this.readout.classList.toggle("ui-readout--live", live);
  }

  private static require(root: HTMLElement, role: string): HTMLElement {
    const el = root.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (!el) throw new Error(`HUD element not found: ${role}`);
    return el;
  }

  private static field(root: HTMLElement, name: keyof ReadoutView): HTMLElement {
    const el = root.querySelector<HTMLElement>(`[data-field="${name}"]`);
    if (!el) throw new Error(`HUD readout field not found: ${name}`);
    return el;
  }
}
