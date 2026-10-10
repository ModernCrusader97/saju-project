// Compare every production file to an explicit shared-source commit. Core QA
// evidence may have been committed independently of the cherry-picked runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const requested = process.argv[2];
assert(/^[a-f0-9]{40}$/.test(requested ?? ''), 'Expected an immutable local commit SHA');
const git = (...args) => { const result = spawnSync('git', args, { maxBuffer: 128 * 1024 * 1024 }); assert.equal(result.status, 0, result.stderr.toString()); return result.stdout; };
const baseline = git('rev-parse', requested).toString().trim();
const originalFiles = git('ls-tree', '-r', '--name-only', '-z', baseline).toString().split('\0').filter(Boolean);
const evidenceOnlyExcludedPaths = originalFiles.filter(file => file.startsWith('docs/') || file.startsWith('scripts/qa/'));
const productionFiles = originalFiles.filter(file => !file.startsWith('docs/') && !file.startsWith('scripts/qa/'));
const allowed = new Set(['app/planet/page.tsx', 'components/planet/ElementalSpiritCanvas.tsx', 'lib/planet/approved-jade-spirit.ts', 'lib/planet/elemental-spirit.ts']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex'), rows = [];
for (const file of productionFiles) {
  const before = git('cat-file', 'blob', `${baseline}:${file}`), after = await fs.readFile(file), unchanged = before.equals(after);
  assert(unchanged || allowed.has(file), `Unexpected production-file mutation: ${file}`);
  rows.push({ path: file, baselineSHA256: hash(before), candidateSHA256: hash(after), unchanged });
}
const assets = rows.filter(row => row.path.startsWith('assets/') || row.path.startsWith('public/'));
assert(assets.every(row => row.unchanged));
const source = await fs.readFile('assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb');
assert(source.equals(await fs.readFile('public/spirits/jade-v002/body.glb')));
const report = { status: 'PASS', baseline, candidateHEAD: git('rev-parse', 'HEAD').toString().trim(),
  scope: 'All tracked baseline files except docs/ and scripts/qa/. This includes every production app/component/lib/hook, source/runtime asset, package/dependency lock, config, auth, DB, API and hosting file.',
  originalProductionFiles: rows.length, originalAssets: assets.length,
  changedExistingProductionFiles: rows.filter(row => !row.unchanged).map(row => row.path),
  originalAssetsUnchanged: true, runtimeBodyMatchesOriginal: true, bodyGLBSHA256: hash(source),
  evidenceOnlyExcludedPaths, files: rows };
const output = path.resolve('outputs/spirit-fashion/production-preservation'); await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, baseline, originalProductionFiles: rows.length, originalAssets: assets.length,
  changedExistingProductionFiles: report.changedExistingProductionFiles, excludedCoreEvidenceFiles: evidenceOnlyExcludedPaths.length, bodyGLBSHA256: report.bodyGLBSHA256 }));
