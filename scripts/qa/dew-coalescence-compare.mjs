// Compare native observations, not timestamps attached to screenshots alone.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const output = path.resolve('outputs/surface-dew-coalescence/webgl');
const before = JSON.parse(await fs.readFile(path.join(output, 'before/report.json')));
const after = JSON.parse(await fs.readFile(path.join(output, 'after/report.json')));
assert.equal(before.status, 'PASS'); assert.equal(after.status, 'PASS');
const key = f => f.quality + ':' + f.label;
const beforeFrames = new Map(before.frames.map(f => [key(f), f]));
const compared = [];
for (const f of after.frames) {
  const b = beforeFrames.get(key(f)); if (!b) continue;
  for (const field of ['seconds', 'materialTime', 'camera', 'bodyMatrix', 'nativeModel', 'morph', 'attributes', 'depth', 'bodyCasters', 'shadow']) {
    assert.deepEqual(f[field], b[field], key(f) + ' native/scene ' + field);
  }
  const fire = f.label === 'fire-shadow-same-time';
  if (fire) {
    assert.equal(f.pixels, b.pixels, 'Unchanged fire, alpha and ground shadow must retain native pixels.');
    assert.equal(f.pngSHA256, b.pngSHA256, 'Matched-time full fire PNG must be byte identical.');
  }
  compared.push({ key: key(f), seconds: f.seconds, materialTime: f.materialTime,
    matchedNativePoseCameraShadow: true, pixelsChanged: f.pixels !== b.pixels, firePixelAndPNGIdentical: fire ? true : null });
}
assert.equal(compared.length, 22); assert.equal(compared.filter(f => f.firePixelAndPNGIdentical).length, 2);
assert(compared.filter(f => !f.firePixelAndPNGIdentical).some(f => f.pixelsChanged), 'The new dew lifecycle changes actual rendered pixels.');
for (const f of after.frames.filter(f => f.label.startsWith('fashion-'))) assert.deepEqual(f.maskOverlaps, []);
for (const report of [before, after]) for (const c of report.cases) {
  assert.equal(c.cleanup.nativeLiveBeforeForcedLoss, 0); assert.equal(c.cleanup.created, c.cleanup.explicitDeleted);
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const result = { status: 'PASS', beforeCommit: before.sourceCommit, afterSourceHashes: after.sourceHashes,
  fashionReferenceCommit: after.fashionReferenceCommit, matchedFrames: compared.length,
  beforePNGCount: before.frames.length, afterPNGCount: after.frames.length, fashionOverlapSamples: 8,
  compared, reports: Object.fromEntries(await Promise.all(['before', 'after'].map(async phase => [phase,
    sha(await fs.readFile(path.join(output, phase, 'report.json')))]))),
  limitations: ['Native Chromium SwiftShader; no physical device or hosted logged-in run.',
    'Accessory envelope exclusion and source-face clearance do not establish continuous collision against every body part.'] };
await fs.writeFile(path.join(output, 'comparison.json'), JSON.stringify(result, null, 2) + '\n');
console.log('PASS: 22 matched native frames, 2 byte-identical fire PNGs, 8 fashion overlap samples.');
