/** SaJu jade moving-light reference, v001. Pure ESM; no engine or DOM dependency. */
export const SAJU = Object.freeze({
  loopSeconds: 6,
  atlas: Object.freeze({
    gridSize: 128, columns: 16, rows: 8, width: 2048, height: 1024,
    domainMin: Object.freeze([-0.2, -0.05, -0.3]),
    domainMax: Object.freeze([1.2, 1.2, 1.1]),
    // Logical image row zero is y-min of the first z-tile row.
    scalarColorSpace: 'linear/non-color',
  }),
  emission: Object.freeze({
    thresholds: Object.freeze([0.50, 0.72]),
    linearRGB: Object.freeze([0.001, 0.65, 0.08]), strength: 2,
  }),
  isolationThresholds: Object.freeze([0.38, 0.66]),
  sourceBody: Object.freeze({
    texspaceCenter: Object.freeze([0.000006973743438720703, -0.000013902783393859863, 1.1804927587509155]),
    texspaceHalfSize: Object.freeze([0.877256453037262, 0.4755038022994995, 1.1923989057540894]),
    canonicalBlenderFromGLTFLocal: '(x, -z, y)',
  }),
});

const TAU = 2 * Math.PI;
const PHASE_Z = Math.PI / 3;
const clamp01 = value => Math.max(0, Math.min(1, value));
const mix = (a, b, t) => a * (1 - t) + b * t;
function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}
function point3(position) {
  if (!position || position.length !== 3) throw new TypeError('position must have three coordinates');
  return Array.from(position, (value, i) => finite(value, `position[${i}]`));
}

/** Positive modulo. Upload this small value, rather than an epoch timestamp, to a GPU. */
export function wrapSeconds(seconds) {
  const remainder = finite(seconds, 'seconds') % SAJU.loopSeconds;
  return remainder === 0 ? 0 : remainder < 0 ? remainder + SAJU.loopSeconds : remainder;
}

/** Canonical Generated-coordinate field translation; never apply to base-color UVs. */
export function loopOffset(seconds) {
  const tau = TAU * wrapSeconds(seconds) / SAJU.loopSeconds;
  return [
    0.14 * Math.sin(tau),
    0.055 * (1 - Math.cos(tau)),
    0.14 * (Math.sin(tau + PHASE_Z) - Math.sin(PHASE_Z)),
  ];
}

/** Analytic derivative in canonical coordinate units per second. */
export function loopVelocity(seconds) {
  const tau = TAU * wrapSeconds(seconds) / SAJU.loopSeconds;
  const speed = TAU / SAJU.loopSeconds;
  return [0.14 * speed * Math.cos(tau), 0.055 * speed * Math.sin(tau), 0.14 * speed * Math.cos(tau + PHASE_Z)];
}

/** Exact normalized texture-center UV for an integer 128-cubed grid sample. */
export function atlasTexelUV(x, y, z, flipV = false) {
  for (const value of [x, y, z]) {
    if (!Number.isInteger(value) || value < 0 || value > 127) throw new RangeError('atlas grid index must be an integer in [0, 127]');
  }
  const u = ((z % 16) * 128 + x + 0.5) / 2048;
  const v = (Math.floor(z / 16) * 128 + y + 0.5) / 1024;
  return [u, flipV ? 1 - v : v];
}

/**
 * Trilinear reference sampler. Scalar row-major atlas only, no interleaved RGBA.
 * Uint16Array holds unnormalized values; Float32/Float64Array holds linear scalars.
 * Decode raw little-endian bytes before calling. This function does not decode PNG.
 */
export function sampleScalarAtlas(data, canonicalFieldPosition) {
  const isUint16 = data instanceof Uint16Array;
  if (!(isUint16 || data instanceof Float32Array || data instanceof Float64Array) || data.length !== 2048 * 1024) {
    throw new TypeError('atlas must be a 2048 × 1024 Uint16Array, Float32Array, or Float64Array');
  }
  const p = point3(canonicalFieldPosition);
  const grid = p.map((value, i) => 127 * clamp01((value - SAJU.atlas.domainMin[i]) / (SAJU.atlas.domainMax[i] - SAJU.atlas.domainMin[i])));
  const low = grid.map(Math.floor), high = low.map(value => Math.min(value + 1, 127));
  const fraction = grid.map((value, i) => value - low[i]);
  const scale = isUint16 ? 1 / 65535 : 1;
  const read = (x, y, z) => finite(data[(Math.floor(z / 16) * 128 + y) * 2048 + (z % 16) * 128 + x], 'atlas sample') * scale;
  const xy = z => mix(
    mix(read(low[0], low[1], z), read(high[0], low[1], z), fraction[0]),
    mix(read(low[0], high[1], z), read(high[0], high[1], z), fraction[0]),
    fraction[1],
  );
  return mix(xy(low[2]), xy(high[2]), fraction[2]);
}

/** Two different ramps, both driven by the same moving scalar field. */
export function masksFromField(field) {
  finite(field, 'field');
  const emissionMask = clamp01((field - 0.50) / (0.72 - 0.50));
  const s = clamp01((field - 0.38) / (0.66 - 0.38));
  const isolationMask = s * s * (3 - 2 * s);
  return { emissionMask, isolationMask, reflectiveFraction: 1 - isolationMask };
}

/**
 * Accept an already-normalized canonical source position, not glTF/world position.
 * Derive its adapter from the final mesh texspace and verified export transform.
 * This function deliberately never samples/modifies the original jade base texture.
 */
export function evaluateJadeFlow(data, canonicalSourcePosition, seconds) {
  const baseSourcePosition = point3(canonicalSourcePosition);
  const offset = loopOffset(seconds);
  const fieldSourcePosition = baseSourcePosition.map((value, i) => value + offset[i]);
  const field = sampleScalarAtlas(data, fieldSourcePosition);
  const masks = masksFromField(field);
  return {
    baseSourcePosition, fieldSourcePosition, field, ...masks,
    emissionRadiance: SAJU.emission.linearRGB.map(value => value * SAJU.emission.strength * masks.emissionMask),
  };
}

/**
 * Verified adapter ONLY for this v001 body export's undeformed mesh-local POSITION.
 * Blender=(glTF.x, -glTF.z, glTF.y). Do not feed world-space or skinned positions.
 * Revalidate if an importer/exporter recenters, rescales or bakes node transforms.
 */
export function gltfLocalToGenerated(gltfLocalPosition) {
  const [x, y, z] = point3(gltfLocalPosition);
  return [x, -z, y].map((value, i) =>
    0.5 + (value - SAJU.sourceBody.texspaceCenter[i]) / (2 * SAJU.sourceBody.texspaceHalfSize[i]));
}
