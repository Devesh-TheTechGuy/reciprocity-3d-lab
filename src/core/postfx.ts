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
  readonly composer: EffectComposer;
  readonly ssao: SSAOPass;
  readonly bloom: UnrealBloomPass;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private enabled = true;

  constructor(opts: PostFxOptions) {
    const { renderer, scene, camera } = opts;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const samples = opts.samples ?? 4;
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      ...(samples > 0 ? { samples } : {}),
    });

    this.composer = new EffectComposer(renderer, target);
    // The composer was seeded with a physical-pixel target; normalise it to
    // logical size * pixel ratio so `addPass` / `setSize` stay consistent.
    this.composer.setSize(window.innerWidth, window.innerHeight);

    this.composer.addPass(new RenderPass(scene, camera));

    // AO must follow the RenderPass: in "Default" mode SSAO multiplies its
    // occlusion over whatever already sits in the read buffer.
    this.ssao = new SSAOPass(scene, camera, size.x, size.y);
    // The scene is metre-scale, so the default kernel radius (8 world units) is
    // enormous; keep it small so AO reads as contact shadow in creases.
    this.ssao.kernelRadius = 0.12;
    this.ssao.minDistance = 0.0008;
    this.ssao.maxDistance = 0.045;
    this.ssao.output = SSAOPass.OUTPUT.Default;
    this.composer.addPass(this.ssao);

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      opts.bloomStrength ?? 0.35,
      opts.bloomRadius ?? 0.5,
      opts.bloomThreshold ?? 1.6,
    );
    this.composer.addPass(this.bloom);

    this.composer.addPass(new OutputPass());
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Toggle the whole chain; when off the engine's plain render is used instead. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
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
