import type { CameraMode } from "../interaction/cameraRig";

export interface TouchPadCallbacks {
  /** Merged on-screen movement axes, already clamped to -1..1. */
  onMove(forward: number, right: number): void;
  /** Back to the orbit overview — the touch stand-in for the paused card's exit. */
  onExit(): void;
}

type Axis = "up" | "down" | "left" | "right";

const AXES: readonly Axis[] = ["up", "down", "left", "right"];
const GLYPH: Record<Axis, string> = {
  up: "&#9650;",
  down: "&#9660;",
  left: "&#9664;",
  right: "&#9654;",
};

/**
 * On-screen movement pad for touch devices: a four-way D-pad plus a way back to
 * the overview (a phone has no WASD and no `Esc`/paused card to escape with).
 *
 * Presses are captured per button, so sliding a thumb off a button still
 * releases it, and holding two directions at once walks diagonally. Visibility
 * is driven entirely by {@link update}.
 */
export class TouchPad {
  private readonly root: HTMLElement;
  private readonly held = new Set<Axis>();

  constructor(callbacks: TouchPadCallbacks) {
    const root = document.createElement("div");
    root.className = "ui ui-touch hidden";
    root.innerHTML = `
      <button type="button" class="ui-touch-exit" data-role="touch-exit">
        &#8962; Overview
      </button>
      <div class="ui-touch-pad">
        ${AXES.map(
          (axis) =>
            `<button type="button" class="ui-touch-key" data-axis="${axis}" aria-label="walk ${axis}">${GLYPH[axis]}</button>`,
        ).join("")}
      </div>
    `;
    document.body.appendChild(root);
    this.root = root;

    root.querySelector<HTMLButtonElement>('[data-role="touch-exit"]')?.addEventListener(
      "click",
      () => callbacks.onExit(),
    );

    for (const axis of AXES) {
      const button = root.querySelector<HTMLButtonElement>(`[data-axis="${axis}"]`);
      if (!button) throw new Error(`Touch pad key not found: ${axis}`);
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        // Capture so a thumb that slides off the button still releases it.
        // Some synthetic/automated pointers cannot be captured — that must not
        // stop the key from working.
        try {
          button.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
        this.held.add(axis);
        this.emit(callbacks);
      });
      for (const type of ["pointerup", "pointercancel"] as const) {
        button.addEventListener(type, () => {
          this.held.delete(axis);
          this.emit(callbacks);
        });
      }
    }
  }

  /** @param coarse true when the primary input is a finger. */
  update(mode: CameraMode, active: boolean, coarse: boolean): void {
    const visible = coarse && mode === "firstperson" && active;
    this.root.classList.toggle("hidden", !visible);
  }

  private emit(callbacks: TouchPadCallbacks): void {
    const forward = (this.held.has("up") ? 1 : 0) - (this.held.has("down") ? 1 : 0);
    const right = (this.held.has("right") ? 1 : 0) - (this.held.has("left") ? 1 : 0);
    callbacks.onMove(forward, right);
  }
}
