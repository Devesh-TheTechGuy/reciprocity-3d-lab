/**
 * M5 slice 4 — performance pass: quality presets + an adaptive governor.
 *
 * `PerfGovernor` measures real frame rate and, in `auto` mode, steps the quality
 * tier down when the average FPS stays low and back up once it recovers (with
 * hysteresis, so it never oscillates). The knobs it drives all live behind the
 * {@link QualityTargets} interface, so the renderer / post-FX stack stays the only
 * place that knows *how* a preset is applied.
 */
export type QualityTier = "high" | "medium" | "low";
export type QualityMode = "auto" | QualityTier;

/** One rung of the quality ladder. */
export interface QualityPreset {
  readonly label: string;
  /** Hard cap on device pixel ratio (1 = render at native CSS pixels). */
  readonly pixelRatioCap: number;
  /** Directional sun shadow map edge, in pixels. */
  readonly shadowMapSize: number;
  /** MSAA samples on the composer's intermediate buffers (0 disables). */
  readonly samples: number;
  readonly ssao: boolean;
  readonly bloom: boolean;
}

/** Ordered best → cheapest. `low` is the safe floor for weak hardware. */
export const QUALITY_PRESETS: Record<QualityTier, QualityPreset> = {
  high: {
    label: "High",
    pixelRatioCap: 2,
    shadowMapSize: 2048,
    samples: 4,
    ssao: true,
    bloom: true,
  },
  medium: {
    label: "Medium",
    pixelRatioCap: 1.5,
    shadowMapSize: 1024,
    samples: 2,
    ssao: false,
    bloom: true,
  },
  low: {
    label: "Low",
    pixelRatioCap: 1,
    shadowMapSize: 512,
    samples: 0,
    ssao: false,
    bloom: false,
  },
};

const ORDER: readonly QualityTier[] = ["high", "medium", "low"];

/** Applies a preset to the live renderer / lighting / post-FX stack. */
export interface QualityTargets {
  setPixelRatioCap(cap: number): void;
  setShadowMapSize(size: number): void;
  setSamples(samples: number): void;
  setPasses(enabled: { ssao: boolean; bloom: boolean }): void;
}

export interface PerfOptions {
  /** Averaged FPS below this counts as "struggling". */
  lowFps?: number;
  /** Averaged FPS above this counts as "comfortable". */
  highFps?: number;
  /** Consecutive 1 s low samples before stepping down. */
  downAfter?: number;
  /** Consecutive 1 s high samples before stepping back up. */
  upAfter?: number;
}

export class PerfGovernor {
  private readonly targets: QualityTargets;
  private readonly lowFps: number;
  private readonly highFps: number;
  private readonly downAfter: number;
  private readonly upAfter: number;

  private mode: QualityMode = "auto";
  private tier: QualityTier = "high";
  private applied: QualityTier | null = null;

  private last = 0;
  private bucketTime = 0;
  private bucketFrames = 0;
  private lowStreak = 0;
  private highStreak = 0;
  private currentFps = 0;

  private readonly listeners = new Set<() => void>();

  constructor(targets: QualityTargets, opts: PerfOptions = {}) {
    this.targets = targets;
    this.lowFps = opts.lowFps ?? 45;
    this.highFps = opts.highFps ?? 58;
    this.downAfter = opts.downAfter ?? 3;
    this.upAfter = opts.upAfter ?? 5;
    this.apply(this.tier);
  }

  /** Latest averaged FPS (refreshed once per second). */
  get fps(): number {
    return this.currentFps;
  }

  get qualityMode(): QualityMode {
    return this.mode;
  }

  /** The concrete tier in effect right now (`auto` resolves to a real tier). */
  get tierName(): QualityTier {
    return this.tier;
  }

  setMode(mode: QualityMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.lowStreak = 0;
    this.highStreak = 0;
    this.apply(this.mode === "auto" ? this.tier : this.mode);
    // `apply` is a no-op when the resolved tier does not change (e.g. switching
    // between `auto` and the tier it resolved to), so the mode change itself is
    // announced here for the UI.
    this.emit();
  }

  /**
   * Feed one frame. `nowMs` defaults to `performance.now()`; pass a synthetic
   * timestamp to drive the governor deterministically (used by QA).
   */
  tick(nowMs: number = performance.now()): void {
    if (this.last === 0) {
      this.last = nowMs;
      return;
    }
    const dt = (nowMs - this.last) / 1000;
    this.last = nowMs;
    // Ignore absurd gaps (backgrounded tab / first resume) so a pause cannot
    // masquerade as a slow frame and trigger a needless downgrade.
    if (dt <= 0 || dt > 0.5) return;

    this.bucketTime += dt;
    this.bucketFrames += 1;
    if (this.bucketTime < 1) return;

    this.currentFps = this.bucketFrames / this.bucketTime;
    this.bucketTime = 0;
    this.bucketFrames = 0;
    this.emit();
    if (this.mode === "auto") this.adapt();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private adapt(): void {
    if (this.currentFps < this.lowFps) {
      this.lowStreak += 1;
      this.highStreak = 0;
      if (this.lowStreak >= this.downAfter) {
        this.lowStreak = 0;
        this.step("down");
      }
    } else if (this.currentFps > this.highFps) {
      this.highStreak += 1;
      this.lowStreak = 0;
      if (this.highStreak >= this.upAfter) {
        this.highStreak = 0;
        this.step("up");
      }
    } else {
      this.lowStreak = 0;
      this.highStreak = 0;
    }
  }

  /** Move one rung toward the floor ("down") or the ceiling ("up"). */
  private step(dir: "down" | "up"): void {
    const i = ORDER.indexOf(this.tier) + (dir === "down" ? 1 : -1);
    if (i < 0 || i >= ORDER.length) return; // already at a boundary
    this.tier = ORDER[i];
    this.apply(this.tier);
  }

  private apply(tier: QualityTier): void {
    if (this.applied === tier) return;
    this.applied = tier;
    const p = QUALITY_PRESETS[tier];
    this.targets.setPixelRatioCap(p.pixelRatioCap);
    this.targets.setSamples(p.samples);
    this.targets.setShadowMapSize(p.shadowMapSize);
    this.targets.setPasses({ ssao: p.ssao, bloom: p.bloom });
    this.emit();
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}
