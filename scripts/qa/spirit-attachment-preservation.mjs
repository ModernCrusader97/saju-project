import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const baseline = 'a5535893645f35d4000ec773bff61caef19463cf';
const git = args => execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024 });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const allowed = new Set([
  'components/planet/ElementalSpiritCanvas.tsx', 'lib/planet/approved-jade-spirit.ts',
  'lib/planet/elemental-spirit.ts', 'lib/planet/mesh-surface.ts', 'lib/planet/spirit-zodiac-pet.ts',
  'lib/planet/surface-stem-accents.ts', 'lib/planet/approved-stem-accents.ts',
  'lib/planet/surface-woody-branches.ts', 'lib/planet/spirit-profiles.ts', 'app/planet/page.tsx',
]);
const files = git(['ls-tree', '-r', '-z', baseline]).toString().split('\0').filter(Boolean).map(row => {
  const [meta, file] = row.split('\t'); return { file, oid: meta.split(' ')[2] };
});
const changed = [], preserved = [];
for (const row of files) {
  const before = git(['cat-file', 'blob', row.oid]), after = fs.readFileSync(row.file);
  if (!before.equals(after)) {
    assert(allowed.has(row.file), 'Unexpected change to deployed v30 source: ' + row.file);
    changed.push({ file: row.file, beforeSHA256: hash(before), afterSHA256: hash(after) });
  } else preserved.push({ file: row.file, sha256: hash(after) });
}
const assets = files.filter(row => row.file.startsWith('assets/') || row.file.startsWith('public/'));
assert.equal(assets.length, 171);
assert(assets.every(row => preserved.some(item => item.file === row.file)), 'All approved original assets remain byte-identical');
for (const row of files.filter(row => /^app\/api\/|^lib\/(?:auth|db)\/|^\.openai\/|^drizzle\//.test(row.file))) {
  assert(preserved.some(item => item.file === row.file), 'Existing auth/DB/API/hosting changes are outside this task');
}
const output = path.resolve('outputs/spirit-attachments-preservation'); fs.mkdirSync(output, { recursive: true });
const report = { status: 'PASS', baseline, originalFiles: files.length, originalAssetFiles: assets.length,
  changedOriginalFiles: changed.length, preservedOriginalFiles: preserved.length,
  approvedBodyOriginalUVsAndMaterialsAssetsUnchanged: true, existingDBAuthAndAPISourceUnchanged: true,
  runtimeApprovedGLBSHA256: hash(fs.readFileSync('public/spirits/jade-v002/body.glb')), changed, preserved };
fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, changed: changed.map(row => row.file), preserved: undefined }));
