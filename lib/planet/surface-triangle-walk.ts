import * as THREE from 'three';
import { MeshSurface, type SurfaceAnchor, type MeshSurfaceOptions } from './mesh-surface';

interface Topology {
  triangles: THREE.Triangle[];
  normals: THREE.Vector3[];
  neighbors: number[][];
}
export interface SurfaceWalkOptions {
  /** Direction and distance use the source mesh's unmodified local coordinates. */
  direction: THREE.Vector3;
  length: number;
  maxSteps?: number;
}
export interface SurfaceWalkStats { triangles: number; boundaryEdges: number; ambiguousEdges: number }

/** Crosses real shared triangle edges, including duplicated glTF UV vertices.
 * No nearest-surface projection can jump across an arm, seam or separate part.
 * Optional morph resolution keeps rest-topology paths attached during a wave. */
export class SurfaceTriangleWalker {
  readonly sampler: MeshSurface;
  readonly stats: SurfaceWalkStats = { triangles: 0, boundaryEdges: 0, ambiguousEdges: 0 };
  private topology = new Map<THREE.Mesh, Topology>();
  private lengths = new WeakMap<SurfaceAnchor[], Float64Array>();

  constructor(meshes: THREE.Mesh[], options: MeshSurfaceOptions = {}) {
    this.sampler = new MeshSurface(meshes, options);
    for (const mesh of meshes) {
      const positions = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
      const count = Math.floor((index?.count ?? positions.count) / 3);
      const welded = new Map<string, number>(), vertices: number[] = [];
      for (let i = 0; i < positions.count; i++) {
        // GLB FLOAT positions at a UV split are identical. Quantization also
        // accommodates export rounding far below the smallest visible detail.
        const key = [positions.getX(i), positions.getY(i), positions.getZ(i)]
          .map(value => Math.round(value * 1e6)).join(',');
        if (!welded.has(key)) welded.set(key, welded.size);
        vertices[i] = welded.get(key)!;
      }
      const triangles: THREE.Triangle[] = [], normals: THREE.Vector3[] = [];
      const neighbors = Array.from({ length: count }, () => [-1, -1, -1]);
      const edges = new Map<string, Array<{ face: number; opposite: number }>>();
      for (let face = 0; face < count; face++) {
        const ids = [0, 1, 2].map(i => index ? index.getX(face * 3 + i) : face * 3 + i);
        const points = ids.map(i => new THREE.Vector3().fromBufferAttribute(positions, i));
        const triangle = new THREE.Triangle(points[0], points[1], points[2]);
        triangles.push(triangle); normals.push(triangle.getNormal(new THREE.Vector3()));
        if (triangle.getArea() < 1e-14) continue;
        this.stats.triangles++;
        for (let opposite = 0; opposite < 3; opposite++) {
          const a = vertices[ids[(opposite + 1) % 3]], b = vertices[ids[(opposite + 2) % 3]];
          if (a === b) continue;
          const key = a < b ? `${a}:${b}` : `${b}:${a}`;
          const entries = edges.get(key) ?? [];
          entries.push({ face, opposite }); edges.set(key, entries);
        }
      }
      for (const entries of edges.values()) {
        if (entries.length !== 2) {
          // Non-manifold intersections cannot provide an unambiguous crawl.
          // Stop instead of choosing another character component arbitrarily.
          if (entries.length === 1) this.stats.boundaryEdges++;
          else this.stats.ambiguousEdges++;
          continue;
        }
        const [a, b] = entries;
        neighbors[a.face][a.opposite] = b.face;
        neighbors[b.face][b.opposite] = a.face;
      }
      this.topology.set(mesh, { triangles, normals, neighbors });
    }
  }

  /** Records both sides of each crossed edge. Consecutive nonzero-distance
   * segments always belong to one triangle, allowing exact barycentric motion. */
  path(anchor: SurfaceAnchor, options: SurfaceWalkOptions): SurfaceAnchor[] {
    if (!Number.isFinite(options.length) || options.length < 0 ||
      ![options.direction.x, options.direction.y, options.direction.z].every(Number.isFinite)) {
      throw new RangeError('Surface walk requires finite direction and nonnegative length.');
    }
    const data = this.topology.get(anchor.mesh);
    if (!data || !data.triangles[anchor.triangle]) throw new Error('Anchor is outside this surface.');
    const result = [this.copy(anchor)];
    let face = anchor.triangle, barycentric = anchor.barycentric.clone(), remaining = options.length;
    const point = new THREE.Vector3(), wanted = new THREE.Vector3(), direction = new THREE.Vector3();
    const endBarycentric = new THREE.Vector3(), delta = new THREE.Vector3();
    const maxSteps = Math.min(512, Math.max(1, options.maxSteps ?? 192));
    let previousFace = -1;
    for (let step = 0; step < maxSteps && remaining > 1e-9; step++) {
      const triangle = data.triangles[face], normal = data.normals[face];
      point.copy(triangle.a).multiplyScalar(barycentric.x)
        .addScaledVector(triangle.b, barycentric.y).addScaledVector(triangle.c, barycentric.z);
      direction.copy(options.direction).addScaledVector(normal, -options.direction.dot(normal));
      if (direction.lengthSq() < 1e-12) break;
      direction.normalize(); wanted.copy(point).addScaledVector(direction, remaining);
      if (!triangle.getBarycoord(wanted, endBarycentric)) break;
      delta.copy(endBarycentric).sub(barycentric).divideScalar(remaining);
      let travel = remaining, opposite = -1;
      for (let component = 0; component < 3; component++) {
        const slope = delta.getComponent(component);
        if (slope >= -1e-12) continue;
        const distance = -barycentric.getComponent(component) / slope;
        if (distance >= -1e-8 && distance < travel) {
          travel = Math.max(0, distance); opposite = component;
        }
      }
      barycentric.addScaledVector(delta, travel);
      this.normalizeBarycentric(barycentric);
      const end = { mesh: anchor.mesh, triangle: face, barycentric: barycentric.clone() };
      if (travel > 1e-9) result.push(end);
      remaining -= travel;
      if (opposite < 0 || remaining < 1e-9) break;
      const next = data.neighbors[face][opposite];
      if (next < 0 || next === previousFace || data.normals[next].dot(normal) < .15) break;
      // Exact edge position, re-expressed in the next triangle. Avoid a spatial
      // nudge: it would make droplets jump through small concave creases.
      point.copy(triangle.a).multiplyScalar(barycentric.x)
        .addScaledVector(triangle.b, barycentric.y).addScaledVector(triangle.c, barycentric.z);
      const nextBarycentric = data.triangles[next].getBarycoord(point, new THREE.Vector3());
      if (!nextBarycentric) break;
      this.normalizeBarycentric(nextBarycentric);
      previousFace = face; face = next; barycentric = nextBarycentric;
      result.push({ mesh: anchor.mesh, triangle: face, barycentric: barycentric.clone() });
    }
    this.measure(result);
    return result;
  }

  /** Arc-length progress [0,1]; target permits allocation-free per-frame use. */
  interpolate(path: SurfaceAnchor[], progress: number, target?: SurfaceAnchor): SurfaceAnchor {
    if (!path.length || !Number.isFinite(progress)) throw new RangeError('Finite progress and a nonempty path required.');
    const lengths = this.lengths.get(path) ?? this.measure(path);
    const distance = THREE.MathUtils.clamp(progress, 0, 1) * lengths[lengths.length - 1];
    let lo = 0, hi = path.length - 1;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (lengths[mid] < distance) lo = mid + 1; else hi = mid; }
    const b = path[lo], a = path[Math.max(0, lo - 1)];
    const out = target ?? this.copy(a);
    const segment = lengths[lo] - lengths[Math.max(0, lo - 1)];
    if (a.mesh !== b.mesh || a.triangle !== b.triangle || segment < 1e-12) return this.copyInto(b, out);
    out.mesh = a.mesh; out.triangle = a.triangle;
    out.barycentric.copy(a.barycentric).lerp(b.barycentric, (distance - lengths[lo - 1]) / segment);
    return out;
  }

  private measure(path: SurfaceAnchor[]): Float64Array {
    const lengths = new Float64Array(path.length);
    const previous = new THREE.Vector3(), point = new THREE.Vector3();
    path.forEach((anchor, i) => {
      const triangle = this.topology.get(anchor.mesh)!.triangles[anchor.triangle];
      point.copy(triangle.a).multiplyScalar(anchor.barycentric.x)
        .addScaledVector(triangle.b, anchor.barycentric.y).addScaledVector(triangle.c, anchor.barycentric.z);
      lengths[i] = i ? lengths[i - 1] + point.distanceTo(previous) : 0;
      previous.copy(point);
    });
    this.lengths.set(path, lengths); return lengths;
  }
  private copy(anchor: SurfaceAnchor): SurfaceAnchor {
    return { mesh: anchor.mesh, triangle: anchor.triangle, barycentric: anchor.barycentric.clone() };
  }
  private copyInto(anchor: SurfaceAnchor, target: SurfaceAnchor): SurfaceAnchor {
    target.mesh = anchor.mesh; target.triangle = anchor.triangle; target.barycentric.copy(anchor.barycentric); return target;
  }
  private normalizeBarycentric(b: THREE.Vector3): void {
    b.set(Math.max(0, b.x), Math.max(0, b.y), Math.max(0, b.z));
    b.divideScalar(b.x + b.y + b.z);
  }
}
