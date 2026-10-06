/** Validate delivered atlas metadata/bytes and report approximation error if native probes exist. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SAJU, sampleScalarAtlas, evaluateJadeFlow, masksFromField } from '../saju-jade-flow.mjs';

const root = new URL('../', import.meta.url);
const metadata = JSON.parse(await readFile(new URL('atlas-metadata.json', root), 'utf8'));
const raw = await readFile(new URL(`textures/${metadata.atlasRaw}`, root));
assert.equal(raw.byteLength, 2048 * 1024 * 2);
assert.equal(createHash('sha256').update(raw).digest('hex'), metadata.raw_sha256);
assert.deepEqual(metadata.domainMin, SAJU.atlas.domainMin);
assert.deepEqual(metadata.domainMax, SAJU.atlas.domainMax);
assert.deepEqual([metadata.dimension, metadata.columns, metadata.rows, metadata.width, metadata.height], [128, 16, 8, 2048, 1024]);
const atlas = new Uint16Array(2048 * 1024);
const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
for (let i = 0; i < atlas.length; i++) atlas[i] = view.getUint16(2 * i, true);
let minimum = Infinity, maximum = -Infinity;
for (const value of atlas) { minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); }
assert.ok(minimum < maximum);
const report = {
  atlasBytes: raw.byteLength, verifiedRawSHA256: metadata.raw_sha256,
  quantizedFieldRange: [minimum / 65535, maximum / 65535],
  samples: 0, finiteSamples: 0, maximumLoopEndpointError: 0,
  animatedMaskSpan: 0, nativeProbeComparison: 'Native probe file is not present yet.',
};
for (const x of [0.1, 0.3, 0.5, 0.7, 0.9]) for (const y of [0.1, 0.3, 0.5, 0.7, 0.9]) for (const z of [0.1, 0.3, 0.5, 0.7, 0.9]) {
  const point = [x, y, z];
  const start = evaluateJadeFlow(atlas, point, 0), end = evaluateJadeFlow(atlas, point, 6);
  report.maximumLoopEndpointError = Math.max(report.maximumLoopEndpointError, Math.abs(start.field - end.field));
  let lo = Infinity, hi = -Infinity;
  for (let frame = 0; frame < 72; frame++) {
    const result = evaluateJadeFlow(atlas, point, frame / 12);
    report.samples++;
    assert.ok([result.field, result.emissionMask, result.isolationMask, ...result.emissionRadiance].every(Number.isFinite));
    report.finiteSamples++;
    lo = Math.min(lo, result.emissionMask); hi = Math.max(hi, result.emissionMask);
  }
  report.animatedMaskSpan = Math.max(report.animatedMaskSpan, hi - lo);
}
assert.equal(report.maximumLoopEndpointError, 0);
assert.ok(report.animatedMaskSpan > 0.05, 'Actual field must visibly vary over time at some spatial positions');
let probes;
try { probes = JSON.parse(await readFile(new URL('native-field-probes.json', root), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (probes) {
  const fieldErrors = [], emissionErrors = [], isolationErrors = [];
  assert.equal(probes.points.length, probes.nativeValues.length);
  for (let i = 0; i < probes.points.length; i++) {
    const actual = sampleScalarAtlas(atlas, probes.points[i]);
    const native = probes.nativeValues[i];
    const a = masksFromField(actual), b = masksFromField(native);
    fieldErrors.push(Math.abs(actual - native));
    emissionErrors.push(Math.abs(a.emissionMask - b.emissionMask));
    isolationErrors.push(Math.abs(a.isolationMask - b.isolationMask));
  }
  const metrics = errors => ({ maxAbsolute: Math.max(...errors), meanAbsolute: errors.reduce((a, b) => a + b, 0) / errors.length, rms: Math.sqrt(errors.reduce((a, b) => a + b * b, 0) / errors.length) });
  report.nativeProbeComparison = { count: fieldErrors.length, field: metrics(fieldErrors), emissionMask: metrics(emissionErrors), isolationMask: metrics(isolationErrors) };
}
const json = JSON.stringify(report, null, 2) + '\n';
await writeFile(new URL('tests/native-atlas-results.json', root), json);
console.log(json);
