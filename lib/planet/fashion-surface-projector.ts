import * as THREE from 'three';
import {skinPoseKey} from './skinned-surface-state';
export interface FashionSurfaceHit { triangle: number; barycentric: THREE.Vector3 }
/** A small XY triangle index for the approved model's front/back support rays.
 * It accelerates the SAME actual-triangle intersection; it never approximates
 * the surface with a sphere, box face or texture. Active morph snapshots rebuild
 * before a new outfit is constructed. Existing supports resolve live vertices. */
export class FashionSurfaceProjector {
  private token = '';
  private vertices = new Float64Array(0);
  private cells: number[][] = [];
  private bounds = new THREE.Box3();
  private readonly columns = 24;
  private readonly rows = 36;
  private readonly ray = new THREE.Ray();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly c = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  constructor(private mesh: THREE.Mesh) {}
  private prepare(): void {
    const geometry = this.mesh.geometry, position = geometry.getAttribute('position'), index = geometry.index;
    const positionVersion = position instanceof THREE.InterleavedBufferAttribute ? position.data.version : position.version;
    const token = `${geometry.uuid}:${positionVersion}:${index?.version ?? 0}:${this.mesh.morphTargetInfluences?.join(',') ?? ''}:${skinPoseKey(this.mesh)}`;
    if (token === this.token) return;
    this.token = token; this.vertices = new Float64Array(position.count * 3); this.bounds.makeEmpty();
    for (let i = 0; i < position.count; i++) { this.mesh.getVertexPosition(i, this.point); this.point.toArray(this.vertices, i * 3); this.bounds.expandByPoint(this.point); }
    this.cells = Array.from({ length: this.columns * this.rows }, () => []);
    const width = this.bounds.max.x - this.bounds.min.x, height = this.bounds.max.y - this.bounds.min.y;
    const column = (x: number) => THREE.MathUtils.clamp(Math.floor((x - this.bounds.min.x) / width * this.columns), 0, this.columns - 1);
    const row = (y: number) => THREE.MathUtils.clamp(Math.floor((y - this.bounds.min.y) / height * this.rows), 0, this.rows - 1);
    const count = index?.count ?? position.count;
    for (let offset = 0; offset + 2 < count; offset += 3) {
      this.a.fromArray(this.vertices, (index ? index.getX(offset) : offset) * 3);
      this.b.fromArray(this.vertices, (index ? index.getX(offset + 1) : offset + 1) * 3);
      this.c.fromArray(this.vertices, (index ? index.getX(offset + 2) : offset + 2) * 3);
      const firstX = column(Math.min(this.a.x, this.b.x, this.c.x)), lastX = column(Math.max(this.a.x, this.b.x, this.c.x));
      const firstY = row(Math.min(this.a.y, this.b.y, this.c.y)), lastY = row(Math.max(this.a.y, this.b.y, this.c.y));
      for (let y = firstY; y <= lastY; y++) for (let x = firstX; x <= lastX; x++) this.cells[y * this.columns + x].push(offset / 3);
    }
  }
  /** Rays are in mesh-local coordinates. Non-axis rays use the caller's
   * normal Three raycaster; those paths must never use an invalid projection. */
  intersect(origin: THREE.Vector3, direction: THREE.Vector3): FashionSurfaceHit | null | undefined {
    if (Math.abs(direction.x) > 1e-8 || Math.abs(direction.y) > 1e-8) return undefined;
    this.prepare();
    if (origin.x < this.bounds.min.x || origin.x > this.bounds.max.x || origin.y < this.bounds.min.y || origin.y > this.bounds.max.y) return null;
    const x = THREE.MathUtils.clamp(Math.floor((origin.x - this.bounds.min.x) / (this.bounds.max.x - this.bounds.min.x) * this.columns), 0, this.columns - 1);
    const y = THREE.MathUtils.clamp(Math.floor((origin.y - this.bounds.min.y) / (this.bounds.max.y - this.bounds.min.y) * this.rows), 0, this.rows - 1);
    const index = this.mesh.geometry.index;
    this.ray.set(origin, direction); let best = Infinity, triangle = -1; const hit = new THREE.Vector3();
    for (const face of this.cells[y * this.columns + x]) {
      const offset = face * 3;
      this.a.fromArray(this.vertices, (index ? index.getX(offset) : offset) * 3);
      this.b.fromArray(this.vertices, (index ? index.getX(offset + 1) : offset + 1) * 3);
      this.c.fromArray(this.vertices, (index ? index.getX(offset + 2) : offset + 2) * 3);
      if (!this.ray.intersectTriangle(this.a, this.b, this.c, false, this.point)) continue;
      const distance = this.point.distanceToSquared(origin); if (distance < best) { best = distance; triangle = face; hit.copy(this.point); }
    }
    if (triangle < 0) return null;
    const offset = triangle * 3;
    this.a.fromArray(this.vertices, (index ? index.getX(offset) : offset) * 3); this.b.fromArray(this.vertices, (index ? index.getX(offset + 1) : offset + 1) * 3); this.c.fromArray(this.vertices, (index ? index.getX(offset + 2) : offset + 2) * 3);
    const barycentric = new THREE.Triangle(this.a, this.b, this.c).getBarycoord(hit, new THREE.Vector3());
    return barycentric ? { triangle, barycentric } : null;
  }
  dispose(): void { this.vertices = new Float64Array(0); this.cells = []; this.token = ''; }
}
