import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

export type CameraMode = "orbit" | "transition" | "firstperson";

export interface WalkBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  eyeHeight: number;
}

export interface CameraRigOptions {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLCanvasElement;
  /** Point the overview orbits and the first-person gaze starts at. */
  focus: THREE.Vector3;
  bounds: WalkBounds;
  /** Where the first-person camera comes to rest after the transition. */
  firstPersonPos?: THREE.Vector3;
  onModeChange?: (mode: CameraMode) => void;
  onLockChange?: (locked: boolean) => void;
  /** Called when the browser refuses pointer lock (e.g. inside an iframe/embed). */
  onLockUnavailable?: () => void;
}

interface Tween {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromQuat: THREE.Quaternion;
  toQuat: THREE.Quaternion;
  elapsed: number;
  duration: number;
  onComplete: () => void;
}

const ORBIT_POS = new THREE.Vector3(7.2, 5.4, 8.6);
const TRANSITION_SECONDS = 1.5;
const WALK_SPEED = 1.9;
const RUN_SPEED = 3.8;
const LOOK_SENSITIVITY = 0.0026;
const UP = new THREE.Vector3(0, 1, 0);
const lookEuler = new THREE.Euler(0, 0, 0, "YXZ");
const HALF_PI = Math.PI / 2;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Quaternion that orients a camera at `eye` to look at `target`. */
function quatLookingAt(eye: THREE.Vector3, target: THREE.Vector3): THREE.Quaternion {
  const m = new THREE.Matrix4().lookAt(eye, target, UP);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/**
 * Drives the camera through three phases:
 *  - orbit: bird's-eye overview around the table (OrbitControls)
 *  - transition: a smooth tween between the overview and a first-person pose
 *  - firstperson: pointer-lock mouse-look plus WASD walking (PointerLockControls)
 */
export class CameraRig {
  mode: CameraMode = "orbit";

  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLCanvasElement;
  private readonly focus: THREE.Vector3;
  private readonly firstPersonPos: THREE.Vector3;
  private readonly bounds: WalkBounds;
  private readonly onModeChange?: (mode: CameraMode) => void;
  private readonly onLockChange?: (locked: boolean) => void;
  private readonly onLockUnavailable?: () => void;

  private readonly orbit: OrbitControls;
  private fp: PointerLockControls | null = null;
  private tween: Tween | null = null;
  private readonly keys = new Set<string>();

  /** Drag-to-look fallback, used only when the pointer is not locked. */
  private lookDrag = false;
  private readonly dragLast = new THREE.Vector2();
  /** Host hook: returns true while another tool (the wiring tool) owns the drag. */
  isOtherDragging: () => boolean = () => false;

  constructor(opts: CameraRigOptions) {
    this.camera = opts.camera;
    this.domElement = opts.domElement;
    this.focus = opts.focus.clone();
    this.firstPersonPos = (
      opts.firstPersonPos ?? new THREE.Vector3(0.75, opts.bounds.eyeHeight, 2.05)
    ).clone();
    this.bounds = opts.bounds;
    this.onModeChange = opts.onModeChange;
    this.onLockChange = opts.onLockChange;
    this.onLockUnavailable = opts.onLockUnavailable;

    this.camera.up.copy(UP);
    this.camera.position.copy(ORBIT_POS);

    this.orbit = new OrbitControls(this.camera, opts.domElement);
    this.orbit.target.copy(this.focus);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.minDistance = 2.5;
    this.orbit.maxDistance = 18;
    this.orbit.maxPolarAngle = Math.PI * 0.49;
    this.orbit.update();

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.domElement.addEventListener("pointerdown", this.onLookPointerDown);
    window.addEventListener("pointermove", this.onLookPointerMove);
    window.addEventListener("pointerup", this.onLookPointerUp);
    document.addEventListener("pointerlockerror", this.onPointerLockError);
  }

  get isLocked(): boolean {
    return this.fp?.isLocked ?? false;
  }

  /** Begin the overview -> first-person transition. */
  enterFirstPerson(): void {
    if (this.mode !== "orbit") return;

    this.orbit.enabled = false;

    // Come to rest at the bench and look down at the kit.
    const toPos = this.firstPersonPos.clone();
    const toQuat = quatLookingAt(toPos, this.focus);

    this.setMode("transition");
    this.tween = {
      fromPos: this.camera.position.clone(),
      toPos,
      fromQuat: this.camera.quaternion.clone(),
      toQuat,
      elapsed: 0,
      duration: TRANSITION_SECONDS,
      onComplete: () => this.activateFirstPerson(),
    };
  }

  /** Tween back out to the overview from first-person. */
  exitToOrbit(): void {
    if (this.mode === "transition") return;

    this.releaseFirstPerson();

    const toPos = ORBIT_POS.clone();
    const toQuat = quatLookingAt(toPos, this.focus);

    this.setMode("transition");
    this.tween = {
      fromPos: this.camera.position.clone(),
      toPos,
      fromQuat: this.camera.quaternion.clone(),
      toQuat,
      elapsed: 0,
      duration: TRANSITION_SECONDS * 0.8,
      onComplete: () => {
        this.orbit.target.copy(this.focus);
        this.orbit.enabled = true;
        this.orbit.update();
        this.setMode("orbit");
      },
    };
  }

  /** Request pointer lock (call from a user gesture such as a click). */
  requestLook(): void {
    if (this.mode !== "firstperson") return;
    try {
      this.fp?.lock();
    } catch {
      // Pointer lock refused (e.g. inside a sandboxed iframe) — the drag-to-look
      // fallback already covers this, so just surface it to the host.
      this.onLockUnavailable?.();
    }
  }

  update(delta: number): void {
    switch (this.mode) {
      case "orbit":
        this.orbit.update(delta);
        break;
      case "transition":
        this.advanceTween(delta);
        break;
      case "firstperson":
        this.syncLockState();
        this.updateWalk(delta);
        break;
    }
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.domElement.removeEventListener("pointerdown", this.onLookPointerDown);
    window.removeEventListener("pointermove", this.onLookPointerMove);
    window.removeEventListener("pointerup", this.onLookPointerUp);
    document.removeEventListener("pointerlockerror", this.onPointerLockError);
    this.releaseFirstPerson();
    this.orbit.dispose();
  }

  private activateFirstPerson(): void {
    const fp = new PointerLockControls(this.camera, this.domElement);
    fp.pointerSpeed = 0.9;
    fp.addEventListener("lock", () => this.onLockChange?.(true));
    fp.addEventListener("unlock", () => this.onLockChange?.(false));
    this.fp = fp;
    this.setMode("firstperson");
  }

  /**
   * Some browsers/embeds release the pointer lock without dispatching `unlock`
   * (or reject the request in a non-lockable root). Reconcile our state with the
   * document each frame so the HUD never gets stuck in the "looking" state.
   */
  private syncLockState(): void {
    const fp = this.fp;
    if (fp && fp.isLocked && document.pointerLockElement !== this.domElement) {
      fp.isLocked = false;
      this.onLockChange?.(false);
    }
  }

  private releaseFirstPerson(): void {
    if (this.fp) {
      this.fp.unlock();
      this.fp.dispose();
      this.fp = null;
    }
    this.keys.clear();
  }

  private updateWalk(delta: number): void {
    const fp = this.fp;
    if (!fp) return;

    let forward = 0;
    let right = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) forward += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) forward -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) right += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) right -= 1;
    if (forward === 0 && right === 0) return;

    const length = Math.hypot(forward, right);
    const speed =
      this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? RUN_SPEED : WALK_SPEED;
    const step = (speed * delta) / length;

    fp.moveForward(forward * step);
    fp.moveRight(right * step);
    this.clampToRoom();
  }

  /**
   * Rotate the first-person camera by a screen-space delta. This is the fallback
   * look control so the lab is still explorable when pointer lock is unavailable
   * (e.g. inside an iframe/embed). It is ignored once the pointer is locked,
   * because then PointerLockControls drives the camera.
   */
  lookBy(dx: number, dy: number): void {
    if (this.isLocked) return;
    lookEuler.setFromQuaternion(this.camera.quaternion);
    lookEuler.y -= dx * LOOK_SENSITIVITY;
    lookEuler.x -= dy * LOOK_SENSITIVITY;
    lookEuler.x = THREE.MathUtils.clamp(lookEuler.x, -HALF_PI + 0.02, HALF_PI - 0.02);
    this.camera.quaternion.setFromEuler(lookEuler);
  }

  private onLookPointerDown = (event: PointerEvent): void => {
    if (this.mode !== "firstperson" || this.isLocked || event.button !== 0) return;
    this.lookDrag = true;
    this.dragLast.set(event.clientX, event.clientY);
  };

  private onLookPointerMove = (event: PointerEvent): void => {
    if (!this.lookDrag || this.isLocked) return;
    const dx = event.clientX - this.dragLast.x;
    const dy = event.clientY - this.dragLast.y;
    this.dragLast.set(event.clientX, event.clientY);
    if (this.isOtherDragging()) return; // e.g. the wiring tool owns this drag
    this.lookBy(dx, dy);
  };

  private onLookPointerUp = (): void => {
    this.lookDrag = false;
  };

  private onPointerLockError = (): void => {
    this.onLockUnavailable?.();
  };

  private clampToRoom(): void {
    const p = this.camera.position;
    p.x = THREE.MathUtils.clamp(p.x, this.bounds.minX, this.bounds.maxX);
    p.z = THREE.MathUtils.clamp(p.z, this.bounds.minZ, this.bounds.maxZ);
    p.y = this.bounds.eyeHeight;
  }

  private advanceTween(delta: number): void {
    const tween = this.tween;
    if (!tween) return;

    tween.elapsed += delta;
    const k = Math.min(tween.elapsed / tween.duration, 1);
    const e = easeInOutCubic(k);

    this.camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
    this.camera.quaternion.slerpQuaternions(tween.fromQuat, tween.toQuat, e);

    if (k >= 1) {
      const done = tween.onComplete;
      this.tween = null;
      done();
    }
  }

  private setMode(mode: CameraMode): void {
    this.mode = mode;
    this.onModeChange?.(mode);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };
}

