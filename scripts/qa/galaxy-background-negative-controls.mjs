// Proves that the clock suite detects removed guards. Mutations exist only in
// strings handed to the TypeScript loader; no application file is written.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = process.cwd(), output = path.join(root, 'outputs/galaxy-resume');
fs.mkdirSync(output, { recursive: true });
const harness = fs.readFileSync(path.join(root, 'scripts/qa/galaxy-background-clock.mjs'), 'utf8');
const mutations = [
  { name: 'visibility-reset', file: 'components/planet/GalaxyCanvas.tsx',
    from: 'const onVisibility = () => { previousTime = performance.now(); };', to: 'const onVisibility = () => {};' },
  { name: 'hidden-gate', file: 'components/planet/GalaxyCanvas.tsx',
    from: 'if (document.hidden || contextLost || shaderFailed) return;', to: 'if (contextLost || shaderFailed) return;' },
  { name: 'delta-cap', file: 'lib/planet/surface-math.ts',
    from: 'Math.min(0.05, (now - previous) / 1000)', to: 'Math.min(Infinity, (now - previous) / 1000)' },
];
const controls = [];
for (const mutation of mutations) {
  const helper = 'function negativeSource(file) { let source = fs.readFileSync(file, "utf8"); if (file.endsWith('
    + JSON.stringify(mutation.file) + ')) { if (!source.includes(' + JSON.stringify(mutation.from)
    + ')) throw new Error("Negative-control anchor absent"); source = source.replace(' + JSON.stringify(mutation.from)
    + ', ' + JSON.stringify(mutation.to) + '); } return source; }\n';
  const file = path.join(output, 'negative-' + mutation.name + '.mjs');
  const reportName = 'negative-' + mutation.name + '-results.json';
  assert(harness.includes("fs.readFileSync(absolute, 'utf8')"));
  fs.writeFileSync(file, helper + harness.replace("fs.readFileSync(absolute, 'utf8')", 'negativeSource(absolute)')
    .replace('outputs/galaxy-resume/clock-results.json', 'outputs/galaxy-resume/' + reportName));
  const result = spawnSync(process.execPath, [file], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 2e6 });
  assert.ifError(result.error);
  fs.writeFileSync(path.join(output, 'negative-' + mutation.name + '.log'), result.stdout + '\n' + result.stderr);
  const report = JSON.parse(fs.readFileSync(path.join(output, reportName), 'utf8'));
  const observation = { mutation: mutation.name, onlyInMemory: true, exitCode: result.status,
    passed: report.passed, failed: report.failed, failedChecks: report.checks.filter(check => check.status === 'FAIL').map(check => check.name) };
  controls.push(observation); console.log(JSON.stringify(observation));
  assert.equal(result.status, 1); assert(report.failed > 0, 'Expected the missing guard to be detected');
}
fs.writeFileSync(path.join(output, 'negative-control-results.json'), JSON.stringify({ allDetected: true,
  productionFilesChanged: false, harnessSha256: createHash('sha256').update(harness).digest('hex'), controls }, null, 2) + '\n');
