// Actual GalaxyCanvas scene construction/animation/disposal. Compare against the
// existing personal-view effect builder at its unscaled sphere radius.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { view, owner, friend, dom } from './galaxy-scene-host.mjs';
const require = createRequire(import.meta.url), root = process.cwd(), output = path.join(root, 'outputs/galaxy-entry-appearance');
fs.mkdirSync(output, { recursive: true });
const { createLoader } = require('./load-ts.cjs');
const loader = createLoader({ three: THREE }, { document });
const { getStemThemePreset } = loader.load('lib/planet/theme-library.ts');
const { createSurfaceEffects, disposeSurfaceEffects } = loader.load('lib/planet/surface-effects.ts');
const phase = process.env.SAJU_QA_PHASE || 'after', checks = [], observations = [];
async function check(name, fn) {
  try { await fn(); checks.push({ name, status: 'PASS' }); }
  catch (e) { checks.push({ name, status: 'FAIL', error: e.message }); }
}
const effectsOf = mesh => mesh.children.find(g => g.name === 'living-planet-surface-effects');
const batches = effects => effects.children.map(m => ({ name: m.name, count: m.count, ...m.userData.surfaceEffect }));
function clocks(effects) {
  const result = [];
  effects.traverse(mesh => {
    const material = mesh.material; if (!material) return;
    const shader = { uniforms: {}, vertexShader: '', fragmentShader: '' };
    if (material.uniforms?.surfaceEffectsTime) result.push(material.uniforms.surfaceEffectsTime);
    else { material.onBeforeCompile(shader, {}); if (shader.uniforms.surfaceEffectsTime) result.push(shader.uniforms.surfaceEffectsTime); }
  });
  return result;
}
function disposalRecord(effects) {
  const objects = new Set(), records = [];
  effects.traverse(mesh => {
    for (const object of [mesh.isInstancedMesh ? mesh : null, mesh.geometry, mesh.material]) {
      if (!object || objects.has(object)) continue; objects.add(object);
      const record = { type: object.type, disposals: 0 }; object.addEventListener('dispose', () => record.disposals++); records.push(record);
    }
  });
  return records;
}
for (const key of ['갑자', '을축', '병인', '정묘', '무진', '기사', '경오', '신미', '임신', '계유']) await check(`${key}: personal and galaxy effects share batches and normalized placements`, async () => {
  const scene = await view({ initialPeople: [{ ...owner, pillars: { ...owner.pillars, dayKey: key, monthKey: key } }, friend] });
  let personal;
  try {
    await scene.frame(0);
    const mesh = scene.groups()[0].children[0], actual = effectsOf(mesh);
    assert(actual, 'Galaxy main body has no supported surface effects');
    const preset = getStemThemePreset(key); personal = createSurfaceEffects(preset, preset, 'pangaea', 1.85);
    assert.deepEqual(batches(actual), batches(personal));
    assert.equal(actual.userData.surfaceEffects.radius, mesh.geometry.parameters.radius);
    let maxNormalizedMatrixError = 0;
    actual.children.forEach((batch, index) => {
      for (let i = 0; i < batch.instanceMatrix.array.length; i++) {
        const divisor = i % 16 < 12 || (i % 16 >= 12 && i % 16 <= 14) ? 1.85 : 1;
        if (i % 16 === 3 || i % 16 === 7 || i % 16 === 11) continue;
        maxNormalizedMatrixError = Math.max(maxNormalizedMatrixError,
          Math.abs(batch.instanceMatrix.array[i] - personal.children[index].instanceMatrix.array[i] / divisor));
      }
    });
    assert(maxNormalizedMatrixError < 1e-6);
    assert.equal(mesh.scale.x, 1.3);
    observations.push({ key, batches: batches(actual), maxNormalizedMatrixError,
      geometryRadius: mesh.geometry.parameters.radius, effectsRadius: actual.userData.surfaceEffects.radius, worldScale: mesh.scale.x });
  } finally { if (personal) disposeSurfaceEffects(personal); await scene.close(); }
});
await check('mixed day/month effects occupy the same personal 70/30 regions', async () => {
  const scene = await view({ initialPeople: [{ ...owner, pillars: { ...owner.pillars, dayKey: '무오', monthKey: '병자' } }, friend] });
  let personal;
  try {
    await scene.frame(0);
    const actual = effectsOf(scene.groups()[0].children[0]); assert(actual);
    personal = createSurfaceEffects(getStemThemePreset('무오'), getStemThemePreset('병자'), 'pangaea', 1.85);
    assert.deepEqual(batches(actual), batches(personal));
    assert(actual.children.some(m => m.userData.surfaceEffect.region === 'day'));
    assert(actual.children.some(m => m.userData.surfaceEffect.region === 'month'));
  } finally { if (personal) disposeSurfaceEffects(personal); await scene.close(); }
});
await check('effects follow simulation time, freeze on pause and zero speed, reset with the body', async () => {
  const scene = await view();
  try {
    await scene.frame(0);
    const effects = scene.groups().map(g => effectsOf(g.children[0])); assert(effects.every(Boolean));
    const uniforms = effects.flatMap(clocks); assert(uniforms.length > 0);
    await scene.advance(120, 1000 / 60); assert(uniforms.every(u => Math.abs(u.value - 2) < 1e-9));
    await scene.click('움직임 멈춤'); await scene.advance(120, 1000 / 60); assert(uniforms.every(u => Math.abs(u.value - 2) < 1e-9));
    await scene.click('움직임 재생'); await scene.setSpeed(0); await scene.advance(60, 1000 / 60); assert(uniforms.every(u => Math.abs(u.value - 2) < 1e-9));
    await scene.click('초기화'); assert(uniforms.every(u => u.value === 0));
  } finally { await scene.close(); }
});
await check('node replacement and unmount dispose every effect instance buffer, geometry and material once', async () => {
  const scene = await view({ strict: true });
  try {
    await scene.frame(0);
    const first = scene.groups().map(g => effectsOf(g.children[0])); assert(first.every(Boolean));
    const firstRecords = first.flatMap(disposalRecord); await scene.arrive();
    assert(firstRecords.length > 0); assert(firstRecords.every(r => r.disposals === 1));
    assert(first.every(g => g.parent === null && g.children.length === 0));
    const next = scene.groups().map(g => effectsOf(g.children[0])); assert(next.every(Boolean));
    const nextRecords = next.flatMap(disposalRecord); await scene.close();
    assert(nextRecords.every(r => r.disposals === 1)); assert(firstRecords.every(r => r.disposals === 1));
    observations.push({ scenario: 'cleanup', firstResources: firstRecords.length, nextResources: nextRecords.length, allOnce: true });
  } finally { if (scene.renderer.disposals === 0) await scene.close(); }
});
const hash = file => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const report = { phase, checks, observations, passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length,
  sourceSha256: hash('components/planet/GalaxyCanvas.tsx'), harnessSha256: hash('scripts/qa/galaxy-owner-effects.mjs'),
  hostSha256: hash('scripts/qa/galaxy-scene-host.mjs'), limits: ['Actual React/Three/material/effects/disposal; GPU, Canvas2D and clock are synthetic host boundaries'] };
fs.writeFileSync(path.join(output, `${phase}-owner-effects-cpu.json`), JSON.stringify(report, null, 2) + '\n');
for (const c of checks) console.log(c.status + ' ' + c.name + (c.error ? ': ' + c.error : ''));
console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); dom.window.close(); process.exitCode = report.failed ? 1 : 0;
