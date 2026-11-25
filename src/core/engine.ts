import * as THREE from "three";

export type Updater = (delta: number, elapsed: number) => void;

/**
 * Optional post-processing chain. When installed via {@link Engine.setComposer}
 * the engine renders through it instead of straight to the canvas.
 */
export interface FrameComposer {
  render(delta: number): void;
  setSize(width: number, height: number): void;
  dispose?(): void;
}

/**
 * Owns the renderer, scene, camera and the animation loop.
 * Modules register per-frame updaters instead of each running their own loop.
 */
export class Engine {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private readonly timer = new THREE.Timer();
  private readonly updaters: Updater[] = [];
  private composer: FrameComposer | null = null;
  /** Ceiling on the device pixel ratio, owned by the perf governor. */
  private pixelRatioCap = 2;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1116);

    this.camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.05,
      200,
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.applySize();

    this.timer.connect(document);
    window.addEventListener("resize", this.onResize);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** Current device-pixel-ratio cap (set by the perf governor). */
  get ratioCap(): number {
    return this.pixelRatioCap;
  }

  /**
   * Cap the device pixel ratio and re-allocate the drawing buffer + composer.
   * Lowering it (e.g. 2 → 1) is the single biggest lever for fill-rate-bound
   * scenes, since it scales every pass's buffer quadratically.
   */
  setPixelRatioCap(cap: number): void {
    const next = Math.max(0.5, cap);
    if (next === this.pixelRatioCap) return;
    this.pixelRatioCap = next;
    this.applySize();
  }

  /** Resize the renderer + composer to the window at the current ratio cap. */
  private applySize(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer?.setSize(window.innerWidth, window.innerHeight);
  }

  add(updater: Updater): void {
    this.updaters.push(updater);
  }

  /** Install (or remove, with `null`) a post-processing chain to render through. */
  setComposer(composer: FrameComposer | null): void {
    this.composer = composer;
    composer?.setSize(window.innerWidth, window.innerHeight);
  }

  start(): void {
    this.renderer.setAnimationLoop(this.tick);
  }

  /** Pause the frame loop (QA drives subsystems deterministically while stopped). */
  stop(): void {
    this.renderer.setAnimationLoop(null);
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.onResize);
    this.composer?.dispose?.();
    this.renderer.dispose();
  }

  private tick = (timestamp: number): void => {
    this.timer.update(timestamp);
    // Clamp delta so a backgrounded tab does not teleport everything on return.
    const delta = Math.min(this.timer.getDelta(), 0.1);
    const elapsed = this.timer.getElapsed();
    for (const updater of this.updaters) updater(delta, elapsed);
    if (this.composer) this.composer.render(delta);
    else this.renderer.render(this.scene, this.camera);
  };

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.applySize();
  };
}
