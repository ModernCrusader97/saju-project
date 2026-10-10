// Read-only forensic comparison. No model is exported and no repository file is modified.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const project = '/workspace/saju-spirit-surface-zodiac-v30-20261010';
const projectRequire = createRequire(project + '/package.json');
const THREE = projectRequire('three');
const ts = projectRequire('typescript');
const { createLoader } = projectRequire('./scripts/qa/load-ts.cjs');
const profiles = createLoader().load('lib/planet/spirit-profiles.ts');
const baseline = 'dffb235fbe47c063b8535a21b4fdf3ea8235d6aa';
const current = 'f7e99f144223d1497238767c26d10ec9f6e2002b';
const sha = data => createHash('sha256').update(data).digest('hex');
const gitFile = (root, commit, path) => execFileSync('git', ['show', commit + ':' + path], { cwd: root, encoding: 'utf8' });
const manifest = JSON.parse(gitFile(project, current, 'public/models/zodiac-pets/manifest.json'));
let requests = 0;
function api(root, commit) {
  const exports = {};
  const context = vm.createContext({ exports, module: { exports }, Number, Object, Set, Promise, Error, DOMException,
    fetch: () => { requests++; throw new Error('Unexpected animal network request'); },
    require(specifier) {
      if (specifier === 'three') return THREE;
      if (specifier === './spirit-profiles') return profiles;
      if (specifier === 'three/addons/loaders/GLTFLoader.js') return { GLTFLoader: class {} };
      if (specifier === '../../public/models/zodiac-pets/manifest.json') return manifest;
      throw new Error('Unexpected dependency ' + specifier);
    },
  });
  const source = gitFile(root, commit, 'lib/planet/spirit-zodiac-pet.ts');
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, context);
  return exports;
}
const old = api('/workspace/saju-project', baseline);
const now = api(project, current);
const hashArray = attribute => sha(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
function snapshot(group) {
  group.updateMatrixWorld(true);
  const rows = [];
  group.traverse(object => {
    const row = { name: object.name, type: object.type, position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray(), castShadow: object.castShadow };
    if (object.isMesh) {
      row.geometry = { type: object.geometry.type, attributes: Object.fromEntries(Object.entries(object.geometry.attributes).map(([key, value]) => [key, { count: value.count, itemSize: value.itemSize, hash: hashArray(value) }])), index: object.geometry.index ? hashArray(object.geometry.index) : null };
      row.material = { type: object.material.type, color: object.material.color.toArray(), roughness: object.material.roughness, metalness: object.material.metalness, emissive: object.material.emissive.toArray(), opacity: object.material.opacity };
    }
    rows.push(row);
  });
  return rows;
}
function releaseOld(group) {
  const resources = new Set();
  group.traverse(object => { if (object.geometry) resources.add(object.geometry); if (object.material) resources.add(object.material); });
  for (const resource of resources) resource.dispose();
  group.clear();
}
async function main() {
  const branches = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  const rows = [];
  for (const quality of ['high', 'low']) for (const branch of branches) {
    const previous = old.createZodiacPet(branch, quality), direct = now.createZodiacPet(branch, quality), loaded = await now.loadZodiacPet(branch, quality);
    const samples = [];
    for (const time of [0, 1.25, 4, 0]) {
      previous.update(time); direct.update(time); loaded.update(time);
      const a = snapshot(previous.group), b = snapshot(direct.group), c = snapshot(loaded.group);
      assert.deepEqual(b, a, 'Current anatomy/material/transform must equal preserved source for ' + branch + '/' + quality + '/' + time);
      assert.deepEqual(c, a, 'The actual loader must return the existing generated animal for ' + branch + '/' + quality + '/' + time);
      samples.push({ time, runtimeSnapshotSha256: sha(JSON.stringify(c)) });
    }
    const bounds = new THREE.Box3().setFromObject(loaded.group, true), dimensions = bounds.getSize(new THREE.Vector3());
    assert(Math.abs(bounds.min.y) < .002);
    assert(dimensions.x <= .625 && dimensions.y <= .665 && dimensions.z <= .855);
    assert.equal(loaded.group.userData.branch, branch);
    assert.equal(loaded.group.userData.animal, profiles.ZODIAC_FEATURES[branch].animal);
    const initial = snapshot(loaded.group);
    rows.push({ branch, animal: loaded.group.userData.animal, quality, meshCount: initial.filter(r => r.geometry).length, dimensions: dimensions.toArray(), sourceParity: true, loaderParity: true, idleAndResetParity: true, samples });
    releaseOld(previous.group); direct.dispose(); loaded.dispose();
  }
  assert.equal(requests, 0);
  const report = { baseline, current, instancesCompared: rows.length, comparisons: rows.length * 4 * 2, requestedAnimalUrls: requests, pass: true, rows, limits: 'CPU source parity only; no new model exports, browser captures or authored original asset approval verification.' };
  fs.writeFileSync('/tmp/saju-existing-zodiac-cpu-parity.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ instancesCompared: report.instancesCompared, comparisons: report.comparisons, requestedAnimalUrls: requests, pass: report.pass }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
