import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { FrameComposer } from "./engine";

export interface PostFxOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** MSAA sample count for the intermediate buffers (0 disables). */
  samples?: number;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
}

/**
 * Post-processing chain: render -> SSAO -> bloom -> output.
 *
 * three.js applies ACES tone mapping and the sRGB encode only when rendering to
 * the default framebuffer; the composer instead renders into half-float buffers
 * (which stay linear), so a single {@link OutputPass} at the end performs the
 * tone map + colour-space conversion exactly once, reading the renderer's
 * settings. The composer's buffers are separate from the canvas, so plain MSAA
 * (`samples`) is used to keep edges crisp — `renderer.antialias` no longer covers
 * them once compositing.
 */
export class PostFx implements FrameComposer {
  composer!: EffectComposer;
  ssao!: SSAOPass;
  bloom!: UnrealBloomPass;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly bloomParams: { strength: number; radius: number; threshold: number };
  private enabled = true;
  private sampleCount: number;
  private ssaoEnabled = true;
  private bloomEnabled = true;

  constructor(opts: PostFxOptions) {
    const { renderer, scene, camera } = opts;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.sampleCount = opts.samples ?? 4;
    this.bloomParams = {
      strength: opts.bloomStrength ?? 0.35,
      radius: opts.bloomRadius ?? 0.5,
      threshold: opts.bloomThreshold ?? 1.6,
    };
    this.build();
  }

  /** (Re)create the composer + passes for the current `sampleCount`. */
  private build(): void {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      ...(this.sampleCount > 0 ? { samples: this.sampleCount } : {}),
    });

    this.composer = new EffectComposer(this.renderer, target);
    // The composer was seeded with a physical-pixel target; normalise it to
    // logical size * pixel ratio so `addPass` / `setSize` stay consistent.
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(window.innerWidth, window.innerHeight);

    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // AO must follow the RenderPass: in "Default" mode SSAO multiplies its
    // occlusion over whatever already sits in the read buffer.
    this.ssao = new SSAOPass(this.scene, this.camera, size.x, size.y);
    // The scene is metre-scale, so the default kernel radius (8 world units) is
    // enormous; keep it small so AO reads as contact shadow in creases.
    this.ssao.kernelRadius = 0.12;
    this.ssao.minDistance = 0.0008;
    this.ssao.maxDistance = 0.045;
    this.ssao.output = SSAOPass.OUTPUT.Default;
    this.ssao.enabled = this.ssaoEnabled;
    this.composer.addPass(this.ssao);

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      this.bloomParams.strength,
      this.bloomParams.radius,
      this.bloomParams.threshold,
    );
    this.bloom.enabled = this.bloomEnabled;
    this.composer.addPass(this.bloom);

    this.composer.addPass(new OutputPass());
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get samples(): number {
    return this.sampleCount;
  }

  /** Toggle the whole chain; when off the engine's plain render is used instead. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Enable/disable individual passes (a disabled pass costs nothing to render). */
  setPasses({ ssao, bloom }: { ssao: boolean; bloom: boolean }): void {
    this.ssaoEnabled = ssao;
    this.bloomEnabled = bloom;
    this.ssao.enabled = ssao;
    this.bloom.enabled = bloom;
  }

  /**
   * Change the MSAA sample count. The composer allocates its render targets at
   * construction, so the chain is rebuilt; disabled passes are preserved. Kept
   * behind this method so callers (the perf governor) never see the swap.
   */
  setSamples(samples: number): void {
    if (samples === this.sampleCount) return;
    this.sampleCount = samples;
    (this.ssao as { dispose?: () => void }).dispose?.();
    (this.bloom as { dispose?: () => void }).dispose?.();
    this.composer.dispose();
    this.build();
  }

  render(delta: number): void {
    if (this.enabled) {
      this.composer.render(delta);
    } else {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
    }
  }

  setSize(width: number, height: number): void {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
  }

  dispose(): void {
    this.composer.dispose();
  }
}

