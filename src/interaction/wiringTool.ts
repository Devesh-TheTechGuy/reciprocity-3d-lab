import * as THREE from "three";
import type { Terminal } from "../kit/terminal";
import { createPatchCord, type CordSide, type PatchCord } from "../kit/patchCord";
import type { WiringState } from "../state/wiring";

const GRAB_RADIUS = 0.1;
const SNAP_RADIUS = 0.17;

export interface WiringToolOptions {
  camera: THREE.Camera;
  scene: THREE.Scene;
  domElement: HTMLElement;
  terminals: Terminal[];
  wiring: WiringState;
  floorY: number;
  onHover?: (terminal: Terminal | null) => void;
  onConnect?: (a: string, b: string) => void;
  onDisconnect?: (terminalId: string) => void;
  /** Only allow wiring while this returns true (e.g. first-person mode). */
  isActive?: () => boolean;
}

interface DragState {
  cord: PatchCord;
  side: CordSide;
  /** Terminal the other end is plugged into (null if free). */
  otherTerminal: string | null;
  isNew: boolean;
}

/**
 * First-person wiring: aim the crosshair at a brass terminal to grab/pick up a
 * patch cord, drag it, and release near another terminal to snap and connect.
 */
export class WiringTool {
  private readonly opts: WiringToolOptions;
  private readonly raycaster = new THREE.Raycaster();
  private readonly group = new THREE.Group();
  private readonly byId = new Map<string, Terminal>();
  private readonly highlight = new Map<string, THREE.Mesh>();
  private readonly cords: PatchCord[] = [];
  private readonly plane: THREE.Plane;
  private readonly ndc = new THREE.Vector2();
  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private hovered: Terminal | null = null;
  private drag: DragState | null = null;
  private colorIndex = 0;
  private readonly palette = [0xd23b3b, 0x17171a, 0xd23b3b, 0x17171a, 0x2f6fd0, 0x17171a];

  constructor(opts: WiringToolOptions) {
    this.opts = opts;
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -opts.floorY);
    this.group.name = "patch-cords";
    opts.scene.add(this.group);

    for (const t of opts.terminals) {
      this.byId.set(t.id, t);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.032, 0.006, 8, 22),
        new THREE.MeshBasicMaterial({ color: 0x3ee06a, toneMapped: false }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.072;
      ring.visible = false;
      t.object.add(ring);
      this.highlight.set(t.id, ring);
    }

    opts.domElement.addEventListener("pointermove", this.onPointerMove);
    opts.domElement.addEventListener("pointerdown", this.onPointerDown);
    opts.domElement.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("pointerup", this.onPointerUp);
  }

  private isActive(): boolean {
    return this.opts.isActive ? this.opts.isActive() : true;
  }

  private rayFromEvent(ev: PointerEvent | MouseEvent): THREE.Ray {
    const el = this.opts.domElement;
    if (document.pointerLockElement === el) {
      this.ndc.set(0, 0);
    } else {
      const rect = el.getBoundingClientRect();
      this.ndc.set(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1,
      );
    }
    this.raycaster.setFromCamera(this.ndc, this.opts.camera);
    return this.raycaster.ray;
  }

  /** Nearest terminal to the aim ray within `radius` — used for grab, hover and snap. */
  private nearestTerminal(ray: THREE.Ray, radius: number): Terminal | null {
    let best: Terminal | null = null;
    let bestDist = radius;
    for (const t of this.byId.values()) {
      const p = t.worldPosition(this.v1);
      const along = this.v2.subVectors(p, ray.origin).dot(ray.direction);
      if (along <= 0) continue;
      const closest = this.v2.copy(ray.origin).addScaledVector(ray.direction, along);
      const d = closest.distanceTo(p);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  private cursorPoint(ray: THREE.Ray): THREE.Vector3 {
    const p = new THREE.Vector3();
    if (!ray.intersectPlane(this.plane, p)) {
      p.copy(ray.origin).addScaledVector(ray.direction, 0.6);
    }
    p.y = this.opts.floorY;
    return p;
  }

  private setHovered(t: Terminal | null): void {
    if (t === this.hovered) return;
    if (this.hovered) this.highlight.get(this.hovered.id)!.visible = false;
    this.hovered = t;
    if (t) this.highlight.get(t.id)!.visible = true;
    this.opts.onHover?.(t);
  }

  private nextColor(): number {
    const c = this.palette[this.colorIndex % this.palette.length];
    this.colorIndex += 1;
    return c;
  }

  private onPointerMove = (ev: PointerEvent): void => {
    if (!this.isActive()) {
      this.setHovered(null);
      return;
    }
    const ray = this.rayFromEvent(ev);
    if (this.drag) {
      const target = this.nearestTerminal(ray, SNAP_RADIUS);
      const dest = target ? target.worldPosition(new THREE.Vector3()) : this.cursorPoint(ray);
      this.drag.cord.rope.movePinned(
        this.drag.side === "a" ? this.drag.cord.rope.first : this.drag.cord.rope.last,
        dest,
      );
      this.setHovered(target);
      return;
    }
    this.setHovered(this.nearestTerminal(ray, GRAB_RADIUS));
  };

  private onContextMenu = (ev: Event): void => {
    if (this.isActive()) ev.preventDefault();
  };

  private onPointerDown = (ev: PointerEvent): void => {
    if (!this.isActive() || this.drag) return;
    const ray = this.rayFromEvent(ev);

    // Right-click: unplug whatever cord is on this terminal.
    if (ev.button === 2) {
      const hit = this.nearestTerminal(ray, GRAB_RADIUS);
      if (!hit) return;
      ev.preventDefault();
      const cord = this.cords.find((c) => c.plugged.a === hit.id || c.plugged.b === hit.id);
      if (!cord) return;
      const side: CordSide = cord.plugged.a === hit.id ? "a" : "b";
      const other = cord.plugged[side === "a" ? "b" : "a"];
      cord.unpinEnd(side);
      if (other) {
        const conn = this.opts.wiring.find(hit.id, other);
        if (conn) this.opts.wiring.remove(conn.id);
      }
      this.opts.onDisconnect?.(hit.id);
      if (!cord.plugged.a && !cord.plugged.b) this.removeCord(cord);
      return;
    }

    // Left-click: start a brand-new cord from this terminal.
    if (ev.button !== 0) return;
    const hit = this.nearestTerminal(ray, GRAB_RADIUS);
    if (!hit) return;
    ev.preventDefault();
    const start = hit.worldPosition(new THREE.Vector3());
    const newCord = createPatchCord(this.nextColor(), this.opts.floorY);
    this.group.add(newCord.object);
    newCord.pinEnd("a", start, hit.id);
    newCord.pinEnd("b", start.clone().add(new THREE.Vector3(0.16, 0.1, 0.08)), null);
    this.cords.push(newCord);
    this.drag = { cord: newCord, side: "b", otherTerminal: hit.id, isNew: true };
  };

  private onPointerUp = (ev: PointerEvent): void => {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    const target = this.nearestTerminal(this.rayFromEvent(ev), SNAP_RADIUS);

    if (target && target.id !== drag.otherTerminal) {
      drag.cord.pinEnd(drag.side, target.worldPosition(new THREE.Vector3()), target.id);
      if (drag.otherTerminal) {
        this.opts.wiring.add(drag.otherTerminal, target.id);
        this.opts.onConnect?.(drag.otherTerminal, target.id);
      }
    } else if (drag.isNew) {
      this.removeCord(drag.cord);
    } else {
      drag.cord.unpinEnd(drag.side);
    }
    this.setHovered(null);
  };

  private removeCord(cord: PatchCord): void {
    const i = this.cords.indexOf(cord);
    if (i >= 0) this.cords.splice(i, 1);
    this.group.remove(cord.object);
    cord.dispose();
  }

  update(dt: number): void {
    for (const cord of this.cords) cord.update(dt);
  }

  dispose(): void {
    this.opts.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.opts.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.opts.domElement.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("pointerup", this.onPointerUp);
    for (const cord of this.cords) cord.dispose();
  }
}

