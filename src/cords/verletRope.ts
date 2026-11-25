import * as THREE from "three";

export interface RopeOptions {
  segments?: number;
  /** Total rest length of the cord in metres. */
  length?: number;
  gravity?: number;
  damping?: number;
  iterations?: number;
  /** Cords never fall through this Y (the table surface). */
  floorY?: number;
}

/**
 * A tiny position-based (Verlet) cord: a chain of points joined by fixed-length
 * segments, pulled by gravity and stopped by the table. Endpoints can be pinned
 * to a terminal so the cord can be plugged and unplugged.
 */
export class VerletRope {
  readonly points: THREE.Vector3[] = [];
  private readonly prev: THREE.Vector3[] = [];
  private readonly pinned: boolean[] = [];
  private readonly segLen: number;
  private readonly gravity: number;
  private readonly damping: number;
  private readonly iterations: number;
  private readonly floorY: number;

  constructor(start: THREE.Vector3, end: THREE.Vector3, opts: RopeOptions = {}) {
    const segments = Math.max(3, opts.segments ?? 14);
    this.segLen = (opts.length ?? 0.7) / segments;
    this.gravity = opts.gravity ?? 6.5;
    this.damping = opts.damping ?? 0.9;
    this.iterations = opts.iterations ?? 12;
    this.floorY = opts.floorY ?? 0.95;

    for (let i = 0; i <= segments; i += 1) {
      const p = new THREE.Vector3().lerpVectors(start, end, i / segments);
      this.points.push(p);
      this.prev.push(p.clone());
      this.pinned.push(false);
    }
    this.pin(0, start);
    this.pin(this.points.length - 1, end);
  }

  get first(): number {
    return 0;
  }
  get last(): number {
    return this.points.length - 1;
  }

  pin(index: number, position: THREE.Vector3): void {
    this.pinned[index] = true;
    this.points[index].copy(position);
    this.prev[index].copy(position);
  }

  unpin(index: number): void {
    this.pinned[index] = false;
  }

  movePinned(index: number, position: THREE.Vector3): void {
    if (!this.pinned[index]) return;
    this.points[index].copy(position);
  }

  isPinned(index: number): boolean {
    return this.pinned[index];
  }

  update(dt: number, substeps = 2): void {
    const h = Math.min(dt, 1 / 30) / substeps;
    for (let s = 0; s < substeps; s += 1) {
      this.integrate(h);
      for (let k = 0; k < this.iterations; k += 1) this.solve();
    }
  }

  private integrate(h: number): void {
    for (let i = 0; i < this.points.length; i += 1) {
      if (this.pinned[i]) continue;
      const p = this.points[i];
      const prev = this.prev[i];
      const vx = (p.x - prev.x) * this.damping;
      const vy = (p.y - prev.y) * this.damping;
      const vz = (p.z - prev.z) * this.damping;
      prev.copy(p);
      p.x += vx;
      p.y += vy - this.gravity * h * h;
      p.z += vz;
      if (p.y < this.floorY) p.y = this.floorY;
    }
  }

  private solve(): void {
    for (let i = 0; i < this.points.length - 1; i += 1) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dy, dz) || 1e-6;
      const diff = (dist - this.segLen) / dist;
      const pinA = this.pinned[i];
      const pinB = this.pinned[i + 1];
      if (pinA && pinB) continue;
      if (pinA) {
        b.x -= dx * diff;
        b.y -= dy * diff;
        b.z -= dz * diff;
      } else if (pinB) {
        a.x += dx * diff;
        a.y += dy * diff;
        a.z += dz * diff;
      } else {
        const ox = dx * diff * 0.5;
        const oy = dy * diff * 0.5;
        const oz = dz * diff * 0.5;
        a.x += ox;
        a.y += oy;
        a.z += oz;
        b.x -= ox;
        b.y -= oy;
        b.z -= oz;
      }
      if (a.y < this.floorY) a.y = this.floorY;
      if (b.y < this.floorY) b.y = this.floorY;
    }
  }
}
