import * as THREE from "three";

export interface RoomSize {
  width: number;
  depth: number;
  height: number;
}

export interface Lighting {
  sun: THREE.DirectionalLight;
  hemisphere: THREE.HemisphereLight;
}

/**
 * Room lighting: a warm hemisphere for ambient fill, a "sun" coming through the
 * windows that casts the only shadows in the scene, plus soft point lights that
 * live on the tube-light fixtures (added by the room builder).
 *
 * Walls are built with castShadow disabled, so the directional sun still lights
 * the interior instead of being blocked by the shell geometry.
 */
export function createLighting(scene: THREE.Scene, room: RoomSize): Lighting {
  // Hemisphere is the analytic "ambient" fill; the PMREM environment (§5e) now
  // supplies most of the sky/ground bounce, so this is trimmed to keep the
  // interior from double-filling.
  const hemisphere = new THREE.HemisphereLight(0xfff4e2, 0x6b4a2b, 0.4);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xfff0d0, 1.7);
  sun.position.set(-6, room.height + 3.5, -7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);

  const extent = Math.max(room.width, room.depth) * 0.7;
  sun.shadow.camera.left = -extent;
  sun.shadow.camera.right = extent;
  sun.shadow.camera.top = extent;
  sun.shadow.camera.bottom = -extent;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;

  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0, 0.9, 0);

  return { sun, hemisphere };
}
