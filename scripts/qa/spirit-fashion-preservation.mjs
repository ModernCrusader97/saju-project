// Compare against an explicit local commit. No network, credentials or user DB.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const requested = process.argv[2] || 'HEAD';
assert(requested === 'HEAD' || /^[a-f0-9]{40}$/.test(requested), 'Expected an immutable local commit SHA or HEAD');
const git = (...args) => { const result = spawnSync('git', args, { maxBuffer: 128 * 1024 * 1024 }); assert.equal(result.status, 0, result.stderr.toString()); return result.stdout; };
const base = git('rev-parse', requested).toString().trim();
const files = git('ls-tree', '-r', '--name-only', '-z', base).toString().split('\0').filter(Boolean), rows = [];
const allowed = new Set(['app/planet/page.tsx', 'components/planet/ElementalSpiritCanvas.tsx', 'lib/planet/approved-jade-spirit.ts', 'lib/planet/elemental-spirit.ts']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const file of files) {
  const before = git('cat-file', 'blob', `${base}:${file}`), after = await fs.readFile(file);
  const unchanged = before.equals(after); assert(unchanged || allowed.has(file), `Unexpected existing-file mutation: ${file}`);
  rows.push({ path: file, sha256: hash(before), unchanged });
}
const assets = rows.filter(row => row.path.startsWith('assets/') || row.path.startsWith('public/')); assert(assets.every(row => row.unchanged));
const source = await fs.readFile('assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb');
assert(source.equals(await fs.readFile('public/spirits/jade-v002/body.glb')));
const report = { status: 'PASS', baseline: base, originalFiles: rows.length, originalAssets: assets.length,
  changedExistingFiles: rows.filter(row => !row.unchanged).map(row => row.path), originalAssetsUnchanged: true, runtimeBodyMatchesOriginal: true, bodyGLBSHA256: hash(source), files: rows };
const output = path.resolve('outputs/spirit-fashion/preservation'); await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, baseline: base, originalFiles: rows.length, originalAssets: assets.length, changedExistingFiles: report.changedExistingFiles, bodyGLBSHA256: report.bodyGLBSHA256 }));
