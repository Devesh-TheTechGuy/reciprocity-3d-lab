import { QUALITY_PRESETS, type QualityMode, type QualityTier } from "../core/perf";

export interface PerfPanelCallbacks {
  /** The student picked a quality mode (or "auto"). */
  onMode(mode: QualityMode): void;
}

const MODES: readonly QualityMode[] = ["auto", "high", "medium", "low"];

const MODE_LABEL: Record<QualityMode, string> = {
  auto: "Auto",
  high: "High",
  medium: "Med",
  low: "Low",
};

/**
 * Compact bottom-right performance readout: a live FPS counter plus
 * Auto / High / Medium / Low quality buttons. Presentational only — the chosen
 * mode is handed back through {@link PerfPanelCallbacks} and the whole thing is
 * repainted from the governor's state via {@link update}.
 */
export class PerfPanel {
  private readonly fps: HTMLElement;
  private readonly note: HTMLElement;
  private readonly buttons = new Map<QualityMode, HTMLButtonElement>();

  constructor(callbacks: PerfPanelCallbacks) {
    const root = document.createElement("div");
    root.className = "ui ui-perf";
    root.innerHTML = `
      <div class="ui-perf-head">
        <span class="ui-perf-fps" data-role="perf-fps">-- fps</span>
        <span class="ui-perf-note" data-role="perf-note"></span>
      </div>
      <div class="ui-perf-modes">
        ${MODES.map(
          (mode) =>
            `<button type="button" data-quality="${mode}" title="${
              mode === "auto" ? "Auto — adapt to the frame rate" : QUALITY_PRESETS[mode].label
            }">${MODE_LABEL[mode]}</button>`,
        ).join("")}
      </div>
    `;
    document.body.appendChild(root);

    this.fps = PerfPanel.require(root, "perf-fps");
    this.note = PerfPanel.require(root, "perf-note");
    for (const mode of MODES) {
      const button = root.querySelector<HTMLButtonElement>(`[data-quality="${mode}"]`);
      if (!button) throw new Error(`Perf button not found: ${mode}`);
      button.addEventListener("click", () => callbacks.onMode(mode));
      this.buttons.set(mode, button);
    }
  }

  /** Push the latest governor state into the panel. */
  update(fps: number, mode: QualityMode, tier: QualityTier): void {
    this.fps.textContent = fps > 0 ? `${Math.round(fps)} fps` : "-- fps";
    this.fps.classList.toggle("ui-perf-fps--low", fps > 0 && fps < 45);
    this.note.textContent = mode === "auto" ? `auto · ${QUALITY_PRESETS[tier].label}` : "";
    for (const [value, button] of this.buttons) {
      button.classList.toggle("ui-perf-mode--active", value === mode);
    }
  }

  private static require(root: HTMLElement, role: string): HTMLElement {
    const el = root.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (!el) throw new Error(`Perf element not found: ${role}`);
    return el;
  }
}
