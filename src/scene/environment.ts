  import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

export interface EnvironmentOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  /** Equirectangular HDRI (Radiance `.hdr`), served from `public/`. */
  url: string;
  /** Diffuse/specular IBL strength (multiplies `scene.environment`). */
  intensity?: number;
  /** Also show the map as the skybox (blurred), instead of a flat colour. */
  background?: boolean;
  backgroundIntensity?: number;
  backgroundBlurriness?: number;
}

/**
 * Image-based lighting from an equirectangular HDRI.
 *
 * The map is pre-filtered with {@link PMREMGenerator} and assigned to
 * `scene.environment`, so every `MeshStandardMaterial` (walls, brass terminals,
 * meter bodies…) picks up diffuse + specular IBL, while the analytic sun/tube
 * lights keep providing direct light and the scene's shadows.
 *
 * Loading is asynchronous: the scene keeps rendering immediately under the
 * analytic lights and gains the environment as soon as the HDR is decoded.
 */
export class Environment {
  /** PMREM texture, or `null` until the HDR has finished decoding. */
  texture: THREE.Texture | null = null;

  private readonly pmrem: THREE.PMREMGenerator;
  private readonly scene: THREE.Scene;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private disposed = false;

  constructor(opts: EnvironmentOptions) {
    const { renderer, scene, url } = opts;
    this.scene = scene;
    this.pmrem = new THREE.PMREMGenerator(renderer);

    const loader = new HDRLoader();
    loader.load(
      url,
      (hdr) => {
        if (this.disposed) {
          hdr.dispose();
          return;
        }
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        this.envTarget = this.pmrem.fromEquirectangular(hdr);
        this.texture = this.envTarget.texture;

        scene.environment = this.texture;
        scene.environmentIntensity = opts.intensity ?? 1;

        if (opts.background) {
          scene.background = this.texture;
          scene.backgroundIntensity = opts.backgroundIntensity ?? 0.35;
          scene.backgroundBlurriness = opts.backgroundBlurriness ?? 0.5;
        }

        hdr.dispose();
        this.pmrem.dispose();
      },
      undefined,
      (err) => {
        // Non-fatal: keep the analytic lights and the flat background.
        console.warn("Environment HDRI failed to load:", err);
      },
    );
  }

  /** Adjust the IBL contribution of the whole scene. */
  setIntensity(value: number): void {
    this.scene.environmentIntensity = value;
  }

  dispose(): void {
    this.disposed = true;
    this.scene.environment = null;
    this.envTarget?.dispose();
    this.texture = null;
    this.pmrem.dispose();
  }
}
