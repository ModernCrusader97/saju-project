import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAJU, wrapSeconds, loopOffset, loopVelocity, atlasTexelUV,
  sampleScalarAtlas, masksFromField, evaluateJadeFlow, gltfLocalToGenerated,
} from '../saju-jade-flow.mjs';

const N = 128, WIDTH = 2048, HEIGHT = 1024;
const MIN = [-0.2, -0.05, -0.3], MAX = [1.2, 1.2, 1.1];
const near = (a, b, eps = 1e-10) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const vectorNear = (a, b, eps) => a.forEach((value, axis) => near(value, b[axis], eps));
const position = (u) => u.map((v, i) => MIN[i] + (MAX[i] - MIN[i]) * v);
const idx = (x, y, z) => ((Math.floor(z / 16) * N + y) * WIDTH + (z % 16) * N + x);
// A known affine field: exact trilinear reconstruction apart from Float32 rounding.
const fixture = new Float32Array(WIDTH * HEIGHT);
for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  fixture[idx(x, y, z)] = 0.1 + 0.2 * x / 127 + 0.25 * y / 127 + 0.4 * z / 127;
}

test('pins the immutable six-second, 128-cubed atlas and emission contract', () => {
  assert.equal(SAJU.loopSeconds, 6);
  assert.equal(SAJU.atlas.gridSize, 128);
  assert.deepEqual([SAJU.atlas.columns, SAJU.atlas.rows, SAJU.atlas.width, SAJU.atlas.height], [16, 8, 2048, 1024]);
  assert.deepEqual(SAJU.atlas.domainMin, MIN);
  assert.deepEqual(SAJU.atlas.domainMax, MAX);
  assert.deepEqual(SAJU.emission.linearRGB, [0.001, 0.65, 0.08]);
  assert.equal(SAJU.emission.strength, 2);
  assert.ok(Object.isFrozen(SAJU.atlas.domainMin));
});

test('loop has zero origin, exact endpoint, negative wrapping and analytic quarter phase', () => {
  assert.deepEqual(loopOffset(0), [0, 0, 0]);
  assert.deepEqual(loopOffset(6), loopOffset(0));
  vectorNear(loopOffset(1.5), [0.14, 0.055, 0.14 * (0.5 - Math.sqrt(3) / 2)]);
  vectorNear(loopOffset(-0.25), loopOffset(5.75));
  assert.equal(wrapSeconds(-1), 5);
  assert.equal(wrapSeconds(6000001), 1);
});

test('analytic derivative and one-sided seam derivatives agree', () => {
  vectorNear(loopVelocity(0), [0.14 * Math.PI / 3, 0, 0.07 * Math.PI / 3]);
  vectorNear(loopVelocity(6), loopVelocity(0));
  const h = 1e-5, a = loopOffset(6 - h), b = loopOffset(h);
  vectorNear(a.map(v => -v / h), loopVelocity(0), 2e-6);
  vectorNear(b.map(v => v / h), loopVelocity(0), 2e-6);
});

test('loop values are finite and bounded for finite time; non-finite input is rejected', () => {
  for (let t = -60; t < 60; t += 0.037) {
    const p = loopOffset(t);
    assert.ok(p.every(Number.isFinite));
    assert.ok(Math.abs(p[0]) <= 0.140000001);
    assert.ok(p[1] >= -1e-12 && p[1] <= 0.110000001);
    assert.ok(p[2] >= -0.14 * (1 + Math.sqrt(3) / 2) - 1e-12 && p[2] <= 0.14 * (1 - Math.sqrt(3) / 2) + 1e-12);
  }
  for (const t of [NaN, Infinity, -Infinity, '1']) assert.throws(() => loopOffset(t), /finite/);
});

test('texel centers span endpoints and z-tile boundaries without bleeding', () => {
  vectorNear(atlasTexelUV(0, 0, 0), [0.5 / WIDTH, 0.5 / HEIGHT]);
  vectorNear(atlasTexelUV(127, 127, 15), [2047.5 / WIDTH, 127.5 / HEIGHT]);
  vectorNear(atlasTexelUV(0, 0, 16), [0.5 / WIDTH, 128.5 / HEIGHT]);
  vectorNear(atlasTexelUV(127, 127, 127), [2047.5 / WIDTH, 1023.5 / HEIGHT]);
  vectorNear(atlasTexelUV(0, 0, 16, true), [0.5 / WIDTH, 1 - 128.5 / HEIGHT]);
  assert.throws(() => atlasTexelUV(128, 0, 0), /integer/);
  assert.throws(() => atlasTexelUV(0, 0, 0.5), /integer/);
});

test('CPU trilinear sampler reconstructs an affine field, including inter-tile z interpolation', () => {
  for (const u of [[0, 0, 0], [1, 1, 1], [0.38, 0.21, 0.67], [0.95, 0.05, 15.5 / 127], [0.09, 0.92, 111.5 / 127]]) {
    near(sampleScalarAtlas(fixture, position(u)), 0.1 + 0.2 * u[0] + 0.25 * u[1] + 0.4 * u[2], 6e-8);
  }
});

test('sampler clamps each axis to its domain boundary', () => {
  near(sampleScalarAtlas(fixture, [-100, -100, -100]), 0.1, 1e-7);
  near(sampleScalarAtlas(fixture, [100, 100, 100]), 0.95, 1e-7);
  near(sampleScalarAtlas(fixture, position([-1, 0.5, 2])), 0.625, 1e-7);
});

test('uint16 atlas values are normalized once; malformed atlas and inputs reject', () => {
  const atlas16 = Uint16Array.from(fixture, value => Math.round(value * 65535));
  near(sampleScalarAtlas(atlas16, position([0.2, 0.3, 0.4])), 0.375, 1 / 65535);
  assert.throws(() => sampleScalarAtlas(new Float32Array(4), [0, 0, 0]), /atlas/);
  assert.throws(() => sampleScalarAtlas(fixture, [NaN, 0, 0]), /finite/);
  assert.throws(() => sampleScalarAtlas(fixture, [0, 0]), /three/);
});

test('emission and BRDF-isolation masks use their separate fixed ramps', () => {
  assert.deepEqual(masksFromField(0.38), { emissionMask: 0, isolationMask: 0, reflectiveFraction: 1 });
  const middle = masksFromField(0.52);
  near(middle.isolationMask, 0.5);
  near(middle.emissionMask, 0.02 / 0.22);
  near(middle.reflectiveFraction, 0.5);
  assert.deepEqual(masksFromField(0.72), { emissionMask: 1, isolationMask: 1, reflectiveFraction: 0 });
});

test('both masks travel through one field offset; output is spatial, not a global brightness multiplier', () => {
  const a = position([0.5, 0.5, 0.5]), b = position([0.5, 0.5, 0.7]);
  const a0 = evaluateJadeFlow(fixture, a, 0), a1 = evaluateJadeFlow(fixture, a, 1.5);
  const b0 = evaluateJadeFlow(fixture, b, 0), b1 = evaluateJadeFlow(fixture, b, 1.5);
  assert.notEqual(a0.emissionMask, b0.emissionMask);
  assert.ok(Math.abs(a1.emissionMask / a0.emissionMask - b1.emissionMask / b0.emissionMask) > 0.01);
  const shifted = a.map((p, i) => p + loopOffset(1.5)[i]);
  near(a1.field, sampleScalarAtlas(fixture, shifted));
  assert.deepEqual(a1.baseSourcePosition, a);
  assert.deepEqual(a0.baseSourcePosition, a1.baseSourcePosition);
  assert.deepEqual(a1.fieldSourcePosition, shifted);
  assert.deepEqual(masksFromField(a1.field), {
    emissionMask: a1.emissionMask, isolationMask: a1.isolationMask, reflectiveFraction: a1.reflectiveFraction,
  });
  vectorNear(a1.emissionRadiance, [0.001, 0.65, 0.08].map(v => v * 2 * a1.emissionMask));
  assert.deepEqual(evaluateJadeFlow(fixture, a, 6), a0);
});

// Final source metadata, not an assumed generic glTF axis convention.
test('verified body-local adapter maps source texspace extrema and center correctly', () => {
  const center = [0.000006973743438720703, -0.000013902783393859863, 1.1804927587509155];
  const half = [0.877256453037262, 0.4755038022994995, 1.1923989057540894];
  const toGLTF = ([x, y, z]) => [x, z, -y];
  vectorNear(gltfLocalToGenerated(toGLTF(center)), [0.5, 0.5, 0.5]);
  vectorNear(gltfLocalToGenerated(toGLTF(center.map((v, i) => v - half[i]))), [0, 0, 0]);
  vectorNear(gltfLocalToGenerated(toGLTF(center.map((v, i) => v + half[i]))), [1, 1, 1]);
  assert.throws(() => gltfLocalToGenerated([0, Infinity, 0]), /finite/);
});
