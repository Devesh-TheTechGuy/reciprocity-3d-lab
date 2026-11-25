import type { CameraMode } from "../interaction/cameraRig";

export interface HudCallbacks {
  onEnterFirstPerson: () => void;
  onExitToOrbit: () => void;
  /** Clicking the "Paused" card should re-acquire the pointer / start playing. */
  onResume: () => void;
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

      <div class="ui-crosshair" data-role="crosshair"></div>
      <div class="ui-hintbar" data-role="hint">
        <span>W A S D</span> move &nbsp;&middot;&nbsp; <span>Shift</span> run
        &nbsp;&middot;&nbsp; <span>drag</span> to look
        &nbsp;&middot;&nbsp; <span>Left-click</span> patch a cord
        &nbsp;&middot;&nbsp; <span>Right-click</span> unplug
      </div>
    `;
    document.body.appendChild(root);

    this.intro = Hud.require(root, "intro");
    this.paused = Hud.require(root, "paused");
    this.crosshair = Hud.require(root, "crosshair");
    this.hintbar = Hud.require(root, "hint");

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

  private static require(root: HTMLElement, role: string): HTMLElement {
    const el = root.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (!el) throw new Error(`HUD element not found: ${role}`);
    return el;
  }
}
